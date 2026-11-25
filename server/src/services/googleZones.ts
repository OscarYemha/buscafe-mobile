import 'dotenv/config';
import { GooglePlaceNotFoundError } from './googlePlaces.js';

/*
 * Zonas (barrios, ciudades, provincias) para "Elegir zona": buscar
 * cafeterías en otro lugar que no sea la ubicación del usuario.
 *
 * Son dos llamadas a Google Places (API nueva):
 *   1. Autocomplete con el filtro "(regions)": sugerencias mientras se
 *      escribe, sin comercios.
 *   2. Place Details: las coordenadas de la zona elegida.
 *
 * Las dos aceptan el mismo sessionToken. Google agrupa en una sesión las
 * sugerencias de una búsqueda con el detalle final, y eso baja el costo.
 */

const GOOGLE_AUTOCOMPLETE_URL = 'https://places.googleapis.com/v1/places:autocomplete';
const GOOGLE_PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';

// Un país entero no sirve como zona: la búsqueda de cafés es por radio.
const EXCLUDED_ZONE_TYPES = new Set(['country']);

// Máximo que admite Google para locationBias.
const LOCATION_BIAS_RADIUS_METERS = 50_000;

export type Coordinates = {
    latitude: number;
    longitude: number;
};

export type ZoneSuggestion = {
    placeId: string;
    /** "Palermo" */
    name: string;
    /** "Buenos Aires, Argentina" (puede venir vacío). */
    description: string;
};

export type Zone = ZoneSuggestion & {
    latitude: number;
    longitude: number;
};

type AutocompleteResponse = {
    suggestions?: {
        placePrediction?: {
            placeId?: string;
            types?: string[];
            text?: { text?: string };
            structuredFormat?: {
                mainText?: { text?: string };
                secondaryText?: { text?: string };
            };
        };
    }[];
};

type ZoneDetailsResponse = {
    id?: string;
    displayName?: { text?: string };
    formattedAddress?: string;
    location?: { latitude?: number; longitude?: number };
};

function getApiKey(): string
{
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey)
    {
        throw new Error('GOOGLE_PLACES_API_KEY no está definida');
    }

    return apiKey;
}

/**
 * `near` es opcional: con la ubicación del usuario, Google prioriza las
 * zonas cercanas ("Palermo" de Buenos Aires antes que el de Italia) sin
 * excluir las demás.
 */
export async function searchZones(
    query: string,
    sessionToken?: string,
    near?: Coordinates
): Promise<ZoneSuggestion[]>
{
    const response = await fetch(GOOGLE_AUTOCOMPLETE_URL, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'X-Goog-Api-Key': getApiKey(),
            'X-Goog-FieldMask': [
                'suggestions.placePrediction.placeId',
                'suggestions.placePrediction.types',
                'suggestions.placePrediction.text',
                'suggestions.placePrediction.structuredFormat',
            ].join(','),
        },
        body: JSON.stringify({
            input: query,
            includedPrimaryTypes: ['(regions)'],
            languageCode: 'es',
            ...(sessionToken ? { sessionToken } : {}),
            ...(near
                ? {
                    locationBias: {
                        circle: {
                            center: near,
                            radius: LOCATION_BIAS_RADIUS_METERS,
                        },
                    },
                }
                : {}),
        }),
    });

    if (!response.ok)
    {
        throw new Error(
            `Error de Google Autocomplete: ${response.status} ${await response.text()}`
        );
    }

    const data: AutocompleteResponse = await response.json();

    return (data.suggestions ?? []).flatMap(({ placePrediction }) =>
    {
        const placeId = placePrediction?.placeId;
        const name =
            placePrediction?.structuredFormat?.mainText?.text ??
            placePrediction?.text?.text;
        const types = placePrediction?.types ?? [];

        if (
            !placeId ||
            !name ||
            types.some((type) => EXCLUDED_ZONE_TYPES.has(type))
        )
        {
            return [];
        }

        return [{
            placeId,
            name,
            description:
                placePrediction?.structuredFormat?.secondaryText?.text ?? '',
        }];
    });
}

export async function getZone(
    placeId: string,
    sessionToken?: string
): Promise<Zone>
{
    const params = new URLSearchParams({ languageCode: 'es' });

    if (sessionToken)
    {
        params.set('sessionToken', sessionToken);
    }

    const response = await fetch(
        `${GOOGLE_PLACE_DETAILS_URL}/${encodeURIComponent(placeId)}?${params}`,
        {
            method: 'GET',
            headers: {
                'X-Goog-Api-Key': getApiKey(),
                'X-Goog-FieldMask': 'id,displayName,formattedAddress,location',
            },
        }
    );

    if (!response.ok)
    {
        const errorBody = await response.text();

        // Mismo criterio que getPlaceDetails: 404, o 400 por ID mal formado
        // (si menciona la API key es un problema de configuración).
        if (
            response.status === 404 ||
            (
                response.status === 400 &&
                errorBody.includes('INVALID_ARGUMENT') &&
                !errorBody.includes('API_KEY')
            )
        )
        {
            throw new GooglePlaceNotFoundError(placeId);
        }

        throw new Error(
            `Error de Google Place Details: ${response.status} ${errorBody}`
        );
    }

    const place: ZoneDetailsResponse = await response.json();
    const latitude = place.location?.latitude;
    const longitude = place.location?.longitude;
    const name = place.displayName?.text;

    if (
        typeof latitude !== 'number' ||
        typeof longitude !== 'number' ||
        !name
    )
    {
        throw new GooglePlaceNotFoundError(placeId);
    }

    return {
        placeId: place.id ?? placeId,
        name,
        description: describeZone(name, place.formattedAddress),
        latitude,
        longitude,
    };
}

/**
 * "Palermo, Buenos Aires, Argentina" → "Buenos Aires, Argentina": el resto
 * de la dirección, sin repetir el nombre de la zona.
 */
function describeZone(name: string, formattedAddress?: string): string
{
    if (!formattedAddress)
    {
        return '';
    }

    const parts = formattedAddress.split(',').map((part) => part.trim());

    return (parts[0] === name ? parts.slice(1) : parts)
        .filter(Boolean)
        .join(', ');
}
