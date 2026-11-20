import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
    getPlaceDetails,
    GooglePlaceNotFoundError,
} from './googlePlaces.js';

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
