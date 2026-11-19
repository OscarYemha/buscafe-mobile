import prisma from '../lib/prisma.js';
import { Prisma } from '../generated/prisma/client.js';
import type { Cafe } from '../generated/prisma/client.js';
import {
    getPlaceDetails,
    GooglePlaceNotFoundError,
} from './googlePlaces.js';
import { mapGooglePlaceToCafeSummary } from './cafeMapper.js';

const GOOGLE_PLACE_ID_REGEX = /^[A-Za-z0-9_-]{1,300}$/;

export const isValidGooglePlaceId = (value: unknown): value is string =>
    typeof value === 'string' && GOOGLE_PLACE_ID_REGEX.test(value);

/** El lugar no existe en Google Places o le faltan nombre, dirección o ubicación. */
export class CafeNotFoundError extends Error
{
    constructor(googlePlaceId: string)
    {
        super(`No se encontró la cafetería ${googlePlaceId}`);
        this.name = 'CafeNotFoundError';
    }
}

/** Google Places falló (cuota, caída, timeout): reintentar puede funcionar. */
export class CafeLookupError extends Error
{
    constructor(googlePlaceId: string, cause: unknown)
    {
        super(`No se pudo consultar Google Places para ${googlePlaceId}`, { cause });
        this.name = 'CafeLookupError';
    }
}

export const CAFE_NOT_FOUND_MESSAGE =
    'No encontramos esa cafetería';

export const CAFE_LOOKUP_FAILED_MESSAGE =
    'No pudimos verificar la cafetería. Probá de nuevo.';

/*
 * Se loguea para que un problema de configuración (que haga parecer
 * inexistentes a todos los lugares) se note en los logs.
 */
const cafeNotFound = (
    googlePlaceId: string,
    reason: string
): CafeNotFoundError =>
{
    console.warn(
        `findOrCreateCafe: cafetería no encontrada (${googlePlaceId}): ${reason}`
    );

    return new CafeNotFoundError(googlePlaceId);
};

/**
 * Devuelve el café guardado con ese googlePlaceId. Si no existe, lo
 * crea con los datos de Google Places, nunca con datos del cliente.
 * Un café existente no se modifica.
 *
 * Se guarda con el googlePlaceId pedido (el que conoce la app y usan
 * DELETE /favorites/:googlePlaceId y las estadísticas), aunque Google
 * devuelva otro ID para el mismo lugar.
 *
 * Lanza CafeNotFoundError si Google no conoce el lugar y CafeLookupError
 * si Google falla por otro motivo. Los errores de la base se propagan
 * tal cual.
 */
export const findOrCreateCafe = async (
    googlePlaceId: string
): Promise<Cafe> =>
{
    const existing = await prisma.cafe.findUnique({
        where: { googlePlaceId },
    });

    if (existing)
    {
        return existing;
    }

    let summary;

    try
    {
        summary = mapGooglePlaceToCafeSummary(
            await getPlaceDetails(googlePlaceId)
        );
    }
    catch (error)
    {
        if (error instanceof GooglePlaceNotFoundError)
        {
            throw cafeNotFound(googlePlaceId, 'Google Places no lo encontró');
        }

        throw new CafeLookupError(googlePlaceId, error);
    }

    if (!summary)
    {
        throw cafeNotFound(googlePlaceId, 'faltan nombre, dirección o ubicación');
    }

    try
    {
        return await prisma.cafe.create({
            data: {
                googlePlaceId,
                name: summary.name,
                address: summary.address,
                latitude: summary.latitude,
                longitude: summary.longitude,
            },
        });
    }
    catch (error)
    {
        // Otra request creó el mismo café al mismo tiempo.
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        )
        {
            const created = await prisma.cafe.findUnique({
                where: { googlePlaceId },
            });

            if (created)
            {
                return created;
            }
        }

        throw error;
    }
};
