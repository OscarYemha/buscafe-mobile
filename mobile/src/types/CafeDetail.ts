import { CafeSummary } from './CafeSummary';

export type CafeReview = {
    id: number;
    rating: number;
    comment: string;
    createdAt: string;

    coffeeRating: number | null;
    foodRating: number | null;
    serviceRating: number | null;
    comfortRating: number | null;
    quietRating: number | null;

    goodForWork: boolean | null;
    goodForStudy: boolean | null;
    goodForDate: boolean | null;

    user: {
        id: number;
        name: string;
    } | null;
};

export type CafeDetail = CafeSummary & {
    buscafeReviews: CafeReview[];

    coffeeRating: number | null;
    foodRating: number | null;
    serviceRating: number | null;
    comfortRating: number | null;
    quietRating: number | null;

    goodForWorkPercentage: number | null;
    goodForStudyPercentage: number | null;
    goodForDatePercentage: number | null;

    goodForWorkCount: number;
    goodForStudyCount: number;
    goodForDateCount: number;

    currentOpeningHours: string[];
    regularOpeningHours: string[];

    website: string | null;
    phone: string | null;
    googleMapsUrl: string | null;

    photos: {
        name: string;
        url: string;
        widthPx: number | null;
        heightPx: number | null;
        authorAttributions: {
            displayName: string;
            uri: string;
            photoUri?: string;
        }[];
    }[];
};