import { Router } from 'express';
import { isValidGooglePlaceId } from '../services/cafes.js';
import { GooglePlaceNotFoundError } from '../services/googlePlaces.js';
import {
    type Coordinates,
    getZone,
    searchZones,
} from '../services/googleZones.js';
import { createZoneRateLimiters } from '../middleware/rateLimit.js';

const router = Router();
const limits = createZoneRateLimiters();

const MIN_QUERY_LENGTH = 2;
const MAX_QUERY_LENGTH = 100;

// La app genera un UUID por búsqueda (ver googleZones.ts).
const SESSION_TOKEN_REGEX = /^[A-Za-z0-9-]{1,64}$/;

/** undefined si no vino; null si vino con un formato inválido. */
const parseSessionToken = (value: unknown): string | undefined | null =>
{
    if (value === undefined)
    {
        return undefined;
    }

    return typeof value === 'string' && SESSION_TOKEN_REGEX.test(value)
        ? value
        : null;
};

/**
 * Ubicación opcional del usuario para priorizar zonas cercanas.
 * undefined si no vino; null si vino incompleta o fuera de rango.
 */
const parseNear = (
    latitude: unknown,
    longitude: unknown
): Coordinates | undefined | null =>
{
    if (latitude === undefined && longitude === undefined)
    {
        return undefined;
    }

    const lat = Number(latitude);
    const lng = Number(longitude);

    if (
        typeof latitude !== 'string' ||
        typeof longitude !== 'string' ||
        !Number.isFinite(lat) || lat < -90 || lat > 90 ||
        !Number.isFinite(lng) || lng < -180 || lng > 180
    )
    {
        return null;
    }

    return { latitude: lat, longitude: lng };
};

router.get('/', limits.zonesByIp, async (req, res) =>
{
    const query =
        typeof req.query.query === 'string' ? req.query.query.trim() : '';
    const sessionToken = parseSessionToken(req.query.sessionToken);
    const near = parseNear(req.query.latitude, req.query.longitude);

    if (
        query.length < MIN_QUERY_LENGTH ||
        query.length > MAX_QUERY_LENGTH ||
        sessionToken === null ||
        near === null
    )
    {
        return res.status(400).json({
            error: near === null
                ? 'Ubicación inválida'
                : `Escribí entre ${MIN_QUERY_LENGTH} y ${MAX_QUERY_LENGTH} caracteres`,
        });
    }

    try
    {
        const zones = await searchZones(query, sessionToken, near);

        return res.json({ zones });
    }
    catch (error)
    {
        console.error('ERROR BUSCANDO ZONAS:', error);

        return res.status(502).json({
            error: 'No se pudieron buscar zonas',
        });
    }
});

router.get('/:placeId', limits.zonesByIp, async (req, res) =>
{
    const { placeId } = req.params;
    const sessionToken = parseSessionToken(req.query.sessionToken);

    if (!isValidGooglePlaceId(placeId) || sessionToken === null)
    {
        return res.status(400).json({ error: 'Zona inválida' });
    }

    try
    {
        const zone = await getZone(placeId, sessionToken);

        return res.json(zone);
    }
    catch (error)
    {
        if (error instanceof GooglePlaceNotFoundError)
        {
            return res.status(404).json({ error: 'No encontramos esa zona' });
        }

        console.error('ERROR OBTENIENDO ZONA:', error);

        return res.status(502).json({
            error: 'No se pudo obtener la zona',
        });
    }
});

export default router;
