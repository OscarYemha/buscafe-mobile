type Coordinates = {
    latitude: number;
    longitude: number;
};

const EARTH_RADIUS_METERS = 6371000;

function degreesToRadians(degrees: number): number
{
    return degrees * (Math.PI / 180);
}

/** Distancia en línea recta entre dos puntos (fórmula de haversine). */
export function calculateDistanceMeters(
    from: Coordinates,
    to: Coordinates
): number
{
    const latitudeDifference =
        degreesToRadians(to.latitude - from.latitude);

    const longitudeDifference =
        degreesToRadians(to.longitude - from.longitude);

    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(degreesToRadians(from.latitude)) *
            Math.cos(degreesToRadians(to.latitude)) *
            Math.sin(longitudeDifference / 2) ** 2;

    return EARTH_RADIUS_METERS * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function calculateDistanceKm(
    from: Coordinates,
    to: Coordinates
): number
{
    return calculateDistanceMeters(from, to) / 1000;
}

export function formatDistance(
    distanceKm: number | null
): string {
    if (distanceKm === null)
    {
        return 'Distancia no disponible';
    }

    if (distanceKm < 1)
    {
        const distanceMeters = 
            Math.round(distanceKm * 1000);

        return `${distanceMeters} m`;
    }

    return `${distanceKm.toFixed(1)} km`;
}