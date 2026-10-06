import prisma from "../lib/prisma";

export type CafeReview = {
    id: number;
    rating: number;
    comment: string;
    createdAt: Date;

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

export type CafeStats = {
    rating: number | null;
    reviewsCount: number;

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

    reviews: CafeReview[];
};

export async function getCafeStats(
    googlePlaceId: string
): Promise<CafeStats> {
    const cafe = await prisma.cafe.findUnique({
        where: {
            googlePlaceId,
        },
        select: {
            reviews: {
                orderBy: {
                    createdAt: 'desc',
                },
                select: {
                    id: true,
                    rating: true,
                    comment: true,
                    createdAt: true,

                    coffeeRating: true,
                    foodRating: true,
                    serviceRating: true,
                    comfortRating: true,
                    quietRating: true,

                    goodForWork: true,
                    goodForStudy: true,
                    goodForDate: true,

                    user: {
                        select: {
                            id: true,
                            name: true,
                        },
                    },
                },
            },
        },
    });

    if (!cafe || cafe.reviews.length === 0)
    {
        return {
            rating: null,
            reviewsCount: 0,

            coffeeRating: null,
            foodRating: null,
            serviceRating: null,
            comfortRating: null,
            quietRating: null,

            goodForWorkPercentage: null,
            goodForStudyPercentage: null,
            goodForDatePercentage: null,

            goodForWorkCount: 0,
            goodForStudyCount: 0,
            goodForDateCount: 0,

            reviews: [],
        };
    }

    const totalRating = cafe.reviews.reduce(
        (total, review) =>
            total + review.rating,
        0
    );

    const calculateAverage = (
        values: Array<number | null>
    ): number | null => {
        const validValues = values.filter(
            (value): value is number =>
                value !== null
        );

        if (validValues.length === 0)
        {
            return null;
        }

        const total = validValues.reduce(
            (sum, value) =>
                sum + value,
            0
        );

        return total / validValues.length;
    };

    const calculateRecommendationPercentage = (
        values: Array<boolean | null>
    ): number | null => {
        const answeredValues = values.filter(
            (value): value is boolean =>
                value !== null
        );

        if (answeredValues.length === 0)
        {
            return null;
        }

        const positiveAnswers = answeredValues.filter(
            value => value
        ).length;

        return (
            positiveAnswers /
            answeredValues.length
        ) * 100;
    };

    return {
        rating:
            totalRating /
            cafe.reviews.length,

        reviewsCount:
            cafe.reviews.length,

        coffeeRating: calculateAverage(
            cafe.reviews.map(
                review => review.coffeeRating
            )
        ),

        foodRating: calculateAverage(
            cafe.reviews.map(
                review => review.foodRating
            )
        ),

        serviceRating: calculateAverage(
            cafe.reviews.map(
                review => review.serviceRating
            )
        ),

        comfortRating: calculateAverage(
            cafe.reviews.map(
                review => review.comfortRating
            )
        ),

        quietRating: calculateAverage(
            cafe.reviews.map(
                review => review.quietRating
            )
        ),

        goodForWorkPercentage:
            calculateRecommendationPercentage(
                cafe.reviews.map(
                    review => review.goodForWork
                )
            ),

        goodForStudyPercentage:
            calculateRecommendationPercentage(
                cafe.reviews.map(
                    review => review.goodForStudy
                )
            ),

        goodForDatePercentage:
            calculateRecommendationPercentage(
                cafe.reviews.map(
                    review => review.goodForDate
                )
            ),

        goodForWorkCount:
            cafe.reviews.filter(
                review => review.goodForWork === true
            ).length,

        goodForStudyCount:
            cafe.reviews.filter(
                review => review.goodForStudy === true
            ).length,

        goodForDateCount:
            cafe.reviews.filter(
                review => review.goodForDate === true
            ).length,

        reviews:
            cafe.reviews,
    };
}