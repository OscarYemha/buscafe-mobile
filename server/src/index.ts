import 'dotenv/config';
import app from './app.js';

/*
 * Sin estos secretos el login y los códigos de verificación fallan
 * en la primera request. Cortamos el arranque para que un deploy
 * mal configurado se note de inmediato.
 */
const REQUIRED_SECRETS = [
    'JWT_SECRET',
    'VERIFICATION_CODE_SECRET',
] as const;

const missingSecrets = REQUIRED_SECRETS.filter(
    (name) => !process.env[name]?.trim()
);

if (missingSecrets.length > 0)
{
    console.error(
        `Faltan variables de entorno obligatorias: ${missingSecrets.join(', ')}. ` +
        'El servidor no se va a iniciar.'
    );

    process.exit(1);
}

const PORT = Number(process.env.PORT) || 3001;


app.listen(PORT, () => {
    console.log(`Servidor de BusCafé ejecutándose en el puerto ${PORT}`);
})
