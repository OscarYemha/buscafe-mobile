type RankableCafe = {
    distanceKm: number | null;

    goodForWorkPercentage: number | null;
    goodForStudyPercentage: number | null;
    goodForDatePercentage: number | null;
    goodForWorkResponsesCount?: number;
    goodForStudyResponsesCount?: number;
    goodForDateResponsesCount?: number;
    coffeeRating: number | null;
    foodRating: number | null;
    coffeeRatingsCount?: number;
    foodRatingsCount?: number;
    allowsDogs: boolean | null;
};

type RecommendationIntent =
    | 'work'
    | 'study'
    | 'date';

function getRecommendationPercentage(
    cafe: RankableCafe,
    intent: RecommendationIntent
): number | null
{
    switch (intent)
    {
        case 'work':
            return cafe.goodForWorkPercentage;

        case 'study':
            return cafe.goodForStudyPercentage;

        case 'date':
            return cafe.goodForDatePercentage;
    }
}

function getRecommendationResponsesCount(
    cafe: RankableCafe,
    intent: RecommendationIntent
): number {
    switch (intent) {
        case 'work':
            return cafe.goodForWorkResponsesCount ?? 0;

        case 'study':
            return cafe.goodForStudyResponsesCount ?? 0;

        case 'date':
            return cafe.goodForDateResponsesCount ?? 0;
    }
}

export function filterCafesByRecommendation<
    T extends RankableCafe
>(
    cafes: T[],
    intent: RecommendationIntent
): T[]
{
    return cafes
        .filter((cafe) => {
            const percentage =
                getRecommendationPercentage(
                    cafe,
                    intent
                );

            return (
                percentage !== null &&
                Number.isFinite(percentage) &&
                percentage >= 70 &&
                getRecommendationResponsesCount(cafe, intent) >= 5
            );
        })
        .sort((a, b) => {
            if (a.distanceKm === null)
            {
                return 1;
            }

            if (b.distanceKm === null)
            {
                return -1;
            }

            return a.distanceKm - b.distanceKm;
        });
}

type RatingIntent =
    | 'coffee'
    | 'food';

function getIntentRating(
    cafe: RankableCafe,
    intent: RatingIntent
): number | null
{
    switch (intent)
    {
        case 'coffee':
            return cafe.coffeeRating;

        case 'food':
            return cafe.foodRating;
    }
}

function getIntentRatingsCount(
    cafe: RankableCafe,
    intent: RatingIntent
): number {
    switch (intent) {
        case 'coffee':
            return cafe.coffeeRatingsCount ?? 0;

        case 'food':
            return cafe.foodRatingsCount ?? 0;
    }
}

export function filterCafesByRating<
    T extends RankableCafe
>(
    cafes: T[],
    intent: RatingIntent
): T[]
{
    return cafes
        .filter((cafe) => {
            const rating =
                getIntentRating(
                    cafe,
                    intent
                );

            return (
                rating !== null &&
                Number.isFinite(rating) &&
                rating >= 4 &&
                getIntentRatingsCount(cafe, intent) >= 5
            );
        })
        .sort((a, b) => {
            if (a.distanceKm === null)
            {
                return 1;
            }

            if (b.distanceKm === null)
            {
                return -1;
            }

            return a.distanceKm - b.distanceKm;
        });
}

export function filterPetFriendlyCafes<
    T extends RankableCafe
>(
    cafes: T[]
): T[]
{
    return cafes
        .filter(
            cafe => cafe.allowsDogs === true
        )
        .sort((a, b) => {
            if (a.distanceKm === null)
            {
                return 1;
            }

            if (b.distanceKm === null)
            {
                return -1;
            }

            return a.distanceKm - b.distanceKm;
        });
}