import { CafeSummary } from '../types/CafeSummary';

let counter = 0;

/** Un café con valores neutros; se pisan solo los campos que importan en cada test. */
export function makeCafe(overrides: Partial<CafeSummary> = {}): CafeSummary
{
    counter++;

    return {
        googlePlaceId: `place-${counter}`,
        name: `Café ${counter}`,
        address: 'Dirección',
        shortAddress: 'Dirección',
        neighborhood: null,
        city: null,
        latitude: -34.6,
        longitude: -58.4,
        googleRating: null,
        googleReviewsCount: 0,
        buscafeRating: null,
        buscafeReviewsCount: 0,
        coffeeRating: null,
        foodRating: null,
        goodForWorkPercentage: null,
        goodForStudyPercentage: null,
        goodForDatePercentage: null,
        goodForWorkCount: 0,
        goodForStudyCount: 0,
        goodForDateCount: 0,
        distanceKm: null,
        priceLevel: null,
        isOpen: null,
        allowsDogs: null,
        ...overrides,
    };
}
