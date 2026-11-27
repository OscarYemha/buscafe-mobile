import { AmenityStats } from '../utils/amenities';


import { CafeSummary } from './CafeSummary';

export type CafeReview = {
    id: number;
    rating: number;
    comment: string;
    createdAt: string;
    editedAt: string | null;

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

    // Opcionales: un server sin este cambio no los manda.
    coffeeRatingsCount?: number;
    foodRatingsCount?: number;
    serviceRatingsCount?: number;
    comfortRatingsCount?: number;
    quietRatingsCount?: number;

    wifi?: AmenityStats;
    powerOutlets?: AmenityStats;

    currentOpeningHours: string[];
    regularOpeningHours: string[];

    website: string | null;
    phone: string | null;
    googleMapsUrl: string | null;

    // Servicios y modalidades de atención
    delivery: boolean | null;
    takeout: boolean | null;
    dineIn: boolean | null;
    curbsidePickup: boolean | null;
    outdoorSeating: boolean | null;
    reservable: boolean | null;

    // Comidas y bebidas
    servesBreakfast: boolean | null;
    servesBrunch: boolean | null;
    servesLunch: boolean | null;
    servesDinner: boolean | null;
    servesCoffee: boolean | null;
    servesDessert: boolean | null;
    servesVegetarianFood: boolean | null;

    // Instalaciones y ambiente
    restroom: boolean | null;
    liveMusic: boolean | null;
    goodForChildren: boolean | null;
    menuForChildren: boolean | null;

    // Accesibilidad
    accessibilityOptions: {
        wheelchairAccessibleEntrance?: boolean;
        wheelchairAccessibleParking?: boolean;
        wheelchairAccessibleRestroom?: boolean;
        wheelchairAccessibleSeating?: boolean;
    } | null;

    // Estacionamiento
    parkingOptions: {
        freeParkingLot?: boolean;
        paidParkingLot?: boolean;
        freeStreetParking?: boolean;
        paidStreetParking?: boolean;
        valetParking?: boolean;
        freeGarageParking?: boolean;
        paidGarageParking?: boolean;
    } | null;

    // Medios de pago
    paymentOptions: {
        acceptsCreditCards?: boolean;
        acceptsDebitCards?: boolean;
        acceptsCashOnly?: boolean;
        acceptsNfc?: boolean;
    } | null;

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
