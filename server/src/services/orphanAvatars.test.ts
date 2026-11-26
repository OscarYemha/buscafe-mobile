import { describe, expect, it, vi } from 'vitest';

vi.mock('../lib/supabase.js', () => ({ supabase: {} }));

import { findOrphanAvatars } from './orphanAvatars.js';

const PUBLIC = 'https://abc.supabase.co/storage/v1/object/public/avatars';

describe('findOrphanAvatars', () =>
{
    it('conserva las fotos actuales y marca las demás con el motivo', () =>
    {
        const result = findOrphanAvatars(
            [
                'users/1/actual.jpg',
                'users/1/vieja.jpg',
                'users/2/avatar.png',
                'users/9/de-cuenta-borrada.jpg',
            ],
            [
                { id: 1, avatarUrl: `${PUBLIC}/users/1/actual.jpg` },
                { id: 2, avatarUrl: `${PUBLIC}/users/2/avatar.png?v=123` },
            ],
            'avatars'
        );

        expect(result.kept).toEqual(['users/1/actual.jpg', 'users/2/avatar.png']);
        expect(result.orphans).toEqual([
            { path: 'users/1/vieja.jpg', reason: 'foto anterior' },
            { path: 'users/9/de-cuenta-borrada.jpg', reason: 'cuenta borrada' },
        ]);
    });

    it('un usuario sin foto actual: todas sus fotos son anteriores', () =>
    {
        const result = findOrphanAvatars(['users/3/a.jpg'], [{ id: 3, avatarUrl: null }], 'avatars');

        expect(result.orphans).toEqual([{ path: 'users/3/a.jpg', reason: 'foto anterior' }]);
    });

    it('no toca archivos fuera de users/{id}/', () =>
    {
        const result = findOrphanAvatars(
            ['logo.png', 'users/abc/x.jpg', 'users/1/sub/x.jpg'],
            [{ id: 1, avatarUrl: null }],
            'avatars'
        );

        expect(result.orphans).toEqual([]);
        expect(result.ignored).toEqual(['logo.png', 'users/1/sub/x.jpg', 'users/abc/x.jpg']);
    });

    // Las URLs de otro bucket (por ejemplo avatars-dev) no cuentan como foto
    // actual en el bucket que se está limpiando.
    it('usa el bucket indicado para reconocer las fotos actuales', () =>
    {
        const result = findOrphanAvatars(
            ['users/1/a.jpg'],
            [{ id: 1, avatarUrl: 'https://abc.supabase.co/storage/v1/object/public/avatars-dev/users/1/a.jpg' }],
            'avatars'
        );

        expect(result.orphans).toEqual([{ path: 'users/1/a.jpg', reason: 'foto anterior' }]);
    });

    it('informa los usuarios cuya foto apunta a un archivo que no existe', () =>
    {
        const result = findOrphanAvatars(
            [],
            [{ id: 5, avatarUrl: `${PUBLIC}/users/5/avatar.jpg?v=1` }],
            'avatars'
        );

        expect(result.missingAvatars).toEqual([{ userId: 5, path: 'users/5/avatar.jpg' }]);
    });
});
