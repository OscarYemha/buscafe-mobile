/**
 * Error de una respuesta HTTP del servidor de BusCafé.
 *
 * Si hay `ApiError`, el servidor respondió: sabemos qué pasó. Un error
 * de red (sin respuesta) sigue siendo un Error común, porque en ese
 * caso no sabemos si la solicitud llegó a aplicarse.
 */
export class ApiError extends Error
{
    readonly status: number;

    /** Segundos de espera indicados por el header Retry-After, si vino. */
    readonly retryAfterSeconds: number | null;

    constructor(
        message: string,
        status: number,
        retryAfterSeconds: number | null
    )
    {
        super(message);
        this.name = 'ApiError';
        this.status = status;
        this.retryAfterSeconds = retryAfterSeconds;

        // Mantiene instanceof aunque el transpilador no use clases nativas.
        Object.setPrototypeOf(this, ApiError.prototype);
    }
}

export function isApiError(error: unknown): error is ApiError
{
    return (
        error instanceof ApiError ||
        (
            error instanceof Error &&
            error.name === 'ApiError' &&
            typeof (error as ApiError).status === 'number'
        )
    );
}

/**
 * El servidor respondió y la solicitud no se aplicó: 4xx, o 502 (en
 * POST /reviews y POST /favorites, el 502 viene de Google Places antes
 * de escribir nada). Un 500 u otro 5xx puede haber fallado después de
 * guardar, así que se trata como incierto.
 */
export function isDefinitiveApiError(error: unknown): error is ApiError
{
    return (
        isApiError(error) &&
        (
            (error.status >= 400 && error.status < 500) ||
            error.status === 502
        )
    );
}

function parseRetryAfter(value: string | null): number | null
{
    if (!value)
    {
        return null;
    }

    const trimmed = value.trim();

    if (/^\d+$/.test(trimmed))
    {
        return Number(trimmed);
    }

    const date = Date.parse(trimmed);

    if (Number.isNaN(date))
    {
        return null;
    }

    return Math.max(0, Math.ceil((date - Date.now()) / 1000));
}

/** Arma un ApiError con el campo `error` del body o, si no hay, el mensaje por defecto. */
export async function apiErrorFromResponse(
    response: Response,
    fallbackMessage: string
): Promise<ApiError>
{
    const body = await response.json().catch(() => null);

    const message =
        typeof body?.error === 'string' && body.error.trim()
            ? body.error
            : fallbackMessage;

    return new ApiError(
        message,
        response.status,
        parseRetryAfter(response.headers.get('Retry-After'))
    );
}

/** "1 minuto", "5 minutos", "1 hora y 10 minutos"... */
export function formatWaitTime(seconds: number): string
{
    const totalMinutes = Math.max(1, Math.ceil(seconds / 60));
    const hours = Math.floor(totalMinutes / 60);
    const minutes = totalMinutes % 60;

    const minutesText =
        `${minutes} ${minutes === 1 ? 'minuto' : 'minutos'}`;

    if (hours === 0)
    {
        return minutesText;
    }

    const hoursText =
        `${hours} ${hours === 1 ? 'hora' : 'horas'}`;

    return minutes === 0
        ? hoursText
        : `${hoursText} y ${minutesText}`;
}
