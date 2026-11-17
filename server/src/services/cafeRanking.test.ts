
import { describe, expect, it } from 'vitest';
import {
    filterCafesByRecommendation,
    filterCafesByRating,
    filterPetFriendlyCafes,
} from './cafeRanking';

const createCafe = (overrides: Record<string, unknown> = {}) => ({
    distanceKm: 1,
    goodForWorkPercentage: null as number | null,
    goodForStudyPercentage: null as number | null,
    goodForDatePercentage: null as number | null,
    coffeeRating: null as number | null,
    foodRating: null as number | null,
    allowsDogs: null as boolean | null,
    ...overrides,
});

describe('cafeRanking', () => {
    it('recomienda cafeterías con al menos 70 % positivo y 5 respuestas', () => {
        const cafes = [
            createCafe({
                goodForWorkPercentage: 60,
                goodForWorkResponsesCount: 5,
            }),
            createCafe({
                goodForWorkPercentage: 70,
                goodForWorkResponsesCount: 10,
            }),
            createCafe({
                goodForWorkPercentage: null,
                goodForWorkResponsesCount: 0,
            }),
        ];

        const result = filterCafesByRecommendation(cafes, 'work');

        expect(result).toHaveLength(1);
        expect(result[0]?.goodForWorkPercentage).toBe(70);
    });

    it('ordena las cafeterías recomendadas por distancia', () => {
        const cafes = [
            createCafe({
                distanceKm: 3,
                goodForStudyPercentage: 80,
                goodForStudyResponsesCount: 5,
            }),
            createCafe({
                distanceKm: 1,
                goodForStudyPercentage: 90,
                goodForStudyResponsesCount: 10,
            }),
            createCafe({
                distanceKm: null,
                goodForStudyPercentage: 75,
                goodForStudyResponsesCount: 8,
            }),
        ];

        const result = filterCafesByRecommendation(cafes, 'study');

        expect(result.map(cafe => cafe.distanceKm)).toEqual([1, 3, null]);
    });

    it('exige una calificación mínima de 4 para buen café', () => {
        const cafes = [
            createCafe({ coffeeRating: 3.9, coffeeRatingsCount: 5 }),
            createCafe({ coffeeRating: 4, coffeeRatingsCount: 5 }),
            createCafe({ coffeeRating: 4.5, coffeeRatingsCount: 5 }),
        ];

        const result = filterCafesByRating(cafes, 'coffee');

        expect(result).toHaveLength(2);
        expect(result.map(cafe => cafe.coffeeRating)).toEqual([4, 4.5]);
    });

    it('solo incluye cafeterías que permiten perros', () => {
        const cafes = [
            createCafe({ allowsDogs: true }),
            createCafe({ allowsDogs: false }),
            createCafe({ allowsDogs: null }),
        ];

        const result = filterPetFriendlyCafes(cafes);

        expect(result).toHaveLength(1);
        expect(result[0]?.allowsDogs).toBe(true);
    });

    it('no recomienda cafeterías con menos de 5 respuestas para trabajar', () => {
        const cafes = [
            {
                ...createCafe({
                    goodForWorkPercentage: 100,
                }),
                goodForWorkResponsesCount: 3,
            },
            {
                ...createCafe({
                    goodForWorkPercentage: 80,
                }),
                goodForWorkResponsesCount: 5,
            },
        ];

        const result = filterCafesByRecommendation(cafes, 'work');

        expect(result).toHaveLength(1);
        expect(result[0]?.goodForWorkResponsesCount).toBe(5);
    });

    it('exige al menos 5 calificaciones específicas para café y comida', () => {
        const cafes = [
            {
                ...createCafe({
                    coffeeRating: 5,
                    foodRating: 5,
                }),
                coffeeRatingsCount: 3,
                foodRatingsCount: 3,
            },
            {
                ...createCafe({
                    coffeeRating: 4.2,
                    foodRating: 4.3,
                }),
                coffeeRatingsCount: 5,
                foodRatingsCount: 5,
            },
            {
                ...createCafe({
                    coffeeRating: 3.5,
                    foodRating: 3.8,
                }),
                coffeeRatingsCount: 10,
                foodRatingsCount: 10,
            },
        ];

        const coffeeResult = filterCafesByRating(cafes, 'coffee');
        const foodResult = filterCafesByRating(cafes, 'food');

        expect(coffeeResult).toHaveLength(1);
        expect(coffeeResult[0]?.coffeeRatingsCount).toBe(5);

        expect(foodResult).toHaveLength(1);
        expect(foodResult[0]?.foodRatingsCount).toBe(5);
    });
});
