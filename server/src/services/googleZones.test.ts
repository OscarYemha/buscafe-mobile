import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { getZone, searchZones } from './googleZones.js';
import { GooglePlaceNotFoundError } from './googlePlaces.js';

const jsonResponse = (status: number, body: unknown) =>
    new Response(
        typeof body === 'string' ? body : JSON.stringify(body),
        { status }
    );

const mockFetch = (status: number, body: unknown) =>
{
    const fetchMock = vi.fn().mockResolvedValue(jsonResponse(status, body));
    vi.stubGlobal('fetch', fetchMock);
    return fetchMock;
};

const prediction = (
    placeId: string,
    mainText: string,
    secondaryText: string | undefined,
    types: string[]
) => ({
    placePrediction: {
        placeId,
        types,
        text: { text: [mainText, secondaryText].filter(Boolean).join(', ') },
        structuredFormat: {
            mainText: { text: mainText },
            ...(secondaryText ? { secondaryText: { text: secondaryText } } : {}),
        },
    },
});

beforeEach(() =>
{
    process.env.GOOGLE_PLACES_API_KEY = 'test-key';
});

afterEach(() =>
{
    vi.unstubAllGlobals();
});

describe('searchZones', () =>
{
    it('pide solo regiones, en castellano y con el token de sesión', async () =>
    {
        const fetchMock = mockFetch(200, { suggestions: [] });

        await searchZones('Pale', 'token-123');

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe('https://places.googleapis.com/v1/places:autocomplete');
        expect(init.method).toBe('POST');
        expect(init.headers['X-Goog-Api-Key']).toBe('test-key');
        expect(JSON.parse(init.body)).toEqual({
            input: 'Pale',
            includedPrimaryTypes: ['(regions)'],
            languageCode: 'es',
            sessionToken: 'token-123',
        });
    });

    it('no manda sessionToken si no vino', async () =>
    {
        const fetchMock = mockFetch(200, {});

        await searchZones('Pale');

        expect(JSON.parse(fetchMock.mock.calls[0][1].body)).not.toHaveProperty('sessionToken');
    });

    it('con la ubicación del usuario, prioriza zonas cercanas (sin excluir las demás)', async () =>
    {
        const fetchMock = mockFetch(200, {});

        await searchZones('Pale', undefined, { latitude: -34.6, longitude: -58.38 });

        expect(JSON.parse(fetchMock.mock.calls[0][1].body).locationBias).toEqual({
            circle: { center: { latitude: -34.6, longitude: -58.38 }, radius: 50_000 },
        });
    });

    it('devuelve nombre y descripción, y descarta países y sugerencias incompletas', async () =>
    {
        mockFetch(200, {
            suggestions: [
                prediction('palermo', 'Palermo', 'Buenos Aires, Argentina', ['sublocality', 'political']),
                prediction('italia', 'Palermo', 'Italia', ['locality', 'political']),
                prediction('argentina', 'Argentina', undefined, ['country', 'political']),
                { placePrediction: { types: ['locality'] } },
                {},
            ],
        });

        expect(await searchZones('Palermo')).toEqual([
            { placeId: 'palermo', name: 'Palermo', description: 'Buenos Aires, Argentina' },
            { placeId: 'italia', name: 'Palermo', description: 'Italia' },
        ]);
    });

    it('sin sugerencias devuelve una lista vacía', async () =>
    {
        mockFetch(200, {});

        expect(await searchZones('zzzz')).toEqual([]);
    });

    it('un error de Google es un error genérico', async () =>
    {
        mockFetch(403, 'PERMISSION_DENIED');

        await expect(searchZones('Palermo')).rejects.toThrow('Error de Google Autocomplete: 403');
    });
});

describe('getZone', () =>
{
    const details = {
        id: 'palermo',
        displayName: { text: 'Palermo' },
        formattedAddress: 'Palermo, Buenos Aires, Argentina',
        location: { latitude: -34.5889, longitude: -58.4304 },
    };

    it('pide solo los campos necesarios y manda el token de sesión', async () =>
    {
        const fetchMock = mockFetch(200, details);

        await getZone('palermo', 'token-123');

        const [url, init] = fetchMock.mock.calls[0];
        expect(url).toBe(
            'https://places.googleapis.com/v1/places/palermo?languageCode=es&sessionToken=token-123'
        );
        expect(init.headers['X-Goog-FieldMask']).toBe('id,displayName,formattedAddress,location');
    });

    it('devuelve las coordenadas y la descripción sin repetir el nombre', async () =>
    {
        mockFetch(200, details);

        expect(await getZone('palermo')).toEqual({
            placeId: 'palermo',
            name: 'Palermo',
            description: 'Buenos Aires, Argentina',
            latitude: -34.5889,
            longitude: -58.4304,
        });
    });

    it('lugar inexistente (404) o ID mal formado (400) es GooglePlaceNotFoundError', async () =>
    {
        mockFetch(404, 'NOT_FOUND');
        await expect(getZone('x')).rejects.toBeInstanceOf(GooglePlaceNotFoundError);

        mockFetch(400, '{"error":{"status":"INVALID_ARGUMENT"}}');
        await expect(getZone('x')).rejects.toBeInstanceOf(GooglePlaceNotFoundError);
    });

    it('API key inválida es un error genérico, no "zona inexistente"', async () =>
    {
        mockFetch(400, '{"error":{"status":"INVALID_ARGUMENT","details":[{"reason":"API_KEY_INVALID"}]}}');

        const error = await getZone('palermo').catch((e: unknown) => e);

        expect(error).toBeInstanceOf(Error);
        expect(error).not.toBeInstanceOf(GooglePlaceNotFoundError);
    });

    it('sin coordenadas no sirve como zona', async () =>
    {
        mockFetch(200, { ...details, location: undefined });

        await expect(getZone('palermo')).rejects.toBeInstanceOf(GooglePlaceNotFoundError);
    });
});
