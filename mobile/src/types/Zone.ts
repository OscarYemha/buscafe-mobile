export type ZoneSuggestion = {
    placeId: string;
    /** "Palermo" */
    name: string;
    /** "Ciudad Autónoma de Buenos Aires, Argentina" (puede venir vacío). */
    description: string;
};

export type Zone = ZoneSuggestion & {
    latitude: number;
    longitude: number;
};
