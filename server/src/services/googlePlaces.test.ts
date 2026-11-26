import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getPlaceDetails,
    GooglePlaceNotFoundError,
    shouldShowPlace,
} from './googlePlaces.js';
import type { GooglePlace } from '../types/googlePlaces.js';

const googleError = (code: number, status: string, message: string, reason?: string) =>
    JSON.stringify({
        error: {
            code,
            message,
            status,
            ...(reason
                ? { details: [{ '@type': 'type.googleapis.com/google.rpc.ErrorInfo', reason }] }
                : {}),
        },
    });

const respond = (status: number, body: string) =>
    vi.fn().mockResolvedValue(new Response(body, { status }));

describe('getPlaceDetails: errores de Google', () =>
{
    beforeEach(() =>
    {
        process.env.GOOGLE_PLACES_API_KEY = 'test-key';
    });

    afterEach(() =>
    {
        vi.unstubAllGlobals();
    });

    it('API key inválida (400 INVALID_ARGUMENT + API_KEY_INVALID) es un error genérico', async () =>
    {
        vi.stubGlobal('fetch', respond(400, googleError(
            400,
            'INVALID_ARGUMENT',
            'API key not valid. Please pass a valid API key.',
            'API_KEY_INVALID'
        )));

        const error = await getPlaceDetails('ChIJ_ok').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(GooglePlaceNotFoundError);
    });

    it('ID mal formado (400 INVALID_ARGUMENT sin API_KEY) es "no encontrado"', async () =>
    {
        vi.stubGlobal('fetch', respond(400, googleError(
            400,
            'INVALID_ARGUMENT',
            'Not a valid Place ID: ChIJ_bad'
        )));

        await expect(getPlaceDetails('ChIJ_bad'))
            .rejects.toBeInstanceOf(GooglePlaceNotFoundError);
    });

    it('404 NOT_FOUND es "no encontrado"', async () =>
    {
        vi.stubGlobal('fetch', respond(404, googleError(404, 'NOT_FOUND', 'Place not found')));

        await expect(getPlaceDetails('ChIJ_missing'))
            .rejects.toBeInstanceOf(GooglePlaceNotFoundError);
    });

    it.each([
        [403, 'PERMISSION_DENIED', 'API_KEY_SERVICE_BLOCKED'],
        [429, 'RESOURCE_EXHAUSTED', undefined],
        [503, 'UNAVAILABLE', undefined],
    ])('%i %s es un error genérico', async (code, status, reason) =>
    {
        vi.stubGlobal('fetch', respond(code, googleError(code, status, 'fallo', reason)));

        const error = await getPlaceDetails('ChIJ_ok').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(GooglePlaceNotFoundError);
    });
});

describe('shouldShowPlace: qué lugares de Google se listan', () =>
{
    const cafe = (extra: Partial<GooglePlace> = {}): GooglePlace => ({
        id: 'x',
        displayName: { text: 'Café de la esquina' },
        types: ['cafe', 'food', 'point_of_interest'],
        primaryType: 'cafe',
        userRatingCount: 25,
        businessStatus: 'OPERATIONAL',
        ...extra,
    } as GooglePlace);

    it('muestra una cafetería abierta como negocio y con reseñas', () =>
    {
        expect(shouldShowPlace(cafe())).toBe(true);
        expect(shouldShowPlace(cafe({ userRatingCount: 1 }))).toBe(true);
    });

    it('oculta los lugares sin reseñas en Google (suelen ser cargas falsas)', () =>
    {
        expect(shouldShowPlace(cafe({ userRatingCount: 0 }))).toBe(false);
        expect(shouldShowPlace(cafe({ userRatingCount: undefined }))).toBe(false);
    });

    it('oculta los cerrados permanentemente, pero no los cerrados temporalmente', () =>
    {
        expect(shouldShowPlace(cafe({ businessStatus: 'CLOSED_PERMANENTLY' }))).toBe(false);
        expect(shouldShowPlace(cafe({ businessStatus: 'CLOSED_TEMPORARILY' }))).toBe(true);
        expect(shouldShowPlace(cafe({ businessStatus: undefined }))).toBe(true);
    });

    it('sigue ocultando lo que no es cafetería', () =>
    {
        expect(shouldShowPlace(cafe({ types: ['restaurant'], primaryType: 'restaurant' }))).toBe(false);
        expect(shouldShowPlace(cafe({ primaryType: 'gas_station' }))).toBe(false);
        expect(shouldShowPlace(cafe({ displayName: { text: 'Estación de servicio YPF' } }))).toBe(false);
    });
});
