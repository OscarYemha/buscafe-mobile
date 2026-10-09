
export type GooglePlace = {
    id: string;

    displayName?: {
        text: string;
        languageCode?: string;
    };

    formattedAddress?: string;

    addressComponents?: {
        longText: string;
        shortText: string;
        types?: string[];
        languageCode?: string;
    }[];

    location?: {
        latitude: number;
        longitude: number;
    };

    types?: string[];

    primaryType?: string;

    primaryTypeDisplayName?: {
        text: string;
        languageCode?: string;
    };

    googleMapsTypeLabel?: {
        text: string;
        languageCode?: string;
    };

    rating?: number;
    userRatingCount?: number;
    priceLevel?: string;

    allowsDogs?: boolean;

    currentOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
    };

    regularOpeningHours?: {
        openNow?: boolean;
        weekdayDescriptions?: string[];
    };

    websiteUri?: string;
    nationalPhoneNumber?: string;
    googleMapsUri?: string;

    // Servicios y modalidades de atención
    delivery?: boolean;
    takeout?: boolean;
    dineIn?: boolean;
    curbsidePickup?: boolean;
    outdoorSeating?: boolean;
    reservable?: boolean;

    // Comidas y bebidas
    servesBreakfast?: boolean;
    servesBrunch?: boolean;
    servesLunch?: boolean;
    servesDinner?: boolean;
    servesCoffee?: boolean;
    servesDessert?: boolean;
    servesVegetarianFood?: boolean;

    // Instalaciones y ambiente
    restroom?: boolean;
    liveMusic?: boolean;
    goodForChildren?: boolean;
    menuForChildren?: boolean;

    // Accesibilidad
    accessibilityOptions?: {
        wheelchairAccessibleEntrance?: boolean;
        wheelchairAccessibleParking?: boolean;
        wheelchairAccessibleRestroom?: boolean;
        wheelchairAccessibleSeating?: boolean;
    };

    // Estacionamiento
    parkingOptions?: {
        freeParkingLot?: boolean;
        paidParkingLot?: boolean;
        freeStreetParking?: boolean;
        paidStreetParking?: boolean;
        valetParking?: boolean;
        freeGarageParking?: boolean;
        paidGarageParking?: boolean;
    };

    // Medios de pago
    paymentOptions?: {
        acceptsCreditCards?: boolean;
        acceptsDebitCards?: boolean;
        acceptsCashOnly?: boolean;
        acceptsNfc?: boolean;
    };

    photos?: {
        name: string;
        widthPx?: number;
        heightPx?: number;
        authorAttributions?: {
            displayName: string;
            uri: string;
            photoUri?: string;
        }[];
    }[];
};

export type GoogleTextSearchResponse = {
    places?: GooglePlace[];
    nextPageToken?: string;
};
