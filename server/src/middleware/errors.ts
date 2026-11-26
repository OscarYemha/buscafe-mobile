import type { ErrorRequestHandler, RequestHandler } from 'express';

/*
 * Sin estos handlers, Express responde con una página HTML: "Cannot GET
 * /x" para rutas que no existen y, ante un error no manejado, una página
 * que fuera de producción incluye el stack trace del server. La app
 * espera JSON con { error }, y los detalles internos solo van al log.
 */

export const notFoundHandler: RequestHandler = (_req, res) =>
{
    res.status(404).json({ error: 'Ruta no encontrada' });
};

type HttpError = Error & {
    status?: number;
    statusCode?: number;
    type?: string;
    expose?: boolean;
};

export const errorHandler: ErrorRequestHandler = (error: HttpError, req, res, next) =>
{
    if (res.headersSent)
    {
        next(error);
        return;
    }

    const status = error.status ?? error.statusCode ?? 500;

    // Errores del cliente que arma Express al leer el body (JSON mal
    // formado, body demasiado grande): se responde el motivo, sin detalles.
    if (status >= 400 && status < 500)
    {
        const message =
            error.type === 'entity.parse.failed'
                ? 'El cuerpo de la solicitud no es un JSON válido'
                : error.type === 'entity.too.large'
                    ? 'La solicitud es demasiado grande'
                    : 'Solicitud inválida';

        res.status(status).json({ error: message });
        return;
    }

    console.error(`ERROR NO MANEJADO en ${req.method} ${req.originalUrl}:`, error);

    res.status(500).json({ error: 'Error interno del servidor' });
};
