export type CafeSummary = {
    googlePlaceId: string;
    name: string;
    address: string;
    shortAddress: string;
    neighborhood: string | null;
    city: string | null;
    latitude: number;
    longitude: number;

    googleRating: number | null;
    googleReviewsCount: number;

    buscafeRating: number | null;
    buscafeReviewsCount: number;

    distanceKm: number | null;
    priceLevel: number | null;
    isOpen: boolean | null;
    allowsDogs: boolean | null;
    servesVegetarianFood: boolean | null;
};