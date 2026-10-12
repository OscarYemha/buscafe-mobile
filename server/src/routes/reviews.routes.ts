import { Router } from "express";
import prisma from "../lib/prisma";
import { AuthenticatedRequest, requireAuth } from "../middleware/auth";
import { Prisma } from '../generated/prisma/client';

const router = Router();

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

router.post('/', requireAuth, async (req: AuthenticatedRequest, res) =>
{
    try
    {
        const {
            googlePlaceId,
            cafeName,
            cafeAddress,
            cafeLatitude,
            cafeLongitude,
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
            idempotencyKey,
        } = req.body;

        const uuidRegex =
            /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

        if (
            typeof googlePlaceId !== 'string' ||
            googlePlaceId.trim() === '' ||
            typeof cafeName !== 'string' ||
            cafeName.trim() === '' ||
            typeof cafeAddress !== 'string' ||
            cafeAddress.trim() === '' ||
            typeof cafeLatitude !== 'number' ||
            !Number.isFinite(cafeLatitude) ||
            typeof cafeLongitude !== 'number' ||
            !Number.isFinite(cafeLongitude) ||
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
                existing.goodForDate === (goodForDate ?? null)
            );
        };

        const findExisting = async () =>
        {
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

        const cafe = await prisma.cafe.upsert({
            where: {
                googlePlaceId: normalizedPlaceId,
            },
            update: {
                name: cafeName.trim(),
                address: cafeAddress.trim(),
                latitude: cafeLatitude,
                longitude: cafeLongitude,
            },
            create: {
                googlePlaceId: normalizedPlaceId,
                name: cafeName.trim(),
                address: cafeAddress.trim(),
                latitude: cafeLatitude,
                longitude: cafeLongitude,
            },
        });

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
                    idempotencyKey,
                },
            });

            return res.status(201).json(review);
        }
        catch (error)
        {
            if (
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
