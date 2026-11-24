import { describe, expect, it, vi } from 'vitest';
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
import { fakePrisma } from './fakePrisma.js';

describe('GET /health', () =>
{
    it('200 si la base responde, sin pedir autenticación', async () =>
    {
        const spy = vi.spyOn(fakePrisma, '$queryRaw');

        const res = await request(app).get('/health');

        expect(res.status).toBe(200);
        expect(res.body).toEqual({ status: 'ok' });
        // Tiene que consultar la base: es lo que evita que Supabase se pause.
        expect(spy).toHaveBeenCalledOnce();
    });

    it('503 si la base no responde', async () =>
    {
        vi.spyOn(fakePrisma, '$queryRaw')
            .mockRejectedValueOnce(new Error('base caída'));

        const res = await request(app).get('/health');

        expect(res.status).toBe(503);
        expect(res.body).toEqual({ status: 'unavailable' });
    });
});
