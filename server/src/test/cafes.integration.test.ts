import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import type { GooglePlace } from '../types/googlePlaces.js';

const google = vi.hoisted(() =>
{
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.VERIFICATION_CODE_SECRET = 'test-verification-code-secret';

    return { getPlaceDetails: vi.fn() };
});

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
    getPlaceDetails: google.getPlaceDetails,
}));

import app from '../app.js';
import { GooglePlaceNotFoundError } from '../services/googlePlaces.js';
import { db } from './fakePrisma.js';
import { createUser, uniqueIp } from './helpers.js';

const EXISTING_PLACE_ID = 'ChIJ_existente';
const NEW_PLACE_ID = 'ChIJ_nuevo';

// Lo que manda la app actual: datos del café inventables por el cliente.
const clientCafeFields = {
    cafeName: 'NOMBRE FALSO',
    cafeAddress: 'DIRECCIÓN FALSA',
    cafeLatitude: 0,
    cafeLongitude: 0,
};

const googlePlace = (id: string): GooglePlace => ({
    id,
    displayName: { text: 'Café según Google' },
    formattedAddress: 'Av. Corrientes 1234, CABA',
    location: { latitude: -34.6037, longitude: -58.3816 },
} as GooglePlace);

const reviewBody = (googlePlaceId: string, extra: object = {}) => ({
    googlePlaceId,
    ...clientCafeFields,
    rating: 5,
    comment: 'Muy buen café',
    ...extra,
});

const post = (path: string, token: string | null, body: object) =>
{
    const req = request(app)
        .post(path)
        .set('X-Forwarded-For', uniqueIp());

    return (token ? req.set('Authorization', `Bearer ${token}`) : req).send(body);
};

const seedExistingCafe = () =>
    db.cafes.insert({
        googlePlaceId: EXISTING_PLACE_ID,
        name: 'Nombre real',
        address: 'Dirección real 100',
        latitude: -34.5,
        longitude: -58.4,
    });

beforeEach(() =>
{
    db.reset();
    vi.clearAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => {});
    vi.spyOn(console, 'warn').mockImplementation(() => {});
    google.getPlaceDetails.mockImplementation(async (id: string) => googlePlace(id));
});

describe.each([
    {
        path: '/reviews',
        body: reviewBody,
        created: 201,
        limit: 30,
        limitMessage: 'Llegaste al límite de reseñas por hora. Probá de nuevo más tarde.',
        invalidMessage: 'Datos de reseña inválidos',
    },
    {
        path: '/favorites',
        body: (googlePlaceId: string) => ({ googlePlaceId, ...clientCafeFields }),
        created: 201,
        limit: 60,
        limitMessage: 'Llegaste al límite de favoritos por hora. Probá de nuevo más tarde.',
        invalidMessage: 'Datos de cafetería inválidos',
    },
])('POST $path', ({ path, body, created, limit, limitMessage, invalidMessage }) =>
{
    it('401 sin sesión', async () =>
    {
        expect((await post(path, null, body(EXISTING_PLACE_ID))).status).toBe(401);
    });

    it('café existente: no consulta Google ni pisa sus datos', async () =>
    {
        const user = await createUser();
        const cafe = seedExistingCafe();
        const before = { ...cafe };

        const res = await post(path, user.token, body(EXISTING_PLACE_ID));

        expect(res.status).toBe(created);
        expect(google.getPlaceDetails).not.toHaveBeenCalled();
        expect(db.cafes.rows).toHaveLength(1);
        expect(db.cafes.rows[0]).toEqual(before);
    });

    it('café nuevo: lo crea con los datos de Google, no con los del cliente', async () =>
    {
        const user = await createUser();

        const res = await post(path, user.token, body(NEW_PLACE_ID));

        expect(res.status).toBe(created);
        expect(google.getPlaceDetails).toHaveBeenCalledWith(NEW_PLACE_ID);
        expect(db.cafes.rows).toHaveLength(1);
        expect(db.cafes.rows[0]).toMatchObject({
            googlePlaceId: NEW_PLACE_ID,
            name: 'Café según Google',
            address: 'Av. Corrientes 1234, CABA',
            latitude: -34.6037,
            longitude: -58.3816,
        });
    });

    it('404 si Google no conoce el lugar, sin crear nada', async () =>
    {
        const user = await createUser();
        google.getPlaceDetails.mockRejectedValue(new GooglePlaceNotFoundError('ChIJ_x'));

        const res = await post(path, user.token, body('ChIJ_x'));

        expect(res.status).toBe(404);
        expect(res.body.error).toBe('No encontramos esa cafetería');
        expect(db.cafes.rows).toHaveLength(0);
        expect(db.reviews.rows).toHaveLength(0);
        expect(db.favorites.rows).toHaveLength(0);
    });

    it('502 si Google falla, sin crear nada', async () =>
    {
        const user = await createUser();
        google.getPlaceDetails.mockRejectedValue(
            new Error('Error de Google Place Details: 400 ... API_KEY_INVALID')
        );

        const res = await post(path, user.token, body(NEW_PLACE_ID));

        expect(res.status).toBe(502);
        expect(res.body.error).toBe('No pudimos verificar la cafetería. Probá de nuevo.');
        expect(db.cafes.rows).toHaveLength(0);
        expect(db.reviews.rows).toHaveLength(0);
        expect(db.favorites.rows).toHaveLength(0);
    });

    it('400 con un googlePlaceId inválido, sin consultar Google', async () =>
    {
        const user = await createUser();

        const res = await post(path, user.token, body('../photos?x=1'));

        expect(res.status).toBe(400);
        expect(res.body.error).toBe(invalidMessage);
        expect(google.getPlaceDetails).not.toHaveBeenCalled();
    });

    it(`429 después de ${limit} por usuario por hora; otro usuario no se ve afectado`, async () =>
    {
        const user = await createUser();
        seedExistingCafe();

        for (let i = 0; i < limit; i++)
        {
            expect((await post(path, user.token, body('ChIJ invalido'))).status).toBe(400);
        }

        const blocked = await post(path, user.token, body(EXISTING_PLACE_ID));

        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toBe(limitMessage);
        expect(Number(blocked.headers['retry-after'])).toBeGreaterThan(0);

        const other = await createUser();
        expect((await post(path, other.token, body(EXISTING_PLACE_ID))).status).toBe(created);
    });
});

describe('POST /reviews: idempotencia', () =>
{
    it('reintentar con la misma clave devuelve la misma reseña sin volver a consultar Google', async () =>
    {
        const user = await createUser();
        const idempotencyKey = '2b6f0cc9-4a5e-4b8a-9f1e-1c2d3e4f5a6b';

        const first = await post('/reviews', user.token, reviewBody(NEW_PLACE_ID, { idempotencyKey }));
        const retry = await post('/reviews', user.token, reviewBody(NEW_PLACE_ID, { idempotencyKey }));

        expect(first.status).toBe(201);
        expect(retry.status).toBe(200);
        expect(retry.body.id).toBe(first.body.id);
        expect(db.reviews.rows).toHaveLength(1);
        expect(google.getPlaceDetails).toHaveBeenCalledTimes(1);
    });

    it('la reseña queda asociada al usuario y al café', async () =>
    {
        const user = await createUser();
        const cafe = seedExistingCafe();

        const res = await post('/reviews', user.token, reviewBody(EXISTING_PLACE_ID, { coffeeRating: 4 }));

        expect(res.status).toBe(201);
        expect(db.reviews.rows[0]).toMatchObject({
            userId: user.id,
            cafeId: cafe.id,
            rating: 5,
            comment: 'Muy buen café',
            coffeeRating: 4,
        });
    });
});

describe('POST /reviews: Wi-Fi y enchufes', () =>
{
    it('guarda las respuestas de Wi-Fi y enchufes', async () =>
    {
        const user = await createUser();
        seedExistingCafe();

        const res = await post('/reviews', user.token, reviewBody(EXISTING_PLACE_ID, {
            hasWifi: true,
            hasPowerOutlets: false,
        }));

        expect(res.status).toBe(201);
        expect(db.reviews.rows[0]).toMatchObject({ hasWifi: true, hasPowerOutlets: false });
    });

    it('son opcionales: sin responderlas quedan en null', async () =>
    {
        const user = await createUser();
        seedExistingCafe();

        const res = await post('/reviews', user.token, reviewBody(EXISTING_PLACE_ID));

        expect(res.status).toBe(201);
        expect(db.reviews.rows[0]).toMatchObject({ hasWifi: null, hasPowerOutlets: null });
    });

    it('400 si no son sí o no', async () =>
    {
        const user = await createUser();
        seedExistingCafe();

        expect((await post('/reviews', user.token, reviewBody(EXISTING_PLACE_ID, { hasWifi: 'sí' }))).status).toBe(400);
        expect((await post('/reviews', user.token, reviewBody(EXISTING_PLACE_ID, { hasPowerOutlets: 1 }))).status).toBe(400);
        expect(db.reviews.rows).toHaveLength(0);
    });

    it('reintentar con la misma clave pero otra respuesta de Wi-Fi da 409', async () =>
    {
        const user = await createUser();
        const idempotencyKey = '3c7f1dd0-5b6f-4c9a-8a2f-2d3e4f5a6b7c';

        expect((await post('/reviews', user.token, reviewBody(NEW_PLACE_ID, { idempotencyKey, hasWifi: true }))).status).toBe(201);
        expect((await post('/reviews', user.token, reviewBody(NEW_PLACE_ID, { idempotencyKey, hasWifi: false }))).status).toBe(409);
    });
});

describe('POST /favorites', () =>
{
    it('devuelve el favorito con el café de la base', async () =>
    {
        const user = await createUser();
        seedExistingCafe();

        const res = await post('/favorites', user.token, { googlePlaceId: EXISTING_PLACE_ID, ...clientCafeFields });

        expect(res.status).toBe(201);
        expect(res.body.cafe).toMatchObject({
            googlePlaceId: EXISTING_PLACE_ID,
            name: 'Nombre real',
        });
        expect(db.favorites.rows).toHaveLength(1);
    });

    it('agregar dos veces el mismo favorito no lo duplica', async () =>
    {
        const user = await createUser();
        seedExistingCafe();

        await post('/favorites', user.token, { googlePlaceId: EXISTING_PLACE_ID });
        await post('/favorites', user.token, { googlePlaceId: EXISTING_PLACE_ID });

        expect(db.favorites.rows).toHaveLength(1);
    });
});

describe('POST /cafes', () =>
{
    it('ya no existe', async () =>
    {
        const res = await request(app)
            .post('/cafes')
            .send({ googlePlaceId: 'x', name: 'x', address: 'x', latitude: 0, longitude: 0 });

        expect(res.status).toBe(404);
        expect(db.cafes.rows).toHaveLength(0);
    });
});
