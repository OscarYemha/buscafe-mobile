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
