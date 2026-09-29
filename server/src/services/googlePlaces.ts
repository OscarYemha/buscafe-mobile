import 'dotenv/config';
import {
    GooglePlace,
    GoogleTextSearchResponse,
} from '../types/googlePlaces.js';
import {
    calculateDistanceKm,
} from '../utils/distance.js';


const GOOGLE_TEXT_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';
const GOOGLE_NEARBY_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchNearby';
const GOOGLE_PLACE_DETAILS_URL = 'https://places.googleapis.com/v1/places';

const SEARCH_RADIUS_KM = 1;
const METERS_PER_KM = 1000;
const PAGE_SIZE = 20;
const MAX_PAGES = 3;

const CAFE_TYPES = new Set([
    'coffee_shop',
    'cafe',
    'cafeteria',
]);

const EXCLUDED_PRIMARY_TYPES = new Set([
    'gas_station',
    'restaurant',
    'fast_food_restaurant',
    'pizza_restaurant',
    'hamburger_restaurant',
    'bar',
    'gastropub',
]);

const EXCLUDED_NAME_PATTERNS = [
    /\bestaci[oó]n\s+(de\s+)?servicio\b/i,
    /\bestaci[oó]n\s+gnc\b/i,
];

type GooglePlaceSearchPage = {
    places: GooglePlace[];
    nextPageToken: string | null;
};

export type CafeSearchResult = {
    places: GooglePlace[];
    nextPageToken: string | null;
    resolvedQuery: string;
};

function isCafe(place: GooglePlace): boolean {
    const types = place.types ?? [];

    const hasCafeType =
        types.some(
            (type) => CAFE_TYPES.has(type)
        );

    if (!hasCafeType) {
        return false;
    }

    const primaryType =
        place.primaryType;

    const primaryIsCafe =
        primaryType !== undefined &&
        CAFE_TYPES.has(primaryType);

    const hasCoffeeShopAndCafe =
        types.includes('coffee_shop') &&
        types.includes('cafe');

    if (
        primaryType &&
        EXCLUDED_PRIMARY_TYPES.has(primaryType) &&
        !primaryIsCafe &&
        !hasCoffeeShopAndCafe
    ) {
        return false;
    }

        const name =
            place.displayName?.text ?? '';

        if (
            EXCLUDED_NAME_PATTERNS.some(
                (pattern) => pattern.test(name)
            )
        ) {
            return false;
        }

        return true;
    }

async function searchCafesByText(
    latitude: number,
    longitude: number,
    pageToken?: string
): Promise<GoogleTextSearchResponse> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        throw new Error(
            'GOOGLE_PLACES_API_KEY no está definida'
        );
    }

    const response = await fetch(
        GOOGLE_TEXT_SEARCH_URL,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': [
                    'places.id',
                    'places.displayName',
                    'places.formattedAddress',
                    'places.addressComponents',
                    'places.location',
                    'places.types',
                    'places.primaryType',
                    'places.primaryTypeDisplayName',
                    'places.googleMapsTypeLabel',
                    'places.rating',
                    'places.userRatingCount',
                    'places.priceLevel',
                    'places.allowsDogs',
                    'places.currentOpeningHours.openNow',
                    'nextPageToken',
                ].join(','),
            },
            body: JSON.stringify({
                textQuery: 'cafeterías',
                pageSize: PAGE_SIZE,
                rankPreference: 'DISTANCE',
                locationBias: {
                    circle: {
                        center: {
                            latitude,
                            longitude,
                        },
                        radius:
                            SEARCH_RADIUS_KM *
                            METERS_PER_KM,
                    },
                },
                languageCode: 'es',
                regionCode: 'AR',
                ...(pageToken && {
                    pageToken,
                }),
            }),
        }
    );

    if (!response.ok) {
        const errorBody =
            await response.text();

        throw new Error(
            `Error de Google Text Search: ` +
            `${response.status} ${errorBody}`
        );
    }

    const data: GoogleTextSearchResponse =
        await response.json();

    return data;
}

export async function searchAllCafesByText(
    latitude: number,
    longitude: number
): Promise<GooglePlace[]> {
    const places: GooglePlace[] = [];

    let pageToken: string | undefined;
    let pageCount = 0;

    do {
        pageCount++;
        const response =
            await searchCafesByText(
                latitude,
                longitude,
                pageToken
            );

        places.push(
            ...(response.places ?? [])
        );

        pageToken =
            response.nextPageToken;
    }
    while (
        pageToken &&
        pageCount < MAX_PAGES
    );

    const uniquePlaces =
        Array.from(
            new Map(
                places.map((place) => [
                    place.id,
                    place,
                ])
            ).values()
        );

    const nearbyPlaces =
        uniquePlaces.filter((place) => {
            if (
                !place.location ||
                !isCafe(place)
            ) {
                return false;
            }

            const distanceKm =
                calculateDistanceKm(
                    latitude,
                    longitude,
                    place.location.latitude,
                    place.location.longitude
                );

            return distanceKm <= SEARCH_RADIUS_KM;
        });

    return nearbyPlaces;
}

interface NearbySearchPoint {
    latitude: number;
    longitude: number;
}

async function searchNearbyAtPoint(
    point: NearbySearchPoint,
    radiusMeters: number
): Promise<GooglePlace[]> {
    const apiKey = process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        throw new Error(
            'GOOGLE_PLACES_API_KEY no está configurada'
        );
    }

    const response = await fetch(
        GOOGLE_NEARBY_SEARCH_URL,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': [
                    'places.id',
                    'places.displayName',
                    'places.formattedAddress',
                    'places.addressComponents',
                    'places.location',
                    'places.types',
                    'places.primaryType',
                    'places.primaryTypeDisplayName',
                    'places.googleMapsTypeLabel',
                    'places.rating',
                    'places.userRatingCount',
                    'places.priceLevel',
                    'places.allowsDogs',
                    'places.currentOpeningHours.openNow',
                ].join(','),
            },
            body: JSON.stringify({
                includedTypes: [
                    'coffee_shop',
                    'cafe',
                    'cafeteria',
                ],
                maxResultCount: 20,
                rankPreference: 'DISTANCE',
                locationRestriction: {
                    circle: {
                        center: point,
                        radius: radiusMeters,
                    },
                },
                languageCode: 'es',
                regionCode: 'AR',
            }),
        }
    );

    if (!response.ok) {
        const errorBody = await response.text();

        throw new Error(
            `Google Places Nearby Search falló: ${response.status} ${errorBody}`
        );
    }

    const data =
        (await response.json()) as GoogleTextSearchResponse;

    return data.places ?? [];
}

export async function searchCafesNearby(
    latitude: number,
    longitude: number
): Promise<GooglePlace[]> {
    const offsetLatitude = 0.0045;

    const offsetLongitude =
        0.0045 /
        Math.cos(latitude * Math.PI / 180);

    const searchPoints: NearbySearchPoint[] = [
        {
            latitude,
            longitude,
        },
        {
            latitude: latitude + offsetLatitude,
            longitude,
        },
        {
            latitude: latitude - offsetLatitude,
            longitude,
        },
        {
            latitude,
            longitude: longitude + offsetLongitude,
        },
        {
            latitude,
            longitude: longitude - offsetLongitude,
        },
    ];

    const results = await Promise.all(
        searchPoints.map((point) =>
            searchNearbyAtPoint(
                point,
                600
            )
        )
    );

    const uniquePlaces = new Map<string, GooglePlace>();

    for (const places of results) {
        for (const place of places) {
            if (place.id) {
                uniquePlaces.set(
                    place.id,
                    place
                );
            }
        }
    }

    const nearbyPlaces =
        Array.from(uniquePlaces.values())
            .filter((place) => {
                if (!place.location) {
                    return false;
                }

                const distanceKm =
                    calculateDistanceKm(
                        latitude,
                        longitude,
                        place.location.latitude,
                        place.location.longitude
                    );

                return (
                    distanceKm <= SEARCH_RADIUS_KM
                );
            });

    return nearbyPlaces.filter(isCafe);
}

async function searchPlacesByQuery(
    query: string,
    pageToken?: string
): Promise<GooglePlaceSearchPage> {
    const apiKey =
        process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey)
    {
        throw new Error(
            'GOOGLE_PLACES_API_KEY no está definida'
        );
    }

    const response = await fetch(
        GOOGLE_TEXT_SEARCH_URL,
        {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': [
                    'places.id',
                    'places.displayName',
                    'places.formattedAddress',
                    'places.addressComponents',
                    'places.location',
                    'places.types',
                    'places.primaryType',
                    'places.primaryTypeDisplayName',
                    'places.googleMapsTypeLabel',
                    'places.rating',
                    'places.userRatingCount',
                    'places.priceLevel',
                    'places.allowsDogs',
                    'places.currentOpeningHours.openNow',
                    'nextPageToken',
                ].join(','),
            },
            body: JSON.stringify({
                textQuery: query,
                pageSize: 20,
                languageCode: 'es',
                regionCode: 'AR',
                ...(pageToken && {
                    pageToken,
                }),
            }),
        }
    );

    if (!response.ok)
    {
        const errorBody =
            await response.text();

        throw new Error(
            `Error de Google Text Search: ` +
            `${response.status} ${errorBody}`
        );
    }

    const data: GoogleTextSearchResponse =
        await response.json();

    return {
        places: data.places ?? [],
        nextPageToken: data.nextPageToken ?? null,
    };
}

export async function searchCafes(
    query: string,
    pageToken?: string,
    resolvedQuery?: string
): Promise<CafeSearchResult> {
    const normalizedQuery =
        query.trim();

    if (pageToken && resolvedQuery)
    {
        const page =
            await searchPlacesByQuery(
                resolvedQuery,
                pageToken
            );

        return {
            places: page.places.filter((place) =>
                place.location &&
                isCafe(place)
            ),
            nextPageToken:
                page.nextPageToken ?? null,
            resolvedQuery,
        };
    }

    const directPage =
        await searchPlacesByQuery(
            normalizedQuery
        );

    const directCafes =
        directPage.places.filter((place) =>
            place.location &&
            isCafe(place)
        );

    if (directCafes.length > 0)
    {
        return {
            places: directCafes,
            nextPageToken:
                directPage.nextPageToken ?? null,
            resolvedQuery: normalizedQuery,
        };
    }

    const areaQuery =
        `cafeterías en ${normalizedQuery}`;

    const areaPage =
        await searchPlacesByQuery(
            areaQuery
        );

    return {
        places: areaPage.places.filter((place) =>
            place.location &&
            isCafe(place)
        ),
        nextPageToken:
            areaPage.nextPageToken ?? null,
        resolvedQuery: areaQuery,
    };
}

export async function getPlaceDetails(
    googlePlaceId: string
): Promise<GooglePlace> {
    const apiKey =
        process.env.GOOGLE_PLACES_API_KEY;

    if (!apiKey) {
        throw new Error(
            'GOOGLE_PLACES_API_KEY no está definida'
        );
    }

    const response = await fetch(
        `${GOOGLE_PLACE_DETAILS_URL}/${encodeURIComponent(googlePlaceId)}` +
        `?languageCode=es&regionCode=AR`,
        {
            method: 'GET',
            headers: {
                'X-Goog-Api-Key': apiKey,
                'X-Goog-FieldMask': [
                    'id',
                    'displayName',
                    'formattedAddress',
                    'addressComponents',
                    'location',
                    'types',
                    'primaryType',
                    'primaryTypeDisplayName',
                    'googleMapsTypeLabel',
                    'rating',
                    'userRatingCount',
                    'priceLevel',
                    'allowsDogs',
                    'currentOpeningHours',
                    'regularOpeningHours',
                    'websiteUri',
                    'nationalPhoneNumber',
                    'googleMapsUri',
                ].join(','),
            },
        }
    );

    if (!response.ok) {
        const errorBody =
            await response.text();

        throw new Error(
            `Error de Google Place Details: ` +
            `${response.status} ${errorBody}`
        );
    }

    const place: GooglePlace =
        await response.json();

    return place;
}
