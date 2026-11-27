import { Router } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { Prisma } from '../generated/prisma/client';
import {
    CAFE_LOOKUP_FAILED_MESSAGE,
    CAFE_NOT_FOUND_MESSAGE,
    CafeLookupError,
    CafeNotFoundError,
    findOrCreateCafe,
    isValidGooglePlaceId,
} from '../services/cafes.js';
import { createResourceRateLimiters } from '../middleware/rateLimit.js';

const router = Router();
const limits = createResourceRateLimiters();

function isOptionalRating(value: unknown): boolean
{
    return value === undefined ||
        (
            Number.isInteger(value) &&
            (value as number) >= 1 &&
            (value as number) <= 5
        );
}

function isOptionalBoolean(value: unknown): boolean
{
    return value === undefined ||
        typeof value === 'boolean';
}

router.post('/', requireAuth, limits.reviewsByUser, async (req: AuthenticatedRequest, res) =>
{
    try
    {
        /*
         * cafeName, cafeAddress, cafeLatitude y cafeLongitude se ignoran:
         * la app vieja los sigue mandando, pero los datos del café salen
         * de Google Places (ver findOrCreateCafe).
         */
        const {
            googlePlaceId,
            rating,
            comment,
            coffeeRating,
            foodRating,
            serviceRating,
            comfortRating,
            quietRating,
            goodForWork,
            goodForStudy,
            goodForDate,
            hasWifi,
            hasPowerOutlets,
            idempotencyKey,
        } = req.body;

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (
            typeof googlePlaceId !== 'string' ||
            !isValidGooglePlaceId(googlePlaceId.trim()) ||
            !Number.isInteger(rating) ||
            rating < 1 ||
            rating > 5 ||
            typeof comment !== 'string' ||
            comment.trim() === '' ||
            !isOptionalRating(coffeeRating) ||
            !isOptionalRating(foodRating) ||
            !isOptionalRating(serviceRating) ||
            !isOptionalRating(comfortRating) ||
            !isOptionalRating(quietRating) ||
            !isOptionalBoolean(goodForWork) ||
            !isOptionalBoolean(goodForStudy) ||
            !isOptionalBoolean(goodForDate) ||
            !isOptionalBoolean(hasWifi) ||
            !isOptionalBoolean(hasPowerOutlets) ||
            (
                idempotencyKey !== undefined &&
                (
                    typeof idempotencyKey !== 'string' ||
                    !uuidRegex.test(idempotencyKey)
                )
            )
        )
        {
            return res.status(400).json({
                error: 'Datos de reseña inválidos',
            });
        }

        const userId = req.userId;

        if (!userId)
        {
            return res.status(401).json({
                error: 'Autenticación requerida',
            });
        }

        const normalizedPlaceId = googlePlaceId.trim();
        const normalizedComment = comment.trim();

        const matchesRequest = (
            existing: {
                userId: number | null;
                cafe: { googlePlaceId: string };
                rating: number;
                comment: string;
                coffeeRating: number | null;
                foodRating: number | null;
                serviceRating: number | null;
                comfortRating: number | null;
                quietRating: number | null;
                goodForWork: boolean | null;
                goodForStudy: boolean | null;
                goodForDate: boolean | null;
                hasWifi: boolean | null;
                hasPowerOutlets: boolean | null;
            }
        ): boolean =>
        {
            return (
                existing.userId === userId &&
                existing.cafe.googlePlaceId === normalizedPlaceId &&
                existing.rating === rating &&
                existing.comment === normalizedComment &&
                existing.coffeeRating === (coffeeRating ?? null) &&
                existing.foodRating === (foodRating ?? null) &&
                existing.serviceRating === (serviceRating ?? null) &&
                existing.comfortRating === (comfortRating ?? null) &&
                existing.quietRating === (quietRating ?? null) &&
                existing.goodForWork === (goodForWork ?? null) &&
                existing.goodForStudy === (goodForStudy ?? null) &&
                existing.goodForDate === (goodForDate ?? null) &&
                existing.hasWifi === (hasWifi ?? null) &&
                existing.hasPowerOutlets === (hasPowerOutlets ?? null)
            );
        };

        const findExisting = async () =>
        {
            if (idempotencyKey === undefined)
            {
                return null;
            }

            return prisma.review.findUnique({
                where: {
                    idempotencyKey,
                },
                include: {
                    cafe: {
                        select: {
                            googlePlaceId: true,
                        },
                    },
                },
            });
        };

        const existing = await findExisting();

        if (existing)
        {
            if (!matchesRequest(existing))
            {
                return res.status(409).json({
                    error: 'Esta solicitud ya se utilizó para otra reseña.',
                });
            }

            return res.status(200).json(existing);
        }

        let cafe;

        try
        {
            cafe = await findOrCreateCafe(normalizedPlaceId);
        }
        catch (error)
        {
            if (error instanceof CafeNotFoundError)
            {
                return res.status(404).json({
                    error: CAFE_NOT_FOUND_MESSAGE,
                });
            }

            if (error instanceof CafeLookupError)
            {
                console.error('Error al obtener la cafetería de Google:', error);

                return res.status(502).json({
                    error: CAFE_LOOKUP_FAILED_MESSAGE,
                });
            }

            throw error;
        }

        try
        {
            const review = await prisma.review.create({
                data: {
                    userId,
                    cafeId: cafe.id,
                    rating,
                    comment: normalizedComment,
                    coffeeRating,
                    foodRating,
                    serviceRating,
                    comfortRating,
                    quietRating,
                    goodForWork,
                    goodForStudy,
                    goodForDate,
                    hasWifi,
                    hasPowerOutlets,
                    idempotencyKey,
                },
            });

            return res.status(201).json(review);
        }
        catch (error)
        {
            if (
                idempotencyKey !== undefined &&
                error instanceof Prisma.PrismaClientKnownRequestError &&
                error.code === 'P2002'
            )
            {
                const savedReview = await findExisting();

                if (savedReview)
                {
                    if (!matchesRequest(savedReview))
                    {
                        return res.status(409).json({
                            error: 'Esta solicitud ya se utilizó para otra reseña.',
                        });
                    }

                    return res.status(200).json(savedReview);
                }
            }

            throw error;
        }
    }
    catch (error)
    {
        console.error('Error al crear la reseña:', error);

        return res.status(500).json({
            error: 'No se pudo crear la reseña',
        });
    }
});

export default router;
