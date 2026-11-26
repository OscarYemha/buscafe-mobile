/*
 * Limpia las fotos de perfil huérfanas del bucket de PRODUCCIÓN ("avatars"):
 * las de cuentas borradas y las fotos anteriores que quedaron al cambiar
 * la foto, antes de los arreglos de DELETE /users/me y /me/profile.
 *
 * Uso (desde server/):
 *   read -rs PROD_DATABASE_URL && export PROD_DATABASE_URL
 *   npx tsx scripts/clean-orphan-avatars.ts            # solo lista
 *   npx tsx scripts/clean-orphan-avatars.ts --apply    # borra
 *
 * Seguridad:
 * - Sin --apply no borra nada.
 * - Se niega a correr contra una base local: con los usuarios locales,
 *   casi todas las fotos de producción parecerían huérfanas.
 * - Siempre usa el bucket "avatars", aunque server/.env diga avatars-dev.
 * - Solo toca archivos dentro de users/{id}/.
 *
 * Las credenciales de Supabase salen de server/.env (es el mismo proyecto
 * en local y en producción).
 */
import 'dotenv/config';
import pg from 'pg';
import { supabase } from '../src/lib/supabase.js';
import { findOrphanAvatars, type AvatarOwner } from '../src/services/orphanAvatars.js';

const PRODUCTION_BUCKET = 'avatars';
const PAGE_SIZE = 100;
const apply = process.argv.includes('--apply');

function fail(message: string): never
{
    console.error(`\n✖ ${message}\n`);
    process.exit(1);
}

async function listPage(prefix: string, offset: number)
{
    const { data, error } = await supabase.storage
        .from(PRODUCTION_BUCKET)
        .list(prefix, { limit: PAGE_SIZE, offset, sortBy: { column: 'name', order: 'asc' } });

    if (error)
    {
        fail(`No se pudo listar "${prefix || '/'}" en el bucket: ${error.message}`);
    }

    return data ?? [];
}

/** Todos los archivos del bucket (las carpetas vienen con id null). */
async function listAllFiles(prefix = ''): Promise<string[]>
{
    const files: string[] = [];

    for (let offset = 0; ; offset += PAGE_SIZE)
    {
        const page = await listPage(prefix, offset);

        for (const entry of page)
        {
            const path = prefix ? `${prefix}/${entry.name}` : entry.name;

            if (entry.id === null)
            {
                files.push(...await listAllFiles(path));
            }
            else
            {
                files.push(path);
            }
        }

        if (page.length < PAGE_SIZE)
        {
            return files;
        }
    }
}

async function loadUsers(databaseUrl: string): Promise<AvatarOwner[]>
{
    const client = new pg.Client({ connectionString: databaseUrl });

    await client.connect();

    try
    {
        const { rows } = await client.query<{ id: number; avatarUrl: string | null }>(
            'SELECT id, "avatarUrl" FROM "User"'
        );

        return rows;
    }
    finally
    {
        await client.end();
    }
}

async function main()
{
    const databaseUrl = process.env.PROD_DATABASE_URL?.trim();

    if (!databaseUrl)
    {
        fail('Falta PROD_DATABASE_URL (la URL de la base de producción).');
    }

    // Nunca se imprime nada de la URL salvo el host: puede tener la contraseña.
    let parsed: URL;

    try
    {
        parsed = new URL(databaseUrl);
    }
    catch
    {
        fail('PROD_DATABASE_URL no es una URL válida (no se muestra su contenido).');
    }

    if (!/^postgres(ql)?:$/.test(parsed.protocol) || !parsed.hostname)
    {
        fail('PROD_DATABASE_URL tiene que empezar con postgresql:// e incluir el host.');
    }

    if (['localhost', '127.0.0.1', '::1'].includes(parsed.hostname))
    {
        fail('PROD_DATABASE_URL apunta a una base local. Este script es para producción.');
    }

    console.log(`Base: ${parsed.hostname}${parsed.port ? `:${parsed.port}` : ''}`);
    console.log(`Bucket: ${PRODUCTION_BUCKET}`);
    console.log(`Modo: ${apply ? 'BORRAR (--apply)' : 'solo listar'}\n`);

    const users = await loadUsers(databaseUrl);

    if (users.length === 0)
    {
        fail('La base no tiene usuarios: ¿es la base correcta? No se borra nada.');
    }

    const files = await listAllFiles();
    const analysis = findOrphanAvatars(files, users, PRODUCTION_BUCKET);

    const deletedAccount = analysis.orphans.filter((o) => o.reason === 'cuenta borrada');
    const previousPhoto = analysis.orphans.filter((o) => o.reason === 'foto anterior');

    console.log(`Usuarios en la base:         ${users.length}`);
    console.log(`Archivos en el bucket:       ${files.length}`);
    console.log(`  Fotos actuales (se quedan): ${analysis.kept.length}`);
    console.log(`  Huérfanas, cuenta borrada:  ${deletedAccount.length}`);
    console.log(`  Huérfanas, foto anterior:   ${previousPhoto.length}`);
    console.log(`  Fuera de users/ (se quedan): ${analysis.ignored.length}`);

    for (const { path, reason } of analysis.orphans)
    {
        console.log(`    - ${path}  (${reason})`);
    }

    for (const path of analysis.ignored)
    {
        console.log(`    · ignorado: ${path}`);
    }

    if (analysis.missingAvatars.length > 0)
    {
        console.log(`\nUsuarios con foto que apunta a un archivo inexistente: ${analysis.missingAvatars.length}`);

        for (const { userId, path } of analysis.missingAvatars)
        {
            console.log(`    ! usuario ${userId}: ${path}`);
        }
    }

    if (!apply)
    {
        console.log('\nNo se borró nada. Para borrar, volvé a correrlo con --apply.');
        return;
    }

    if (analysis.orphans.length === 0)
    {
        console.log('\nNo hay nada para borrar.');
        return;
    }

    let deleted = 0;
    const paths = analysis.orphans.map((orphan) => orphan.path);

    for (let i = 0; i < paths.length; i += PAGE_SIZE)
    {
        const batch = paths.slice(i, i + PAGE_SIZE);
        const { data, error } = await supabase.storage.from(PRODUCTION_BUCKET).remove(batch);

        if (error)
        {
            fail(`Falló el borrado después de ${deleted} archivos: ${error.message}`);
        }

        deleted += data?.length ?? 0;
    }

    console.log(`\n✔ Borrados ${deleted} de ${paths.length} archivos huérfanos.`);
}

main().catch((error) =>
{
    fail(error instanceof Error ? error.message : String(error));
});
