import { supabase } from '../lib/supabase.js';

/*
 * Fotos de perfil en Supabase Storage. Todas las de un usuario viven en
 * `users/{id}/` dentro del bucket `avatars`, con nombres distintos según
 * desde dónde se subieron (`avatar.jpg` o `{uuid}.jpg`): por eso se borra
 * por carpeta y no por nombre.
 *
 * Ninguna función tira errores: un archivo que no se pudo borrar se
 * registra, pero no rompe el cambio de perfil ni el borrado de la cuenta.
 */

const DEFAULT_AVATAR_BUCKET = 'avatars';

/**
 * Bucket de las fotos. Producción usa `avatars` (sin la variable). En local
 * hay que poner AVATAR_BUCKET=avatars-dev: el server local usa el mismo
 * proyecto de Supabase que producción pero con la base local, y los IDs de
 * usuario no coinciden; con el mismo bucket, borrar una cuenta de prueba
 * borraría las fotos del usuario de producción con ese ID.
 */
export function getAvatarBucket(): string
{
    return process.env.AVATAR_BUCKET?.trim() || DEFAULT_AVATAR_BUCKET;
}

const publicPathMarker = (): string => `/object/public/${getAvatarBucket()}/`;
const LIST_PAGE_SIZE = 100;

export const userAvatarFolder = (userId: number): string =>
    `users/${userId}`;

/**
 * Ruta dentro del bucket a partir de la URL pública guardada en la base
 * (con o sin `?v=...`). null si la URL no es de una foto de ese usuario:
 * así nunca se borra un archivo ajeno.
 */
export function avatarPathFromUrl(
    url: string | null | undefined,
    userId: number
): string | null
{
    if (!url)
    {
        return null;
    }

    const marker = publicPathMarker();
    const markerIndex = url.indexOf(marker);

    if (markerIndex === -1)
    {
        return null;
    }

    const path = decodeURIComponent(
        url.slice(markerIndex + marker.length).split('?')[0] ?? ''
    );

    return path.startsWith(`${userAvatarFolder(userId)}/`) && !path.includes('..')
        ? path
        : null;
}

/** Borra la foto anterior si es del usuario y no es la que se acaba de subir. */
export async function deletePreviousAvatar(
    userId: number,
    previousUrl: string | null | undefined,
    currentPath: string
): Promise<void>
{
    const previousPath = avatarPathFromUrl(previousUrl, userId);

    if (!previousPath || previousPath === currentPath)
    {
        return;
    }

    const { error } = await supabase.storage
        .from(getAvatarBucket())
        .remove([previousPath]);

    if (error)
    {
        console.error('No se pudo borrar la foto de perfil anterior:', error);
    }
}

/** Borra todas las fotos del usuario (al eliminar la cuenta). */
export async function deleteAllUserAvatars(userId: number): Promise<void>
{
    const folder = userAvatarFolder(userId);

    try
    {
        // Se borra lo listado y se vuelve a listar desde el principio hasta
        // que la carpeta quede vacía (o no se pueda borrar más).
        for (;;)
        {
            const { data, error: listError } = await supabase.storage
                .from(getAvatarBucket())
                .list(folder, { limit: LIST_PAGE_SIZE });

            if (listError)
            {
                console.error('No se pudieron listar las fotos del usuario:', listError);
                return;
            }

            const paths = (data ?? []).map((file) => `${folder}/${file.name}`);

            if (paths.length === 0)
            {
                return;
            }

            const { error: removeError } = await supabase.storage
                .from(getAvatarBucket())
                .remove(paths);

            if (removeError)
            {
                console.error('No se pudieron borrar las fotos del usuario:', removeError);
                return;
            }

            if (paths.length < LIST_PAGE_SIZE)
            {
                return;
            }
        }
    }
    catch (error)
    {
        console.error('Error al borrar las fotos del usuario:', error);
    }
}

/**
 * Aviso al arrancar si la base es local pero el bucket es el de producción
 * (ver getAvatarBucket). Devuelve true si avisó.
 */
export function warnIfLocalDatabaseUsesProductionBucket(): boolean
{
    const databaseUrl = process.env.DATABASE_URL ?? '';
    const isLocalDatabase = /@(localhost|127\.0\.0\.1)[:/]/.test(databaseUrl);

    if (isLocalDatabase && getAvatarBucket() === DEFAULT_AVATAR_BUCKET)
    {
        console.warn(
            '⚠️  La base es local pero las fotos van al bucket de producción ' +
            `("${DEFAULT_AVATAR_BUCKET}"). Poné AVATAR_BUCKET=avatars-dev en server/.env.`
        );

        return true;
    }

    return false;
}
