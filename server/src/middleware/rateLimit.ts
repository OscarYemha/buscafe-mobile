import type { Request, Response } from 'express';
import {
    ipKeyGenerator,
    rateLimit,
    type Options,
} from 'express-rate-limit';
import type { AuthenticatedRequest } from './auth.js';

/*
 * Store en memoria: correcto con una sola instancia, pero los
 * contadores se reinician en cada deploy o reinicio del servidor.
 * Si se escala a varias instancias, hay que pasar a un store compartido.
 */

const MINUTE = 60 * 1000;
const HOUR = 60 * MINUTE;

const TOO_MANY_REQUESTS =
    'Demasiados intentos. Probá de nuevo en unos minutos.';

const TOO_MANY_CODES =
    'Pediste demasiados códigos. Probá de nuevo más tarde.';

const normalizeEmail = (value: unknown): string | null =>
{
    if (typeof value !== 'string')
    {
        return null;
    }

    const email = value.trim().toLowerCase();

    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) ? email : null;
};

const bodyEmail = (req: Request): string | null =>
    normalizeEmail(req.body?.email);

const limiter = (
    name: string,
    windowMs: number,
    limit: number,
    message: string,
    options: Partial<Options> = {}
) =>
    rateLimit({
        windowMs,
        limit,
        identifier: name,
        standardHeaders: 'draft-8',
        legacyHeaders: false,
        handler: (_req: Request, res: Response) =>
        {
            res.status(429).json({ error: message });
        },
        ...options,
    });

const byIp = (
    name: string,
    windowMs: number,
    limit: number,
    message: string
) =>
    limiter(name, windowMs, limit, message, {
        keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
    });

/*
 * Si el email falta o es inválido no se aplica este límite: la ruta
 * responde 400 igual y el límite por IP sigue activo. El límite se
 * aplica exista o no la cuenta, así que el 429 no revela qué emails
 * están registrados.
 */
const byBodyEmail = (
    name: string,
    windowMs: number,
    limit: number,
    message: string,
    options: Partial<Options> = {}
) =>
    limiter(name, windowMs, limit, message, {
        keyGenerator: (req) => `email:${bodyEmail(req)}`,
        skip: (req) => bodyEmail(req) === null,
        ...options,
    });

/*
 * Por usuario autenticado: va después de requireAuth. Sin userId
 * (no debería pasar detrás de requireAuth) no se aplica.
 */
const byUser = (
    name: string,
    windowMs: number,
    limit: number,
    message: string
) =>
    limiter(name, windowMs, limit, message, {
        keyGenerator: (req) =>
            `user:${(req as AuthenticatedRequest).userId}`,
        skip: (req) =>
            (req as AuthenticatedRequest).userId === undefined,
    });

/*
 * En login solo cuentan los fallos. El 403 (email sin verificar)
 * implica contraseña correcta, así que no cuenta como fallo.
 * Por IP también: con CGNAT muchos usuarios móviles comparten IP y
 * no queremos bloquear logins exitosos.
 */
const countOnlyLoginFailures: Partial<Options> = {
    skipSuccessfulRequests: true,
    requestWasSuccessful: (_req, res) =>
        res.statusCode < 400 || res.statusCode === 403,
};

export const createAuthRateLimiters = () => ({
    loginByIp:
        limiter('login-ip', 15 * MINUTE, 20, TOO_MANY_REQUESTS, {
            keyGenerator: (req) => ipKeyGenerator(req.ip ?? ''),
            ...countOnlyLoginFailures,
        }),

    loginByEmail:
        byBodyEmail(
            'login-email',
            15 * MINUTE,
            10,
            TOO_MANY_REQUESTS,
            countOnlyLoginFailures
        ),

    registerByIp:
        byIp('register-ip', HOUR, 5, TOO_MANY_REQUESTS),

    passwordResetRequestByIp:
        byIp('password-reset-request-ip', HOUR, 10, TOO_MANY_CODES),
    passwordResetRequestByEmail:
        byBodyEmail('password-reset-request-email', HOUR, 3, TOO_MANY_CODES),

    resendVerificationByIp:
        byIp('resend-verification-ip', HOUR, 10, TOO_MANY_CODES),
    resendVerificationByEmail:
        byBodyEmail('resend-verification-email', HOUR, 3, TOO_MANY_CODES),

    // Requiere requireAuth antes, para tener req.userId.
    emailChangeByIp:
        byIp('email-change-ip', HOUR, 10, TOO_MANY_CODES),
    emailChangeByUser:
        byUser('email-change-user', HOUR, 3, TOO_MANY_CODES),
    emailChangeByTargetEmail:
        byBodyEmail('email-change-target-email', HOUR, 3, TOO_MANY_CODES),

    // Segunda barrera sobre el límite de 5 intentos por código.
    verifyEmailByIp:
        byIp('verify-email-ip', 15 * MINUTE, 30, TOO_MANY_REQUESTS),
    passwordResetConfirmByIp:
        byIp('password-reset-confirm-ip', 15 * MINUTE, 30, TOO_MANY_REQUESTS),
    emailChangeVerifyByIp:
        byIp('email-change-verify-ip', 15 * MINUTE, 30, TOO_MANY_REQUESTS),
});

export type AuthRateLimiters =
    ReturnType<typeof createAuthRateLimiters>;

/*
 * Crear una reseña o un favorito de un café nuevo consulta Google
 * Places: estos límites evitan que un usuario gaste llamadas en masa.
 */
export const createResourceRateLimiters = () => ({
    reviewsByUser:
        byUser(
            'reviews-user',
            HOUR,
            30,
            'Llegaste al límite de reseñas por hora. Probá de nuevo más tarde.'
        ),
    favoritesByUser:
        byUser(
            'favorites-user',
            HOUR,
            60,
            'Llegaste al límite de favoritos por hora. Probá de nuevo más tarde.'
        ),
});

/*
 * "Elegir zona" consulta Google Places mientras el usuario escribe. Con la
 * espera entre teclas de la app, una búsqueda son unas pocas llamadas: el
 * límite deja margen para usarla normal y frena el abuso.
 */
export const createZoneRateLimiters = () => ({
    zonesByIp:
        byIp('zones-ip', 15 * MINUTE, 150, TOO_MANY_REQUESTS),
});
