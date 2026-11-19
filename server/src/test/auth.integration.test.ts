import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';
import jwt from 'jsonwebtoken';

const mail = vi.hoisted(() =>
{
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.VERIFICATION_CODE_SECRET = 'test-verification-code-secret';

    return {
        sendVerificationEmail: vi.fn(async () => undefined),
        sendEmailChangeVerification: vi.fn(async () => undefined),
        sendPasswordResetEmail: vi.fn(async () => undefined),
    };
});

vi.mock('dotenv/config', () => ({}));
vi.mock('../lib/prisma.js', async () => ({
    default: (await import('./fakePrisma.js')).fakePrisma,
}));
vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../services/email.js', () => mail);

import app from '../app.js';
import { db } from './fakePrisma.js';
import {
    createUser,
    lastCodeSent,
    otherCode,
    TEST_JWT_SECRET,
    tokenFor,
    uniqueEmail,
    uniqueIp,
} from './helpers.js';

const post = (path: string, body: object, ip = uniqueIp()) =>
    request(app)
        .post(path)
        .set('X-Forwarded-For', ip)
        .send(body);

const authedPost = (path: string, token: string, body: object, ip = uniqueIp()) =>
    post(path, body, ip).set('Authorization', `Bearer ${token}`);

const userRow = (id: number) =>
    db.users.rows.find((row) => row.id === id)!;

beforeEach(() =>
{
    db.reset();
    vi.clearAllMocks();
});

describe('POST /users/login', () =>
{
    it('400 si faltan datos', async () =>
    {
        const res = await post('/users/login', { email: 'a@b.com' });

        expect(res.status).toBe(400);
        expect(res.body.error).toBeTypeOf('string');
    });

    it('401 con el mismo mensaje para contraseña incorrecta y email inexistente', async () =>
    {
        const user = await createUser();

        const wrongPassword = await post('/users/login', { email: user.email, password: 'otra' });
        const unknownEmail = await post('/users/login', { email: uniqueEmail(), password: 'otra' });

        expect(wrongPassword.status).toBe(401);
        expect(unknownEmail.status).toBe(401);
        expect(wrongPassword.body.error).toBe(unknownEmail.body.error);
    });

    it('403 si el email no está verificado', async () =>
    {
        const user = await createUser({ emailVerified: false });

        const res = await post('/users/login', { email: user.email, password: user.password });

        expect(res.status).toBe(403);
        expect(res.body.requiresEmailVerification).toBe(true);
    });

    it('200 con token válido y sin exponer el hash', async () =>
    {
        const user = await createUser();

        const res = await post('/users/login', {
            email: `  ${user.email.toUpperCase()} `,
            password: user.password,
        });

        expect(res.status).toBe(200);
        expect(jwt.verify(res.body.token, TEST_JWT_SECRET)).toMatchObject({ userId: user.id });
        expect(res.body.user).toEqual({
            id: user.id,
            name: 'Usuario de prueba',
            email: user.email,
            avatarUrl: null,
        });
    });

    it('bloquea un email tras 10 fallos aunque vengan de IPs distintas', async () =>
    {
        const user = await createUser();

        for (let i = 0; i < 10; i++)
        {
            expect((await post('/users/login', { email: user.email, password: 'mal' })).status)
                .toBe(401);
        }

        const blocked = await post('/users/login', { email: user.email, password: user.password });

        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toBe('Demasiados intentos. Probá de nuevo en unos minutos.');
        expect(blocked.headers['retry-after']).toBeDefined();

        // Otro email no se ve afectado.
        const other = await createUser();
        expect((await post('/users/login', { email: other.email, password: other.password })).status)
            .toBe(200);
    });

    it('bloquea una IP tras 20 fallos con emails distintos', async () =>
    {
        const ip = uniqueIp();

        for (let i = 0; i < 20; i++)
        {
            expect((await post('/users/login', { email: uniqueEmail(), password: 'mal' }, ip)).status)
                .toBe(401);
        }

        const user = await createUser();
        expect((await post('/users/login', { email: user.email, password: user.password }, ip)).status)
            .toBe(429);
    });

    it('los logins exitosos y los 403 no consumen el límite (CGNAT)', async () =>
    {
        const ip = uniqueIp();
        const verified = await createUser();
        const unverified = await createUser({ emailVerified: false });

        for (let i = 0; i < 25; i++)
        {
            expect((await post('/users/login', { email: verified.email, password: verified.password }, ip)).status)
                .toBe(200);
        }

        for (let i = 0; i < 12; i++)
        {
            expect((await post('/users/login', { email: unverified.email, password: unverified.password }, ip)).status)
                .toBe(403);
        }
    });
});

describe('registro y POST /users/verify-email', () =>
{
    const register = async (email = uniqueEmail()) =>
    {
        const res = await post('/users', { name: 'Ana', email, password: 'contraseña-segura' });
        expect(res.status).toBe(201);
        return { email, id: res.body.user.id as number, code: lastCodeSent(mail.sendVerificationEmail, email) };
    };

    it('guarda solo el hash del código y verifica con el código correcto', async () =>
    {
        const { email, id, code } = await register();

        expect(userRow(id).emailVerificationCodeHash).toMatch(/^[0-9a-f]{64}$/);
        expect(JSON.stringify(userRow(id))).not.toContain(code);

        const res = await post('/users/verify-email', { email, code });

        expect(res.status).toBe(200);
        expect(jwt.verify(res.body.token, TEST_JWT_SECRET)).toMatchObject({ userId: id });
        expect(userRow(id)).toMatchObject({
            emailVerified: true,
            emailVerificationCodeHash: null,
            emailVerificationAttempts: 0,
        });

        // El código no se puede reutilizar.
        expect((await post('/users/verify-email', { email, code })).status).toBe(400);
    });

    it('invalida el código al quinto fallo; un código nuevo vuelve a funcionar', async () =>
    {
        const { email, id, code } = await register();

        for (let i = 0; i < 4; i++)
        {
            expect((await post('/users/verify-email', { email, code: otherCode(code) })).status)
                .toBe(400);
        }

        const fifth = await post('/users/verify-email', { email, code: otherCode(code) });
        expect(fifth.status).toBe(429);
        expect(fifth.body.error).toBe('Demasiados intentos fallidos. Pedí un código nuevo.');

        expect((await post('/users/verify-email', { email, code })).status).toBe(400);
        expect(userRow(id).emailVerified).toBe(false);

        expect((await post('/users/resend-verification', { email })).status).toBe(200);
        const newCode = lastCodeSent(mail.sendVerificationEmail, email);

        expect((await post('/users/verify-email', { email, code: newCode })).status).toBe(200);
    });

    it('400 genérico para un email inexistente', async () =>
    {
        const res = await post('/users/verify-email', { email: uniqueEmail(), code: '123456' });

        expect(res.status).toBe(400);
    });

    it('limita verify-email a 30 por IP cada 15 minutos', async () =>
    {
        const ip = uniqueIp();

        for (let i = 0; i < 30; i++)
        {
            expect((await post('/users/verify-email', { email: uniqueEmail(), code: '123456' }, ip)).status)
                .toBe(400);
        }

        expect((await post('/users/verify-email', { email: uniqueEmail(), code: '123456' }, ip)).status)
            .toBe(429);
    });

    it('limita el registro a 5 por IP por hora', async () =>
    {
        const ip = uniqueIp();

        for (let i = 0; i < 5; i++)
        {
            expect((await post('/users', { name: 'A', email: uniqueEmail(), password: 'contraseña-segura' }, ip)).status)
                .toBe(201);
        }

        expect((await post('/users', { name: 'A', email: uniqueEmail(), password: 'contraseña-segura' }, ip)).status)
            .toBe(429);
    });

    it('limita resend-verification a 3 por email por hora', async () =>
    {
        const { email } = await register();

        for (let i = 0; i < 3; i++)
        {
            expect((await post('/users/resend-verification', { email })).status).toBe(200);
        }

        const blocked = await post('/users/resend-verification', { email });
        expect(blocked.status).toBe(429);
        expect(blocked.body.error).toBe('Pediste demasiados códigos. Probá de nuevo más tarde.');
    });
});

describe('POST /users/password-reset/request y /confirm', () =>
{
    const GENERIC =
        'Si existe una cuenta asociada a ese email, recibirás un código para restablecer tu contraseña.';

    it('responde igual para un email inexistente y no envía nada', async () =>
    {
        const res = await post('/users/password-reset/request', { email: uniqueEmail() });

        expect(res.status).toBe(200);
        expect(res.body.message).toBe(GENERIC);
        expect(mail.sendPasswordResetEmail).not.toHaveBeenCalled();
    });

    it('restablece la contraseña con el código correcto, una sola vez', async () =>
    {
        const user = await createUser();

        const requested = await post('/users/password-reset/request', { email: user.email });
        expect(requested.body.message).toBe(GENERIC);
        const code = lastCodeSent(mail.sendPasswordResetEmail, user.email);

        const confirm = await post('/users/password-reset/confirm', {
            email: user.email,
            code,
            newPassword: 'nueva-contraseña',
        });
        expect(confirm.status).toBe(200);

        expect((await post('/users/login', { email: user.email, password: 'nueva-contraseña' })).status)
            .toBe(200);
        expect((await post('/users/login', { email: user.email, password: user.password })).status)
            .toBe(401);

        const reused = await post('/users/password-reset/confirm', {
            email: user.email,
            code,
            newPassword: 'otra-contraseña',
        });
        expect(reused.status).toBe(400);
    });

    it('invalida el código al quinto fallo y no cambia la contraseña', async () =>
    {
        const user = await createUser();
        await post('/users/password-reset/request', { email: user.email });
        const code = lastCodeSent(mail.sendPasswordResetEmail, user.email);
        const confirm = (c: string) => post('/users/password-reset/confirm', {
            email: user.email,
            code: c,
            newPassword: 'nueva-contraseña',
        });

        for (let i = 0; i < 4; i++)
        {
            expect((await confirm(otherCode(code))).status).toBe(400);
        }

        expect((await confirm(otherCode(code))).status).toBe(429);
        expect((await confirm(code)).status).toBe(400);
        expect((await post('/users/login', { email: user.email, password: user.password })).status)
            .toBe(200);
    });

    it('limita las solicitudes a 3 por email por hora, exista o no la cuenta', async () =>
    {
        for (const email of [(await createUser()).email, uniqueEmail()])
        {
            for (let i = 0; i < 3; i++)
            {
                expect((await post('/users/password-reset/request', { email })).status).toBe(200);
            }

            expect((await post('/users/password-reset/request', { email })).status).toBe(429);
        }
    });

    it('limita las solicitudes a 10 por IP por hora', async () =>
    {
        const ip = uniqueIp();

        for (let i = 0; i < 10; i++)
        {
            expect((await post('/users/password-reset/request', { email: uniqueEmail() }, ip)).status)
                .toBe(200);
        }

        expect((await post('/users/password-reset/request', { email: uniqueEmail() }, ip)).status)
            .toBe(429);
    });
});

describe('POST /users/me/email-change y /verify', () =>
{
    it('401 sin sesión', async () =>
    {
        const res = await post('/users/me/email-change', { email: uniqueEmail() });

        expect(res.status).toBe(401);
    });

    it('cambia el email con el código enviado al email nuevo', async () =>
    {
        const user = await createUser();
        const newEmail = uniqueEmail('nuevo');

        expect((await authedPost('/users/me/email-change', user.token, { email: newEmail })).status)
            .toBe(200);
        const code = lastCodeSent(mail.sendEmailChangeVerification, newEmail);

        const res = await authedPost('/users/me/email-change/verify', user.token, { code });

        expect(res.status).toBe(200);
        expect(res.body).toEqual({
            id: user.id,
            name: 'Usuario de prueba',
            email: newEmail,
            avatarUrl: null,
        });
        expect(userRow(user.id)).toMatchObject({
            email: newEmail,
            pendingEmail: null,
            emailChangeCodeHash: null,
        });
    });

    it('el código queda atado al email pedido: pedir otro invalida el anterior', async () =>
    {
        const user = await createUser();
        const first = uniqueEmail('a');
        const second = uniqueEmail('b');

        await authedPost('/users/me/email-change', user.token, { email: first });
        const firstCode = lastCodeSent(mail.sendEmailChangeVerification, first);
        await authedPost('/users/me/email-change', user.token, { email: second });
        const secondCode = lastCodeSent(mail.sendEmailChangeVerification, second);

        if (firstCode !== secondCode)
        {
            expect((await authedPost('/users/me/email-change/verify', user.token, { code: firstCode })).status)
                .toBe(400);
        }

        expect((await authedPost('/users/me/email-change/verify', user.token, { code: secondCode })).status)
            .toBe(200);
        expect(userRow(user.id).email).toBe(second);
    });

    it('409 si el email nuevo ya está en uso', async () =>
    {
        const user = await createUser();
        const taken = await createUser();

        const res = await authedPost('/users/me/email-change', user.token, { email: taken.email });

        expect(res.status).toBe(409);
        expect(mail.sendEmailChangeVerification).not.toHaveBeenCalled();
    });

    it('invalida el código al quinto fallo', async () =>
    {
        const user = await createUser();
        const newEmail = uniqueEmail();
        await authedPost('/users/me/email-change', user.token, { email: newEmail });
        const code = lastCodeSent(mail.sendEmailChangeVerification, newEmail);

        for (let i = 0; i < 4; i++)
        {
            expect((await authedPost('/users/me/email-change/verify', user.token, { code: otherCode(code) })).status)
                .toBe(400);
        }

        expect((await authedPost('/users/me/email-change/verify', user.token, { code: otherCode(code) })).status)
            .toBe(429);
        expect((await authedPost('/users/me/email-change/verify', user.token, { code })).status)
            .toBe(400);
        expect(userRow(user.id).email).toBe(user.email);
    });

    it('limita a 3 solicitudes por usuario por hora', async () =>
    {
        const user = await createUser();

        for (let i = 0; i < 3; i++)
        {
            expect((await authedPost('/users/me/email-change', user.token, { email: uniqueEmail() })).status)
                .toBe(200);
        }

        expect((await authedPost('/users/me/email-change', user.token, { email: uniqueEmail() })).status)
            .toBe(429);

        // Otro usuario no se ve afectado.
        const other = await createUser();
        expect((await authedPost('/users/me/email-change', other.token, { email: uniqueEmail() })).status)
            .toBe(200);
    });

    it('rechaza un token firmado con otro secreto', async () =>
    {
        const user = await createUser();
        const forged = jwt.sign({ userId: user.id }, 'otro-secreto');

        expect((await authedPost('/users/me/email-change', forged, { email: uniqueEmail() })).status)
            .toBe(401);
        expect(tokenFor(user.id)).not.toBe(forged);
    });
});
