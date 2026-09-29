import { Router } from 'express';
import { Prisma } from '../generated/prisma/client.js';
import prisma from '../lib/prisma.js';
import {
    getPlaceDetails,
    searchCafes,
    searchCafesNearby,
} from '../services/googlePlaces.js';
import { mapGooglePlaceToCafeSummary } from '../services/cafeMapper.js';
import { calculateDistanceKm } from '../utils/distance.js';
import { getCafeStats } from '../services/cafeStats.js';
import { filterCafesByRecommendation, filterCafesByRating, filterPetFriendlyCafes } from '../services/cafeRanking.js';

const router = Router();

router.get('/', async (req, res) => {
    try {
        const cafes = await prisma.cafe.findMany();

        return res.json(cafes);
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: 'No se pudieron obtener las cafeterías',
        });
    }
});

router.get('/nearby', async (req, res) => {
    try
    {
        const latitude = Number(req.query.latitude);
        const longitude = Number(req.query.longitude);

        const intent =
            typeof req.query.intent === 'string'
                ? req.query.intent
                : undefined;

        if (!Number.isFinite(latitude) || !Number.isFinite(longitude))
        {
            return res.status(400).json({
                error: 'Latitud y longitud son obligatorias',
            });
        }

        const googlePlaces =
            await searchCafesNearby(
                latitude,
                longitude
            );

        const mappedCafes =
            googlePlaces
                .map(mapGooglePlaceToCafeSummary)
                .filter((cafe) => cafe !== null);

        const cafes = await Promise.all(
            mappedCafes.map(async (cafe) => {
                const stats = await getCafeStats(
                    cafe.googlePlaceId
                );

                return {
                    ...cafe,

                    buscafeRating:
                        stats.rating,

                    buscafeReviewsCount:
                        stats.reviewsCount,

                        coffeeRating:
                            stats.coffeeRating,

                        foodRating:
                            stats.foodRating,

                        goodForWorkPercentage:
                            stats.goodForWorkPercentage,

                        goodForStudyPercentage:
                            stats.goodForStudyPercentage,

                        goodForDatePercentage:
                            stats.goodForDatePercentage,

                        goodForWorkCount:
                            stats.goodForWorkCount,

                        goodForStudyCount:
                            stats.goodForStudyCount,

                        goodForDateCount:
                            stats.goodForDateCount,

                    distanceKm: calculateDistanceKm(
                        latitude,
                        longitude,
                        cafe.latitude,
                        cafe.longitude
                    ),
                };
            })
        );

        if (
            intent === 'work' ||
            intent === 'study' ||
            intent === 'date'
        )
        {
            const filteredCafes =
                filterCafesByRecommendation(
                    cafes,
                    intent
                );

            return res.json(filteredCafes);
        }

        if (
            intent === 'coffee' ||
            intent === 'food'
        )
        {
            const filteredCafes =
                filterCafesByRating(
                    cafes,
                    intent
                );

            return res.json(filteredCafes);
        }

        if (intent === 'pet-friendly')
        {
            const filteredCafes =
                filterPetFriendlyCafes(cafes);

            return res.json(filteredCafes);
        }

        cafes.sort((a, b) => {
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

        return res.json(cafes);
    }
    catch (error)
    {
        console.error(error);

        return res.status(500).json({
            error: 'No se pudieron obtener las cafeterías cercanas',
        });
    }
});

router.get('/search', async (req, res) => {
    try
    {
        const query =
            typeof req.query.query === 'string'
                ? req.query.query.trim()
                : '';

        const pageToken =
            typeof req.query.pageToken === 'string'
                ? req.query.pageToken.trim()
                : undefined;

        const resolvedQuery =
            typeof req.query.resolvedQuery === 'string'
                ? req.query.resolvedQuery.trim()
                : undefined;

        const hasLatitude = 
            req.query.latitude !== undefined;

        const hasLongitude =
            req.query.longitude !== undefined;

        const latitude = 
            hasLatitude
                ? Number(req.query.latitude)
                : null;

        const longitude =
            hasLongitude
                ? Number(req.query.longitude)
                : null;

        if (query.length < 3)
        {
            return res.status(400).json({
                error: 'La búsqueda debe tener al menos 3 caracteres',
            });
        }

        if (
            (pageToken && !resolvedQuery) ||
            (!pageToken && resolvedQuery)
        )
        {
            return res.status(400).json({
                error:
                    'pageToken y resolvedQuery deben enviarse juntos',
            });
        }

        if (hasLatitude !== hasLongitude)
        {
            return res.status(400).json({
                error: 'Latitud y longitud deben enviarse juntas',
            });
        }

        if (
            hasLatitude &&
            (
                !Number.isFinite(latitude) ||
                !Number.isFinite(longitude)
            )
        )
        {
            return res.status(400).json({
                error: 'Latitud o longitud inválidas',
            });
        }

        const searchResult =
            await searchCafes(
                query,
                pageToken,
                resolvedQuery
            );

        const cafes =
            searchResult.places
                .map(mapGooglePlaceToCafeSummary)
                .filter((cafe) => cafe !== null)
                .map((cafe) => ({
                    ...cafe,

                    distanceKm:
                        latitude !== null &&
                        longitude !== null
                            ? calculateDistanceKm(
                                latitude,
                                longitude,
                                cafe.latitude,
                                cafe.longitude
                            )
                            : null,
                }));

        return res.json({
            cafes,
            nextPageToken:
                searchResult.nextPageToken,
            resolvedQuery:
                searchResult.resolvedQuery,
        });
    }
    catch (error)
    {
        console.error(error);

        return res.status(500).json({
            error: 'No se pudieron buscar cafeterías',
        });
    }
});

router.get('/place/:googlePlaceId', async (req, res) => {
    try
    {
        const googlePlaceId = req.params.googlePlaceId;

        if (typeof googlePlaceId !== 'string' || googlePlaceId.trim() === '')
        {
            return res.status(400).json({
                error: 'El ID de Google Places es inválido',
            });
        }

        const googlePlace = await getPlaceDetails(googlePlaceId);

        const cafe = mapGooglePlaceToCafeSummary(googlePlace);

        if (!cafe)
        {
            return res.status(404).json({
                error: 'No se pudo obtener la cafetería',
            });
        }

        const stats = await getCafeStats(googlePlaceId);

        return res.json({
            ...cafe,

            buscafeRating:
                stats.rating,

            buscafeReviewsCount:
                stats.reviewsCount,

            buscafeReviews:
                stats.reviews,

            coffeeRating:
                stats.coffeeRating,

            foodRating:
                stats.foodRating,

            serviceRating:
                stats.serviceRating,

            comfortRating:
                stats.comfortRating,

            quietRating:
                stats.quietRating,

            goodForWorkPercentage:
                stats.goodForWorkPercentage,

            goodForStudyPercentage:
                stats.goodForStudyPercentage,

            goodForDatePercentage:
                stats.goodForDatePercentage,

            goodForWorkCount:
                stats.goodForWorkCount,

            goodForStudyCount:
                stats.goodForStudyCount,

            goodForDateCount:
                stats.goodForDateCount,

            currentOpeningHours:
                googlePlace.currentOpeningHours
                    ?.weekdayDescriptions ?? [],

            regularOpeningHours:
                googlePlace.regularOpeningHours
                    ?.weekdayDescriptions ?? [],

            website:
                googlePlace.websiteUri ?? null,

            phone:
                googlePlace.nationalPhoneNumber ?? null,

            googleMapsUrl:
                googlePlace.googleMapsUri ?? null,
        });
    }
    catch (error)
    {
        console.error(error);

        return res.status(500).json({
            error: 'No se pudo obtener el detalle de la cafetería',
        });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const id = Number(req.params.id);

        if (!Number.isInteger(id) || id <= 0) {
            return res.status(400).json({
                error: 'El ID de la cafetería es inválido',
            });
        }

        const cafe = await prisma.cafe.findUnique({
            where: {
                id,
            },
            include: {
                reviews: {
                    include: {
                        user: {
                            select: {
                                id: true,
                                name: true,
                            },
                        },
                    },
                    orderBy: {
                        createdAt: 'desc',
                    }
                },
            },
        });

        if (!cafe) {
            return res.status(404).json({
                error: 'Cafetería no encontrada',
            });
        }

        return res.json(cafe);
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            error: 'No se pudo obtener la cafetería',
        });
    }
});

router.post('/', async (req, res) => {
    try {
        const {
            googlePlaceId,
            name,
            address,
            latitude,
            longitude,
        } = req.body;

        if (
            typeof googlePlaceId !== 'string' ||
            googlePlaceId.trim() === '' ||
            typeof name !== 'string' ||
            name.trim() === '' ||
            typeof address !== 'string' ||
            address.trim() === '' ||
            typeof latitude !== 'number' ||
            typeof longitude !== 'number'
        ) {
            return res.status(400).json({
                error: 'Los datos de la cafetería son inválidos',
            });
        }

        const cafe = await prisma.cafe.create({
            data: {
                googlePlaceId,
                name,
                address,
                latitude,
                longitude,
            },
        });

        return res.status(201).json(cafe);
    } catch (error) {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return res.status(409).json({
                error: 'La cafetería ya existe',
            });
        }

        console.error(error);

        return res.status(500).json({
            error: 'No se pudo crear la cafetería',
        });
    }
});

export default router;
