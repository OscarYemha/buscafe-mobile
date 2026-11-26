import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.hoisted(() =>
{
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.VERIFICATION_CODE_SECRET = 'test-verification-code-secret';
});

vi.mock('dotenv/config', () => ({}));
vi.mock('../lib/prisma.js', async () => ({
    default: (await import('./fakePrisma.js')).fakePrisma,
}));
vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../services/email.js', () => ({
    sendVerificationEmail: vi.fn(),
    sendEmailChangeVerification: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
}));

import app from '../app.js';
import { db, fakePrisma } from './fakePrisma.js';
import { createUser, uniqueIp } from './helpers.js';

beforeEach(() =>
{
    db.reset();
    vi.restoreAllMocks();
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('rutas inexistentes', () =>
{
    it('responden 404 en JSON, no la página HTML de Express', async () =>
    {
        const res = await request(app).get('/no-existe');

        expect(res.status).toBe(404);
        expect(res.headers['content-type']).toMatch(/application\/json/);
        expect(res.body).toEqual({ error: 'Ruta no encontrada' });
    });

    // Endpoints públicos sin uso desde la app: listaban todos los cafés de
    // la base y un café con sus reseñas y los nombres de sus autores.
    it.each(['/cafes', '/cafes/1'])('GET %s ya no existe', async (path) =>
    {
        const res = await request(app).get(path);

        expect(res.status).toBe(404);
        expect(res.body).toEqual({ error: 'Ruta no encontrada' });
    });
});

describe('errores al leer el body', () =>
{
    it('JSON mal formado responde 400 en JSON', async () =>
    {
        const res = await request(app)
            .post('/users/login')
            .set('X-Forwarded-For', uniqueIp())
            .set('Content-Type', 'application/json')
            .send('{"email": ');

        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'El cuerpo de la solicitud no es un JSON válido' });
    });

    it('un body demasiado grande responde 413 en JSON', async () =>
    {
        const res = await request(app)
            .post('/users/login')
            .set('X-Forwarded-For', uniqueIp())
            .send({ email: 'a@b.com', password: 'x'.repeat(200 * 1024) });

        expect(res.status).toBe(413);
        expect(res.body).toEqual({ error: 'La solicitud es demasiado grande' });
    });
});

describe('errores no manejados', () =>
{
    it('responden 500 en JSON sin detalles internos, y quedan en el log', async () =>
    {
        const user = await createUser();
        vi.spyOn(fakePrisma.user, 'findUnique')
            .mockRejectedValueOnce(new Error('connection refused a db-interna:5432'));

        const res = await request(app)
            .get('/users/me')
            .set('Authorization', `Bearer ${user.token}`);

        expect(res.status).toBe(500);
        expect(res.body).toEqual({ error: 'Error interno del servidor' });
        expect(JSON.stringify(res.body)).not.toContain('db-interna');
        expect(console.error).toHaveBeenCalled();
    });
});
