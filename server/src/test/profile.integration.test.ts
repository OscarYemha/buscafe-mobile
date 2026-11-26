import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const bucket = vi.hoisted(() =>
{
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.VERIFICATION_CODE_SECRET = 'test-verification-code-secret';

    return {
        upload: vi.fn(),
        getPublicUrl: vi.fn(),
        list: vi.fn(),
        remove: vi.fn(),
    };
});

vi.mock('dotenv/config', () => ({}));
vi.mock('../lib/prisma.js', async () => ({
    default: (await import('./fakePrisma.js')).fakePrisma,
}));
vi.mock('../lib/supabase.js', () => ({
    supabase: { storage: { from: vi.fn(() => bucket) } },
}));
vi.mock('../services/email.js', () => ({
    sendVerificationEmail: vi.fn(),
    sendEmailChangeVerification: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
}));

import app from '../app.js';
import { db, fakePrisma } from './fakePrisma.js';
import { createUser, uniqueIp } from './helpers.js';

const PUBLIC = 'https://abc.supabase.co/storage/v1/object/public/avatars';

const IMAGE = Buffer.from('imagen-de-prueba');
const BIG_IMAGE = Buffer.alloc(5 * 1024 * 1024 + 1);

const userRow = (id: number) => db.users.rows.find((row) => row.id === id)!;

const authed = (method: 'patch' | 'delete', path: string, token: string) =>
    request(app)[method](path)
        .set('X-Forwarded-For', uniqueIp())
        .set('Authorization', `Bearer ${token}`);

beforeEach(() =>
{
    db.reset();
    vi.clearAllMocks();
    bucket.upload.mockResolvedValue({ error: null });
    bucket.getPublicUrl.mockImplementation((path: string) => ({ data: { publicUrl: `${PUBLIC}/${path}` } }));
    bucket.list.mockResolvedValue({ data: [], error: null });
    bucket.remove.mockResolvedValue({ error: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('PATCH /users/me (nombre)', () =>
{
    it('actualiza el nombre sin espacios de más', async () =>
    {
        const user = await createUser();

        const res = await authed('patch', '/users/me', user.token).send({ name: '  Oscar  ' });

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Oscar');
        expect(userRow(user.id).name).toBe('Oscar');
    });

    it('400 con el nombre vacío o de más de 100 caracteres', async () =>
    {
        const user = await createUser();

        expect((await authed('patch', '/users/me', user.token).send({ name: '   ' })).status).toBe(400);
        expect((await authed('patch', '/users/me', user.token).send({ name: 'a'.repeat(101) })).status).toBe(400);
    });

    it('401 sin sesión', async () =>
    {
        expect((await request(app).patch('/users/me').send({ name: 'X' })).status).toBe(401);
    });
});

describe('PATCH /users/me/profile (nombre y foto)', () =>
{
    it('solo nombre: no toca el storage', async () =>
    {
        const user = await createUser();

        const res = await authed('patch', '/users/me/profile', user.token).field('name', 'Nuevo nombre');

        expect(res.status).toBe(200);
        expect(res.body.name).toBe('Nuevo nombre');
        expect(bucket.upload).not.toHaveBeenCalled();
    });

    it('con foto: la sube a la carpeta del usuario y guarda la URL', async () =>
    {
        const user = await createUser();

        const res = await authed('patch', '/users/me/profile', user.token)
            .field('name', 'Oscar')
            .attach('avatar', IMAGE, { filename: 'foto.png', contentType: 'image/png' });

        expect(res.status).toBe(200);
        const [path, , options] = bucket.upload.mock.calls[0];
        expect(path).toMatch(new RegExp(`^users/${user.id}/[0-9a-f-]+\\.png$`));
        expect(options).toMatchObject({ contentType: 'image/png', upsert: false });
        expect(res.body.avatarUrl).toBe(`${PUBLIC}/${path}`);
    });

    it('al cambiar la foto borra la anterior, después de guardar la nueva', async () =>
    {
        const user = await createUser();
        userRow(user.id).avatarUrl = `${PUBLIC}/users/${user.id}/vieja.jpg`;

        const res = await authed('patch', '/users/me/profile', user.token)
            .field('name', 'Oscar')
            .attach('avatar', IMAGE, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(200);
        expect(bucket.remove).toHaveBeenCalledWith([`users/${user.id}/vieja.jpg`]);
        expect(userRow(user.id).avatarUrl).not.toContain('vieja.jpg');
    });

    it('si falla borrar la anterior, el cambio de perfil sale igual', async () =>
    {
        const user = await createUser();
        userRow(user.id).avatarUrl = `${PUBLIC}/users/${user.id}/vieja.jpg`;
        bucket.remove.mockResolvedValue({ error: new Error('storage caído') });

        const res = await authed('patch', '/users/me/profile', user.token)
            .field('name', 'Oscar')
            .attach('avatar', IMAGE, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(200);
    });

    it('400 con un formato no permitido, sin subir nada', async () =>
    {
        const user = await createUser();

        const res = await authed('patch', '/users/me/profile', user.token)
            .field('name', 'Oscar')
            .attach('avatar', IMAGE, { filename: 'foto.gif', contentType: 'image/gif' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('Formato de imagen no permitido');
        expect(bucket.upload).not.toHaveBeenCalled();
    });

    it('400 con una imagen de más de 5 MB', async () =>
    {
        const user = await createUser();

        const res = await authed('patch', '/users/me/profile', user.token)
            .field('name', 'Oscar')
            .attach('avatar', BIG_IMAGE, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(400);
        expect(res.body.error).toContain('5 MB');
        expect(bucket.upload).not.toHaveBeenCalled();
    });

    it('500 si falla la subida, sin cambiar el perfil', async () =>
    {
        const user = await createUser();
        bucket.upload.mockResolvedValue({ error: new Error('storage caído') });

        const res = await authed('patch', '/users/me/profile', user.token)
            .field('name', 'Otro')
            .attach('avatar', IMAGE, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(500);
        expect(userRow(user.id).name).not.toBe('Otro');
    });

    it('si falla guardar en la base después de subir, borra la foto nueva', async () =>
    {
        const user = await createUser();
        vi.spyOn(fakePrisma.user, 'update').mockRejectedValueOnce(new Error('base caída'));

        const res = await authed('patch', '/users/me/profile', user.token)
            .field('name', 'Oscar')
            .attach('avatar', IMAGE, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(res.status).toBe(500);
        const uploadedPath = bucket.upload.mock.calls[0][0];
        expect(bucket.remove).toHaveBeenCalledWith([uploadedPath]);
    });
});

describe('PATCH /users/me/avatar', () =>
{
    it('400 sin imagen', async () =>
    {
        const user = await createUser();

        expect((await authed('patch', '/users/me/avatar', user.token)).status).toBe(400);
    });

    it('400 con un formato no permitido', async () =>
    {
        const user = await createUser();

        const res = await authed('patch', '/users/me/avatar', user.token)
            .attach('avatar', IMAGE, { filename: 'foto.gif', contentType: 'image/gif' });

        expect(res.status).toBe(400);
    });

    it('si cambia de JPG a PNG, borra el avatar.jpg viejo', async () =>
    {
        const user = await createUser();
        userRow(user.id).avatarUrl = `${PUBLIC}/users/${user.id}/avatar.jpg?v=1`;

        const res = await authed('patch', '/users/me/avatar', user.token)
            .attach('avatar', IMAGE, { filename: 'foto.png', contentType: 'image/png' });

        expect(res.status).toBe(200);
        expect(bucket.upload.mock.calls[0][0]).toBe(`users/${user.id}/avatar.png`);
        expect(bucket.remove).toHaveBeenCalledWith([`users/${user.id}/avatar.jpg`]);
    });

    it('con el mismo formato no borra nada (se pisa el mismo archivo)', async () =>
    {
        const user = await createUser();
        userRow(user.id).avatarUrl = `${PUBLIC}/users/${user.id}/avatar.jpg?v=1`;

        await authed('patch', '/users/me/avatar', user.token)
            .attach('avatar', IMAGE, { filename: 'foto.jpg', contentType: 'image/jpeg' });

        expect(bucket.remove).not.toHaveBeenCalled();
    });
});

describe('DELETE /users/me: fotos de perfil', () =>
{
    it('borra todas las fotos del usuario, aunque no tenga avatar actual', async () =>
    {
        const user = await createUser();
        bucket.list
            .mockResolvedValueOnce({ data: [{ name: 'avatar.jpg' }, { name: 'a1b2.png' }], error: null })
            .mockResolvedValueOnce({ data: [], error: null });

        const res = await authed('delete', '/users/me', user.token).send({ password: user.password });

        expect(res.status).toBe(200);
        expect(bucket.list).toHaveBeenCalledWith(`users/${user.id}`, { limit: 100 });
        expect(bucket.remove).toHaveBeenCalledWith([
            `users/${user.id}/avatar.jpg`,
            `users/${user.id}/a1b2.png`,
        ]);
    });

    it('si falla el storage, la cuenta se borra igual', async () =>
    {
        const user = await createUser();
        bucket.list.mockResolvedValue({ data: null, error: new Error('storage caído') });

        const res = await authed('delete', '/users/me', user.token).send({ password: user.password });

        expect(res.status).toBe(200);
        expect(db.users.rows.some((row) => row.id === user.id)).toBe(false);
    });
});
