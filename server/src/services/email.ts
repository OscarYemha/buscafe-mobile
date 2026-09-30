import { Resend } from 'resend';

const resendApiKey =
    process.env.RESEND_API_KEY;

if (!resendApiKey)
{
    throw new Error(
        'RESEND_API_KEY no está configurado'
    );
}

const resend =
    new Resend(resendApiKey);

export const sendVerificationEmail =
    async (
        email: string,
        code: string
    ) => {
        const { error } =
            await resend.emails.send({
                from: 'BusCafé <onboarding@resend.dev>',
                to: email,
                subject:
                    'Verificá tu email en BusCafé',
                html: `
                    <h2>BusCafé</h2>
                    <p>Tu código de verificación es:</p>
                    <p style="font-size: 28px; font-weight: bold;">
                        ${code}
                    </p>
                    <p>Este código vence en 15 minutos.</p>
                `,
            });

        if (error)
        {
            throw new Error(
                `No se pudo enviar el email: ${error.message}`
            );
        }
    };