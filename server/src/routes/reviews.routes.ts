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

/** Lo que se puede escribir en una reseña: vale igual al crearla y al editarla. */
function hasValidReviewContent(body: Record<string, unknown>): boolean
{
    const { rating, comment } = body;

    return (
        Number.isInteger(rating) &&
        (rating as number) >= 1 &&
        (rating as number) <= 5 &&
        typeof comment === 'string' &&
        comment.trim() !== '' &&
        ['coffeeRating', 'foodRating', 'serviceRating', 'comfortRating', 'quietRating']
            .every((field) => isOptionalRating(body[field])) &&
        ['goodForWork', 'goodForStudy', 'goodForDate', 'hasWifi', 'hasPowerOutlets']
            .every((field) => isOptionalBoolean(body[field]))
    );
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
            !hasValidReviewContent(req.body) ||
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

/*
 * Una edición dentro de este tiempo desde la publicación no marca la
 * reseña como editada: casi siempre es corregir algo recién escrito.
 */
export const EDIT_GRACE_PERIOD_MS = 15 * 60 * 1000;

const REVIEW_NOT_FOUND_MESSAGE = 'No encontramos esa reseña.';

/*
 * La reseña de :id si es del usuario. Una reseña ajena y una inexistente
 * dan lo mismo (null → 404), así no se revela cuáles existen.
 */
async function findOwnReview(rawId: unknown, userId: number)
{
    const id = Number(rawId);

    if (!Number.isSafeInteger(id) || id <= 0 || String(id) !== rawId)
    {
        return null;
    }

    const review = await prisma.review.findUnique({ where: { id } });

    return review && review.userId === userId ? review : null;
}

const isRecordNotFound = (error: unknown) =>
    error instanceof Prisma.PrismaClientKnownRequestError &&
    error.code === 'P2025';

router.patch('/:id', requireAuth, limits.reviewChangesByUser, async (req: AuthenticatedRequest, res) =>
{
    try
    {
        const userId = req.userId;

        if (!userId)
        {
            return res.status(401).json({ error: 'Autenticación requerida' });
        }

        const review = await findOwnReview(req.params.id, userId);

        if (!review)
        {
            return res.status(404).json({ error: REVIEW_NOT_FOUND_MESSAGE });
        }

        if (!hasValidReviewContent(req.body ?? {}))
        {
            return res.status(400).json({ error: 'Datos de reseña inválidos' });
        }

        const now = new Date();
        const isPastGracePeriod =
            now.getTime() - review.createdAt.getTime() > EDIT_GRACE_PERIOD_MS;

        // Lo que no viene se borra: así se puede sacar un puntaje que
        // se había puesto. El café y la fecha de publicación no cambian.
        const body = req.body;

        try
        {
            const updated = await prisma.review.update({
                where: { id: review.id },
                data: {
                    rating: body.rating,
                    comment: body.comment.trim(),
                    coffeeRating: body.coffeeRating ?? null,
                    foodRating: body.foodRating ?? null,
                    serviceRating: body.serviceRating ?? null,
                    comfortRating: body.comfortRating ?? null,
                    quietRating: body.quietRating ?? null,
                    goodForWork: body.goodForWork ?? null,
                    goodForStudy: body.goodForStudy ?? null,
                    goodForDate: body.goodForDate ?? null,
                    hasWifi: body.hasWifi ?? null,
                    hasPowerOutlets: body.hasPowerOutlets ?? null,
                    editedAt: isPastGracePeriod ? now : review.editedAt,
                },
            });

            return res.json(updated);
        }
        catch (error)
        {
            // Se borró entre la búsqueda y la edición.
            if (isRecordNotFound(error))
            {
                return res.status(404).json({ error: REVIEW_NOT_FOUND_MESSAGE });
            }

            throw error;
        }
    }
    catch (error)
    {
        console.error('Error al editar la reseña:', error);

        return res.status(500).json({ error: 'No se pudo editar la reseña' });
    }
});

router.delete('/:id', requireAuth, limits.reviewChangesByUser, async (req: AuthenticatedRequest, res) =>
{
    try
    {
        const userId = req.userId;

        if (!userId)
        {
            return res.status(401).json({ error: 'Autenticación requerida' });
        }

        const review = await findOwnReview(req.params.id, userId);

        if (!review)
        {
            return res.status(404).json({ error: REVIEW_NOT_FOUND_MESSAGE });
        }

        try
        {
            await prisma.review.delete({ where: { id: review.id } });
        }
        catch (error)
        {
            // Ya estaba borrada (por ejemplo, dos toques seguidos): el
            // resultado es el que se pidió.
            if (!isRecordNotFound(error))
            {
                throw error;
            }
        }

        return res.status(204).end();
    }
    catch (error)
    {
        console.error('Error al borrar la reseña:', error);

        return res.status(500).json({ error: 'No se pudo borrar la reseña' });
    }
});

export default router;
