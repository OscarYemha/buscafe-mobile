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

export const AVATAR_BUCKET = 'avatars';

const PUBLIC_PATH_MARKER = `/object/public/${AVATAR_BUCKET}/`;
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

    const markerIndex = url.indexOf(PUBLIC_PATH_MARKER);

    if (markerIndex === -1)
    {
        return null;
    }

    const path = decodeURIComponent(
        url.slice(markerIndex + PUBLIC_PATH_MARKER.length).split('?')[0] ?? ''
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
        .from(AVATAR_BUCKET)
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
                .from(AVATAR_BUCKET)
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
                .from(AVATAR_BUCKET)
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
