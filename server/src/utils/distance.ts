export function calculateDistanceKm(
    latitude1: number,
    longitude1: number,
    latitude2: number,
    longitude2: number,
): number {
    const earthRadiusKm = 6371;

    const latitudeDifference = degreesToRadians(latitude2 - latitude1);

    const longitudeDifference = degreesToRadians(longitude2 - longitude1);

    const firstLatitude = degreesToRadians(latitude1);

    const secondLatitude = degreesToRadians(latitude2);

    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(firstLatitude) * 
        Math.cos(secondLatitude) *
        Math.sin(longitudeDifference / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadiusKm * c;
}

function degreesToRadians(
    degrees: number
): number {
    return degrees * (Math.PI / 180);
}