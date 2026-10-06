import { createClient } from '@supabase/supabase-js';

const supabaseUrl =
    process.env.SUPABASE_URL;

const supabaseSecretKey =
    process.env.SUPABASE_SECRET_KEY;

if (!supabaseUrl)
{
    throw new Error(
        'SUPABASE_URL no está definida'
    );
}

if (!supabaseSecretKey)
{
    throw new Error(
        'SUPABASE_SECRET_KEY no está definida'
    );
}

export const supabase =
    createClient(
        supabaseUrl,
        supabaseSecretKey,
        {
            auth: {
                persistSession: false,
                autoRefreshToken: false,
            },
        }
    );