import { avatarPathFromUrl } from './avatarStorage.js';

/*
 * Lógica de scripts/clean-orphan-avatars.ts: decide qué archivos del
 * bucket de fotos ya no usa nadie. Separada del script para poder
 * testearla sin tocar Supabase ni la base.
 */

export type AvatarOwner = {
    id: number;
    avatarUrl: string | null;
};

export type OrphanReason = 'cuenta borrada' | 'foto anterior';

export type OrphanAnalysis = {
    /** Fotos actuales de algún usuario: no se tocan. */
    kept: string[];
    /** Archivos que nadie usa: se pueden borrar. */
    orphans: { path: string; reason: OrphanReason }[];
    /** Archivos fuera de users/{id}/: no se tocan, solo se informan. */
    ignored: string[];
    /** Usuarios cuya foto apunta a un archivo que no existe. */
    missingAvatars: { userId: number; path: string }[];
};

const USER_FILE_REGEX = /^users\/(\d+)\/[^/]+$/;

export function findOrphanAvatars(
    filePaths: string[],
    users: AvatarOwner[],
    bucket: string
): OrphanAnalysis
{
    const existingUserIds = new Set(users.map((user) => user.id));

    const currentPaths = new Map<string, number>();

    for (const user of users)
    {
        const path = avatarPathFromUrl(user.avatarUrl, user.id, bucket);

        if (path)
        {
            currentPaths.set(path, user.id);
        }
    }

    const files = new Set(filePaths);
    const analysis: OrphanAnalysis = {
        kept: [],
        orphans: [],
        ignored: [],
        missingAvatars: [],
    };

    for (const path of [...files].sort())
    {
        const match = USER_FILE_REGEX.exec(path);

        if (!match)
        {
            analysis.ignored.push(path);
            continue;
        }

        if (currentPaths.has(path))
        {
            analysis.kept.push(path);
            continue;
        }

        analysis.orphans.push({
            path,
            reason: existingUserIds.has(Number(match[1]))
                ? 'foto anterior'
                : 'cuenta borrada',
        });
    }

    for (const [path, userId] of currentPaths)
    {
        if (!files.has(path))
        {
            analysis.missingAvatars.push({ userId, path });
        }
    }

    return analysis;
}
