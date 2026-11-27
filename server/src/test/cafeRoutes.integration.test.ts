import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { GooglePlace } from '../types/googlePlaces.js';

const google = vi.hoisted(() =>
{
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.VERIFICATION_CODE_SECRET = 'test-verification-code-secret';

    return {
        searchCafesNearby: vi.fn(),
        searchCafes: vi.fn(),
        getPlaceDetails: vi.fn(),
        getPlacePhoto: vi.fn(),
    };
});

const stats = vi.hoisted(() => ({ getCafeStats: vi.fn() }));

vi.mock('dotenv/config', () => ({}));
vi.mock('../lib/prisma.js', async () => ({
    default: (await import('./fakePrisma.js')).fakePrisma,
}));
vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../services/email.js', () => ({
    sendVerificationEmail: vi.fn(),
    sendEmailChangeVerification: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
}));
vi.mock('../services/googlePlaces.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('../services/googlePlaces.js')>()),
    ...google,
}));
vi.mock('../services/cafeStats.js', () => stats);

import app from '../app.js';
import { GooglePlaceNotFoundError } from '../services/googlePlaces.js';

const OBELISCO = { latitude: -34.6037, longitude: -58.3816 };

const place = (
    id: string,
    location = OBELISCO,
    extra: Partial<GooglePlace> = {}
): GooglePlace => ({
    id,
    displayName: { text: `Café ${id}` },
    formattedAddress: 'Av. Corrientes 1234, CABA',
    location,
    ...extra,
} as GooglePlace);

const emptyStats = {
    rating: null,
    reviewsCount: 0,
    reviews: [],
    coffeeRating: null,
    foodRating: null,
    serviceRating: null,
    comfortRating: null,
    quietRating: null,
    goodForWorkPercentage: null,
    goodForStudyPercentage: null,
    goodForDatePercentage: null,
    goodForWorkCount: 0,
    goodForStudyCount: 0,
    goodForDateCount: 0,
    goodForWorkResponsesCount: 0,
    goodForStudyResponsesCount: 0,
    goodForDateResponsesCount: 0,
    coffeeRatingsCount: 0,
    foodRatingsCount: 0,
    wifi: { yesCount: 0, responsesCount: 0 },
    powerOutlets: { yesCount: 0, responsesCount: 0 },
};

const get = (path: string) => request(app).get(path);

beforeEach(() =>
{
    vi.clearAllMocks();
    stats.getCafeStats.mockResolvedValue(emptyStats);
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('GET /cafes/nearby', () =>
{
    it('400 sin coordenadas o con coordenadas fuera de rango, sin consultar a Google', async () =>
    {
        expect((await get('/cafes/nearby')).status).toBe(400);
        expect((await get('/cafes/nearby?latitude=abc&longitude=-58')).status).toBe(400);
        expect((await get('/cafes/nearby?latitude=95&longitude=-58')).status).toBe(400);
        expect((await get('/cafes/nearby?latitude=-34&longitude=200')).status).toBe(400);
        expect(google.searchCafesNearby).not.toHaveBeenCalled();
    });

    it('ordena por distancia y calcula la distancia desde el punto pedido', async () =>
    {
        google.searchCafesNearby.mockResolvedValue([
            place('lejos', { latitude: -34.5780, longitude: -58.4265 }),
            place('cerca', { latitude: -34.6040, longitude: -58.3820 }),
        ]);

        const res = await get(`/cafes/nearby?latitude=${OBELISCO.latitude}&longitude=${OBELISCO.longitude}`);

        expect(res.status).toBe(200);
        expect(res.body.map((cafe: { googlePlaceId: string }) => cafe.googlePlaceId)).toEqual(['cerca', 'lejos']);
        expect(res.body[0].distanceKm).toBeLessThan(0.1);
        expect(res.body[1].distanceKm).toBeCloseTo(5, 0);
        expect(google.searchCafesNearby).toHaveBeenCalledWith(OBELISCO.latitude, OBELISCO.longitude);
    });

    it('descarta los lugares de Google sin nombre, dirección o ubicación', async () =>
    {
        google.searchCafesNearby.mockResolvedValue([
            place('bien'),
            { id: 'incompleto', displayName: { text: 'Sin dirección' } } as GooglePlace,
        ]);

        const res = await get('/cafes/nearby?latitude=-34.6&longitude=-58.38');

        expect(res.body).toHaveLength(1);
        expect(res.body[0].googlePlaceId).toBe('bien');
    });

    it('suma las estadísticas de BusCafé a cada café', async () =>
    {
        google.searchCafesNearby.mockResolvedValue([place('con-resenas')]);
        stats.getCafeStats.mockResolvedValue({ ...emptyStats, rating: 4.5, reviewsCount: 12 });

        const res = await get('/cafes/nearby?latitude=-34.6&longitude=-58.38');

        expect(res.body[0]).toMatchObject({ buscafeRating: 4.5, buscafeReviewsCount: 12 });
    });

    it('con intent "study" devuelve solo los recomendados por la comunidad', async () =>
    {
        google.searchCafesNearby.mockResolvedValue([place('recomendado'), place('sin-datos')]);
        stats.getCafeStats.mockImplementation(async (id: string) =>
            id === 'recomendado'
                ? { ...emptyStats, goodForStudyPercentage: 90, goodForStudyResponsesCount: 10 }
                : emptyStats
        );

        const res = await get('/cafes/nearby?latitude=-34.6&longitude=-58.38&intent=study');

        expect(res.body.map((cafe: { googlePlaceId: string }) => cafe.googlePlaceId)).toEqual(['recomendado']);
    });

    it('con intent "pet-friendly" devuelve solo los que aceptan perros', async () =>
    {
        google.searchCafesNearby.mockResolvedValue([
            place('perros', OBELISCO, { allowsDogs: true }),
            place('sin-perros', OBELISCO, { allowsDogs: false }),
        ]);

        const res = await get('/cafes/nearby?latitude=-34.6&longitude=-58.38&intent=pet-friendly');

        expect(res.body.map((cafe: { googlePlaceId: string }) => cafe.googlePlaceId)).toEqual(['perros']);
    });

    it('500 si falla Google', async () =>
    {
        google.searchCafesNearby.mockRejectedValue(new Error('Google caído'));

        expect((await get('/cafes/nearby?latitude=-34.6&longitude=-58.38')).status).toBe(500);
    });
});

describe('GET /cafes/search', () =>
{
    it('400 con menos de 3 caracteres', async () =>
    {
        expect((await get('/cafes/search?query=ab')).status).toBe(400);
        expect(google.searchCafes).not.toHaveBeenCalled();
    });

    it('400 si pageToken y resolvedQuery no vienen juntos', async () =>
    {
        expect((await get('/cafes/search?query=palermo&pageToken=abc')).status).toBe(400);
        expect((await get('/cafes/search?query=palermo&resolvedQuery=x')).status).toBe(400);
    });

    it('400 si latitud y longitud no vienen juntas o son inválidas', async () =>
    {
        expect((await get('/cafes/search?query=palermo&latitude=-34')).status).toBe(400);
        expect((await get('/cafes/search?query=palermo&latitude=abc&longitude=-58')).status).toBe(400);
    });

    it('devuelve los cafés con la página siguiente; con ubicación calcula la distancia', async () =>
    {
        google.searchCafes.mockResolvedValue({
            places: [place('uno')],
            nextPageToken: 'pagina-2',
            resolvedQuery: 'cafés en Palermo',
        });

        const res = await get(`/cafes/search?query=palermo&latitude=${OBELISCO.latitude}&longitude=${OBELISCO.longitude}`);

        expect(res.status).toBe(200);
        expect(res.body.nextPageToken).toBe('pagina-2');
        expect(res.body.resolvedQuery).toBe('cafés en Palermo');
        expect(res.body.cafes[0].distanceKm).toBeCloseTo(0, 3);
        expect(google.searchCafes).toHaveBeenCalledWith('palermo', undefined, undefined);
    });

    it('sin ubicación la distancia es null', async () =>
    {
        google.searchCafes.mockResolvedValue({ places: [place('uno')], nextPageToken: null, resolvedQuery: 'x' });

        const res = await get('/cafes/search?query=palermo');

        expect(res.body.cafes[0].distanceKm).toBeNull();
    });
});

describe('GET /cafes/place/:googlePlaceId', () =>
{
    it('devuelve el detalle con estadísticas, horarios y fotos', async () =>
    {
        google.getPlaceDetails.mockResolvedValue(place('ChIJdetalle', OBELISCO, {
            regularOpeningHours: { weekdayDescriptions: ['lunes: 8–20'] },
            photos: [{ name: 'places/x/photos/1', widthPx: 800, heightPx: 600 }],
        } as Partial<GooglePlace>));
        google.getPlacePhoto.mockResolvedValue('https://foto/1.jpg');
        stats.getCafeStats.mockResolvedValue({ ...emptyStats, rating: 4 });

        const res = await get('/cafes/place/ChIJdetalle');

        expect(res.status).toBe(200);
        expect(res.body).toMatchObject({
            googlePlaceId: 'ChIJdetalle',
            buscafeRating: 4,
            regularOpeningHours: ['lunes: 8–20'],
            photos: [{ url: 'https://foto/1.jpg', widthPx: 800, heightPx: 600 }],
        });
    });

    it('devuelve lo que dice la comunidad sobre Wi-Fi y enchufes', async () =>
    {
        google.getPlaceDetails.mockResolvedValue(place('ChIJdetalle'));
        stats.getCafeStats.mockResolvedValue({
            ...emptyStats,
            wifi: { yesCount: 8, responsesCount: 10 },
            powerOutlets: { yesCount: 2, responsesCount: 6 },
        });

        const res = await get('/cafes/place/ChIJdetalle');

        expect(res.body.wifi).toEqual({ yesCount: 8, responsesCount: 10 });
        expect(res.body.powerOutlets).toEqual({ yesCount: 2, responsesCount: 6 });
    });

    it('si falla una foto, el detalle sale igual sin esa foto', async () =>
    {
        google.getPlaceDetails.mockResolvedValue(place('ChIJdetalle', OBELISCO, {
            photos: [{ name: 'rota' }, { name: 'bien' }],
        } as Partial<GooglePlace>));
        google.getPlacePhoto.mockImplementation(async (name: string) =>
        {
            if (name === 'rota') throw new Error('sin foto');
            return 'https://foto/bien.jpg';
        });

        const res = await get('/cafes/place/ChIJdetalle');

        expect(res.status).toBe(200);
        expect(res.body.photos).toHaveLength(1);
    });

    it('400 con un ID inválido, sin consultar a Google', async () =>
    {
        expect((await get('/cafes/place/no%20valido')).status).toBe(400);
        expect(google.getPlaceDetails).not.toHaveBeenCalled();
    });

    it('404 si Google no conoce el lugar', async () =>
    {
        google.getPlaceDetails.mockRejectedValue(new GooglePlaceNotFoundError('ChIJx'));

        expect((await get('/cafes/place/ChIJx')).status).toBe(404);
    });

    it('500 si falla Google por otro motivo', async () =>
    {
        google.getPlaceDetails.mockRejectedValue(new Error('cuota agotada'));

        expect((await get('/cafes/place/ChIJx')).status).toBe(500);
    });
});

describe('GET /cafes/place/:googlePlaceId/photo/:index', () =>
{
    it('devuelve la URL y los autores de la foto', async () =>
    {
        google.getPlaceDetails.mockResolvedValue(place('ChIJfoto', OBELISCO, {
            photos: [{ name: 'places/x/photos/1', authorAttributions: [{ displayName: 'Ana' }] }],
        } as Partial<GooglePlace>));
        google.getPlacePhoto.mockResolvedValue('https://foto/1.jpg');

        const res = await get('/cafes/place/ChIJfoto/photo/0');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            url: 'https://foto/1.jpg',
            authorAttributions: [{ displayName: 'Ana' }],
        });
    });

    it('400 con un índice fuera de 0–4 o un ID inválido, sin consultar a Google', async () =>
    {
        expect((await get('/cafes/place/ChIJfoto/photo/5')).status).toBe(400);
        expect((await get('/cafes/place/no%20valido/photo/0')).status).toBe(400);
        expect(google.getPlaceDetails).not.toHaveBeenCalled();
    });

    it('404 si el lugar no tiene esa foto o no existe', async () =>
    {
        google.getPlaceDetails.mockResolvedValue(place('ChIJfoto', OBELISCO, { photos: [] }));
        expect((await get('/cafes/place/ChIJfoto/photo/0')).status).toBe(404);

        google.getPlaceDetails.mockRejectedValue(new GooglePlaceNotFoundError('ChIJx'));
        expect((await get('/cafes/place/ChIJx/photo/0')).status).toBe(404);
    });

    it('502 si falla Google por otro motivo', async () =>
    {
        google.getPlaceDetails.mockRejectedValue(new Error('cuota agotada'));

        expect((await get('/cafes/place/ChIJx/photo/0')).status).toBe(502);
    });
});
