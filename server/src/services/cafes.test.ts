import { beforeEach, describe, expect, it, vi } from 'vitest';
import { Prisma } from '../generated/prisma/client.js';
import type { GooglePlace } from '../types/googlePlaces.js';
import {
    CafeLookupError,
    CafeNotFoundError,
    findOrCreateCafe,
    isValidGooglePlaceId,
} from './cafes.js';
import { GooglePlaceNotFoundError } from './googlePlaces.js';

const mocks = vi.hoisted(() => ({
    findUnique: vi.fn(),
    create: vi.fn(),
    getPlaceDetails: vi.fn(),
}));

vi.mock('../lib/prisma.js', () => ({
    default: {
        cafe: {
            findUnique: mocks.findUnique,
            create: mocks.create,
        },
    },
}));

vi.mock('./googlePlaces.js', async (importOriginal) => ({
    ...(await importOriginal<typeof import('./googlePlaces.js')>()),
    getPlaceDetails: mocks.getPlaceDetails,
}));

const existingCafe = {
    id: 7,
    googlePlaceId: 'ChIJ_existing',
    name: 'Nombre real',
    address: 'Dirección real 123',
    latitude: -34.6,
    longitude: -58.4,
    createdAt: new Date(),
};

const googlePlace = (overrides: Partial<GooglePlace> = {}): GooglePlace => ({
    id: 'ChIJ_new',
    displayName: { text: 'Café de Google' },
    formattedAddress: 'Av. Siempre Viva 742, CABA',
    location: { latitude: -34.61, longitude: -58.38 },
    ...overrides,
} as GooglePlace);

describe('findOrCreateCafe', () =>
{
    beforeEach(() =>
    {
        vi.resetAllMocks();
        vi.restoreAllMocks();
        mocks.create.mockImplementation(async ({ data }) => ({
            id: 8,
            createdAt: new Date(),
            ...data,
        }));
    });

    it('devuelve el café existente sin consultar Google ni modificarlo', async () =>
    {
        mocks.findUnique.mockResolvedValue(existingCafe);

        await expect(findOrCreateCafe('ChIJ_existing')).resolves.toBe(existingCafe);
        expect(mocks.getPlaceDetails).not.toHaveBeenCalled();
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('crea un café nuevo con los datos de Google', async () =>
    {
        mocks.findUnique.mockResolvedValue(null);
        mocks.getPlaceDetails.mockResolvedValue(googlePlace());

        const cafe = await findOrCreateCafe('ChIJ_new');

        expect(mocks.getPlaceDetails).toHaveBeenCalledWith('ChIJ_new');
        expect(mocks.create).toHaveBeenCalledWith({
            data: {
                googlePlaceId: 'ChIJ_new',
                name: 'Café de Google',
                address: 'Av. Siempre Viva 742, CABA',
                latitude: -34.61,
                longitude: -58.38,
            },
        });
        expect(cafe.id).toBe(8);
    });

    it('guarda el café con el ID pedido aunque Google devuelva otro', async () =>
    {
        mocks.findUnique.mockResolvedValue(null);
        mocks.getPlaceDetails.mockResolvedValue(googlePlace({ id: 'ChIJ_migrated' }));

        await findOrCreateCafe('ChIJ_old');

        expect(mocks.create.mock.calls[0]![0].data.googlePlaceId).toBe('ChIJ_old');
    });

    it('lanza CafeNotFoundError si Google no conoce el lugar', async () =>
    {
        mocks.findUnique.mockResolvedValue(null);
        mocks.getPlaceDetails.mockRejectedValue(new GooglePlaceNotFoundError('ChIJ_x'));

        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(findOrCreateCafe('ChIJ_x')).rejects.toBeInstanceOf(CafeNotFoundError);
        expect(mocks.create).not.toHaveBeenCalled();
        expect(warn).toHaveBeenCalledWith(expect.stringContaining('ChIJ_x'));
    });

    it('un error de API key no se loguea como "no encontrado"', async () =>
    {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => {});
        mocks.findUnique.mockResolvedValue(null);
        mocks.getPlaceDetails.mockRejectedValue(
            new Error('Error de Google Place Details: 400 ... API_KEY_INVALID')
        );

        await expect(findOrCreateCafe('ChIJ_x')).rejects.toBeInstanceOf(CafeLookupError);
        expect(warn).not.toHaveBeenCalled();
    });

    it('lanza CafeNotFoundError si al lugar le faltan datos', async () =>
    {
        mocks.findUnique.mockResolvedValue(null);
        const { location: _omitted, ...withoutLocation } = googlePlace();
        mocks.getPlaceDetails.mockResolvedValue(withoutLocation);
        vi.spyOn(console, 'warn').mockImplementation(() => {});

        await expect(findOrCreateCafe('ChIJ_x')).rejects.toBeInstanceOf(CafeNotFoundError);
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('otros errores de Google se reportan como CafeLookupError', async () =>
    {
        mocks.findUnique.mockResolvedValue(null);
        mocks.getPlaceDetails.mockRejectedValue(new Error('Error de Google Place Details: 503'));

        await expect(findOrCreateCafe('ChIJ_x')).rejects.toBeInstanceOf(CafeLookupError);
        expect(mocks.create).not.toHaveBeenCalled();
    });

    it('los errores de la base no se disfrazan de error de Google', async () =>
    {
        const dbError = new Error('connection refused');
        mocks.findUnique.mockRejectedValue(dbError);

        await expect(findOrCreateCafe('ChIJ_x')).rejects.toBe(dbError);
    });

    it('si otra request lo creó a la vez (P2002), devuelve el existente', async () =>
    {
        mocks.findUnique
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(existingCafe);
        mocks.getPlaceDetails.mockResolvedValue(googlePlace());
        mocks.create.mockRejectedValue(
            new Prisma.PrismaClientKnownRequestError('Unique constraint', {
                code: 'P2002',
                clientVersion: 'test',
            })
        );

        await expect(findOrCreateCafe('ChIJ_existing')).resolves.toBe(existingCafe);
    });
});

describe('isValidGooglePlaceId', () =>
{
    it('acepta IDs de Google y rechaza el resto', () =>
    {
        expect(isValidGooglePlaceId('ChIJN1t_tDeuEmsRUsoyG83frY4')).toBe(true);
        expect(isValidGooglePlaceId('')).toBe(false);
        expect(isValidGooglePlaceId('../photos')).toBe(false);
        expect(isValidGooglePlaceId('abc?key=1')).toBe(false);
        expect(isValidGooglePlaceId('a'.repeat(301))).toBe(false);
        expect(isValidGooglePlaceId(123)).toBe(false);
    });
});
