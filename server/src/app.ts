import express from 'express';
import cafesRouter from './routes/cafes.routes.js';
import usersRouter from './routes/users.routes.js';
import reviewsRouter from './routes/reviews.routes.js';
import favoritesRouter from './routes/favorites.routes.js';
import zonesRouter from './routes/zones.routes.js';
import { TRUSTED_PROXIES } from './lib/trustProxy.js';
import prisma from './lib/prisma.js';

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
 * Lo llama el workflow keepalive una vez por día: la consulta a la base
 * evita que Supabase pause el proyecto por inactividad.
 */
app.get('/health', async (req, res) => {
    try
    {
        await prisma.$queryRaw`SELECT 1`;

        return res.json({ status: 'ok' });
    }
    catch (error)
    {
        console.error('Health check: la base no responde', error);

        return res.status(503).json({ status: 'unavailable' });
    }
});

app.use('/cafes', cafesRouter);
app.use('/users', usersRouter);
app.use('/reviews', reviewsRouter);
app.use('/favorites', favoritesRouter);
app.use('/zones', zonesRouter);

export default app;