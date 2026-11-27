import { GooglePlace } from '../types/googlePlaces';
import { CafeSummary } from '../types/CafeSummary';

function mapGooglePriceLevel(
    priceLevel?: string
): number | null {
    switch (priceLevel)
    {
        case 'PRICE_LEVEL_INEXPENSIVE':
            return 1;

        case 'PRICE_LEVEL_MODERATE':
            return 2;

        case 'PRICE_LEVEL_EXPENSIVE':
            return 3;

        case 'PRICE_LEVEL_VERY_EXPENSIVE':
            return 4;

        default:
            return null;
    }
}

function getNeighborhood(
    place: GooglePlace
): string | null {
    const components =
        place.addressComponents ?? [];

    const sublocality =
        components.find((component) =>
            component.types?.includes(
                'sublocality_level_1'
            )
        );

    if (sublocality)
    {
        return sublocality.longText;
    }

    const neighborhood =
        components.find((component) =>
            component.types?.includes(
                'neighborhood'
            )
        );

    return neighborhood?.longText ?? null;
}

function getShortAddress(
    place: GooglePlace
): string {
    const components =
        place.addressComponents ?? [];

    const route =
        components.find((component) =>
            component.types?.includes('route')
        )?.longText;

    const streetNumber =
        components.find((component) =>
            component.types?.includes(
                'street_number'
            )
        )?.longText;

    if (route && streetNumber === '&')
    {
        const crossStreet =
            components.find(
                (component) =>
                    !component.types ||
                    component.types.length === 0
            )?.longText;

        if (crossStreet)
        {
            return `${route} esquina ${crossStreet}`;
        }

        return route;
    }

    if (route && streetNumber)
    {
        return `${route} ${streetNumber}`;
    }

    if (route)
    {
        return route;
    }

    return place.formattedAddress ?? '';
}

function getCity(
    place: GooglePlace
): string | null {
    const components =
        place.addressComponents ?? [];

    const administrativeArea =
        components.find((component) =>
            component.types?.includes(
                'administrative_area_level_1'
            )
        );

    if (
        administrativeArea?.longText ===
        'Ciudad Autónoma de Buenos Aires'
    )
    {
        return 'CABA';
    }

    const locality =
        components.find((component) =>
            component.types?.includes(
                'locality'
            )
        );

    return (
        locality?.longText ??
        locality?.shortText ??
        null
    );
}

export function mapGooglePlaceToCafeSummary(
    place: GooglePlace
): CafeSummary | null {
    if (!place.displayName?.text || 
        !place.formattedAddress ||
        !place.location
    )
    {
        return null;
    }

    return {
        googlePlaceId: place.id,
        name: place.displayName.text,
        address: place.formattedAddress,
        shortAddress: getShortAddress(place),
        neighborhood: getNeighborhood(place),
        city: getCity(place),
        latitude: place.location.latitude,
        longitude: place.location.longitude,

        googleRating: place.rating?? null,
        googleReviewsCount: place.userRatingCount ?? 0,

        buscafeRating: null,
        buscafeReviewsCount: 0,

        distanceKm: null,
        priceLevel: mapGooglePriceLevel(place.priceLevel),
        isOpen: place.currentOpeningHours?.openNow ?? null,
        allowsDogs: place.allowsDogs ?? null,
        servesVegetarianFood: place.servesVegetarianFood ?? null,
    };
}