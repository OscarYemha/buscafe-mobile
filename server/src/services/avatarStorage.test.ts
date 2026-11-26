import { beforeEach, describe, expect, it, vi } from 'vitest';

const bucket = vi.hoisted(() => ({
    list: vi.fn(),
    remove: vi.fn(),
}));

const from = vi.hoisted(() => vi.fn());

vi.mock('../lib/supabase.js', () => ({
    supabase: { storage: { from } },
}));

import {
    avatarPathFromUrl,
    deleteAllUserAvatars,
    deletePreviousAvatar,
    getAvatarBucket,
    warnIfLocalDatabaseUsesProductionBucket,
} from './avatarStorage.js';

const PUBLIC = 'https://abc.supabase.co/storage/v1/object/public/avatars';

beforeEach(() =>
{
    vi.clearAllMocks();
    vi.unstubAllEnvs();
    from.mockReturnValue(bucket);
    bucket.remove.mockResolvedValue({ error: null });
    vi.spyOn(console, 'error').mockImplementation(() => undefined);
});

describe('avatarPathFromUrl', () =>
{
    it('saca la ruta dentro del bucket, con o sin ?v=', () =>
    {
        expect(avatarPathFromUrl(`${PUBLIC}/users/7/abc.jpg`, 7)).toBe('users/7/abc.jpg');
        expect(avatarPathFromUrl(`${PUBLIC}/users/7/avatar.png?v=123`, 7)).toBe('users/7/avatar.png');
    });

    it('no devuelve rutas de otro usuario ni rutas raras (nunca se borra algo ajeno)', () =>
    {
        expect(avatarPathFromUrl(`${PUBLIC}/users/8/abc.jpg`, 7)).toBeNull();
        expect(avatarPathFromUrl(`${PUBLIC}/users/70/abc.jpg`, 7)).toBeNull();
        expect(avatarPathFromUrl(`${PUBLIC}/users/7/../8/abc.jpg`, 7)).toBeNull();
        expect(avatarPathFromUrl('https://otro-sitio.com/foto.jpg', 7)).toBeNull();
        expect(avatarPathFromUrl(null, 7)).toBeNull();
    });
});

describe('deletePreviousAvatar', () =>
{
    it('borra la foto anterior del usuario', async () =>
    {
        await deletePreviousAvatar(7, `${PUBLIC}/users/7/vieja.jpg`, 'users/7/nueva.jpg');

        expect(bucket.remove).toHaveBeenCalledWith(['users/7/vieja.jpg']);
    });

    it('no borra si es la misma que se acaba de subir (avatar.jpg con upsert)', async () =>
    {
        await deletePreviousAvatar(7, `${PUBLIC}/users/7/avatar.jpg?v=1`, 'users/7/avatar.jpg');

        expect(bucket.remove).not.toHaveBeenCalled();
    });

    it('no borra si no había foto o si no es del usuario', async () =>
    {
        await deletePreviousAvatar(7, null, 'users/7/nueva.jpg');
        await deletePreviousAvatar(7, `${PUBLIC}/users/8/ajena.jpg`, 'users/7/nueva.jpg');

        expect(bucket.remove).not.toHaveBeenCalled();
    });

    it('si Supabase falla, lo registra sin tirar error', async () =>
    {
        bucket.remove.mockResolvedValue({ error: new Error('storage caído') });

        await expect(
            deletePreviousAvatar(7, `${PUBLIC}/users/7/vieja.jpg`, 'users/7/nueva.jpg')
        ).resolves.toBeUndefined();
        expect(console.error).toHaveBeenCalled();
    });
});

describe('deleteAllUserAvatars', () =>
{
    const files = (...names: string[]) => names.map((name) => ({ name }));

    it('borra todos los archivos de la carpeta del usuario, se llamen como se llamen', async () =>
    {
        bucket.list
            .mockResolvedValueOnce({ data: files('avatar.jpg', 'a1b2.png', 'c3d4.webp'), error: null })
            .mockResolvedValueOnce({ data: [], error: null });

        await deleteAllUserAvatars(7);

        expect(bucket.list).toHaveBeenCalledWith('users/7', { limit: 100 });
        expect(bucket.remove).toHaveBeenCalledWith([
            'users/7/avatar.jpg',
            'users/7/a1b2.png',
            'users/7/c3d4.webp',
        ]);
    });

    it('con la carpeta vacía no borra nada', async () =>
    {
        bucket.list.mockResolvedValue({ data: [], error: null });

        await deleteAllUserAvatars(7);

        expect(bucket.remove).not.toHaveBeenCalled();
    });

    it('con más de una página, sigue hasta vaciar la carpeta', async () =>
    {
        const page = Array.from({ length: 100 }, (_, i) => ({ name: `${i}.jpg` }));
        bucket.list
            .mockResolvedValueOnce({ data: page, error: null })
            .mockResolvedValueOnce({ data: files('ultima.jpg'), error: null });

        await deleteAllUserAvatars(7);

        expect(bucket.remove).toHaveBeenCalledTimes(2);
        expect(bucket.remove).toHaveBeenLastCalledWith(['users/7/ultima.jpg']);
    });

    it('si falla listar o borrar, lo registra y corta sin tirar error (y sin loop infinito)', async () =>
    {
        bucket.list.mockResolvedValue({ data: null, error: new Error('sin permisos') });
        await expect(deleteAllUserAvatars(7)).resolves.toBeUndefined();

        bucket.list.mockResolvedValue({ data: Array.from({ length: 100 }, (_, i) => ({ name: `${i}` })), error: null });
        bucket.remove.mockResolvedValue({ error: new Error('no se pudo') });
        await expect(deleteAllUserAvatars(7)).resolves.toBeUndefined();
        expect(bucket.remove).toHaveBeenCalledTimes(1);
    });
});

describe('bucket configurable (local separado de producción)', () =>
{
    const DEV = 'https://abc.supabase.co/storage/v1/object/public/avatars-dev';

    it('sin AVATAR_BUCKET usa el de producción', () =>
    {
        vi.stubEnv('AVATAR_BUCKET', '');

        expect(getAvatarBucket()).toBe('avatars');
    });

    it('con AVATAR_BUCKET usa ese bucket para borrar', async () =>
    {
        vi.stubEnv('AVATAR_BUCKET', 'avatars-dev');

        await deletePreviousAvatar(7, `${DEV}/users/7/vieja.jpg`, 'users/7/nueva.jpg');

        expect(from).toHaveBeenCalledWith('avatars-dev');
        expect(bucket.remove).toHaveBeenCalledWith(['users/7/vieja.jpg']);
    });

    // Desde local nunca se borra una foto de producción, aunque su URL haya
    // quedado guardada en la base local.
    it('en local no reconoce como propias las URLs del bucket de producción', async () =>
    {
        vi.stubEnv('AVATAR_BUCKET', 'avatars-dev');

        expect(avatarPathFromUrl(`${PUBLIC}/users/7/avatar.jpg`, 7)).toBeNull();

        await deletePreviousAvatar(7, `${PUBLIC}/users/7/avatar.jpg`, 'users/7/nueva.jpg');
        expect(bucket.remove).not.toHaveBeenCalled();
    });

    it('avisa al arrancar si la base es local y el bucket es el de producción', () =>
    {
        const warn = vi.spyOn(console, 'warn').mockImplementation(() => undefined);

        vi.stubEnv('DATABASE_URL', 'postgresql://u:p@localhost:5432/buscafe');
        vi.stubEnv('AVATAR_BUCKET', '');
        expect(warnIfLocalDatabaseUsesProductionBucket()).toBe(true);

        vi.stubEnv('AVATAR_BUCKET', 'avatars-dev');
        expect(warnIfLocalDatabaseUsesProductionBucket()).toBe(false);

        vi.stubEnv('DATABASE_URL', 'postgresql://u:p@aws-0.pooler.supabase.com:5432/postgres');
        vi.stubEnv('AVATAR_BUCKET', '');
        expect(warnIfLocalDatabaseUsesProductionBucket()).toBe(false);

        expect(warn).toHaveBeenCalledTimes(1);
    });
});
