import { CafeSummary } from '../types/CafeSummary';

export type CafeSortOption = 'distance' | 'google' | 'buscafe';

export function sortCafes(
    cafes: CafeSummary[],
    sortBy: CafeSortOption
): CafeSummary[]
{
    return [...cafes].sort((a, b) =>
    {
        const distanceA = a.distanceKm ?? Number.POSITIVE_INFINITY;
        const distanceB = b.distanceKm ?? Number.POSITIVE_INFINITY;

        if (sortBy !== 'distance')
        {
            const ratingA = sortBy === 'google'
                ? a.googleRating
                : a.buscafeRating;

            const ratingB = sortBy === 'google'
                ? b.googleRating
                : b.buscafeRating;

            if (ratingA === null && ratingB !== null)
            {
                return 1;
            }

            if (ratingA !== null && ratingB === null)
            {
                return -1;
            }

            if (
                ratingA !== null &&
                ratingB !== null &&
                ratingA !== ratingB
            )
            {
                return ratingB - ratingA;
            }
        }

        return distanceA - distanceB;
    });
}