import express from 'express';
import cafesRouter from './routes/cafes.routes.js';
import usersRouter from './routes/users.routes.js';
import reviewsRouter from './routes/reviews.routes.js';
import favoritesRouter from './routes/favorites.routes.js';
import { requireAuth } from './middleware/auth.js';
import { TRUSTED_PROXIES } from './lib/trustProxy.js';

const app = express();

/*
 * En Render la API corre detrás de varios proxies: ver TRUSTED_PROXIES
 * para que req.ip sea la IP real del cliente (lo usa el rate limiting).
 */
app.set('trust proxy', TRUSTED_PROXIES);

app.use(express.json());

app.get('/', (req, res) => {
    res.json({
        message: 'API de BusCafé funcionando correctamente',
    });
});

/*
 * TEMPORAL: diagnóstico para confirmar en Render que req.ip es la IP
 * real del cliente y no la del proxy. Requiere sesión. Borrar cuando
 * esté confirmado.
 */
app.get('/debug/ip', requireAuth, (req, res) => {
    res.json({
        ip: req.ip,
        ips: req.ips,
        xForwardedFor: req.headers['x-forwarded-for'] ?? null,
        remoteAddress: req.socket.remoteAddress ?? null,
    });
});

app.use('/cafes', cafesRouter);
app.use('/users', usersRouter);
app.use('/reviews', reviewsRouter);
app.use('/favorites', favoritesRouter);

export default app;