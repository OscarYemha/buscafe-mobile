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

const BUSCAFE_LOGO_URL =
    'https://olhkkfjitcdldotxlahi.supabase.co/storage/v1/object/public/public-assets/buscafe-splash-transparent.png?v=2';

function createEmailTemplate(
    title: string,
    description: string,
    code: string,
    footer?: string
): string
{
    return `
        <!DOCTYPE html>
        <html lang="es">
            <body
                style="
                    margin: 0;
                    padding: 0;
                    background-color: #F8F1E7;
                    font-family: Arial, Helvetica, sans-serif;
                    color: #4A2416;
                "
            >
                <table
                    width="100%"
                    cellpadding="0"
                    cellspacing="0"
                    border="0"
                    style="
                        background-color: #F8F1E7;
                        padding: 20px 16px;
                    "
                >
                    <tr>
                        <td align="center">
                            <table
                                width="100%"
                                cellpadding="0"
                                cellspacing="0"
                                border="0"
                                style="
                                    max-width: 520px;
                                    background-color: #FFFFFF;
                                    border-radius: 18px;
                                    border: 1px solid #E8D9C7;
                                    padding: 24px 28px;
                                "
                            >
                                <tr>
                                    <td
                                        align="center"
                                        style="
                                            padding: 32px 28px;
                                        "
                                    >
                                        <img
                                            src="${BUSCAFE_LOGO_URL}"
                                            alt="BusCafé"
                                            width="230"
                                            style="
                                                display: block;
                                                width: 220px;
                                                max-width: 100%;
                                                height: auto;
                                                margin: 0 auto 18px auto;
                                            "
                                        />

                                        <h1
                                            style="
                                                margin: 0 0 16px 0;
                                                font-size: 24px;
                                                color: #4A2416;
                                            "
                                        >
                                            ${title}
                                        </h1>

                                        <p
                                            style="
                                                margin: 0 0 24px 0;
                                                font-size: 16px;
                                                line-height: 24px;
                                                color: #7A6254;
                                            "
                                        >
                                            ${description}
                                        </p>

                                        <div
                                            style="
                                                display: inline-block;
                                                padding: 16px 24px;
                                                background-color: #F3E4C8;
                                                border-radius: 14px;
                                                font-size: 30px;
                                                font-weight: bold;
                                                letter-spacing: 6px;
                                                color: #6B3A22;
                                            "
                                        >
                                            ${code}
                                        </div>

                                        <p
                                            style="
                                                margin: 18px 0 0 0;
                                                font-size: 14px;
                                                line-height: 21px;
                                                color: #7A6254;
                                            "
                                        >
                                            Este código vence en
                                            <strong>15 minutos</strong>.
                                        </p>

                                        ${
                                            footer
                                                ? `
                                                    <p
                                                        style="
                                                            margin: 18px 0 0 0;
                                                            font-size: 13px;
                                                            line-height: 20px;
                                                            color: #9A8578;
                                                        "
                                                    >
                                                        ${footer}
                                                    </p>
                                                `
                                                : ''
                                        }
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                </table>
            </body>
        </html>
    `;
}

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
                html: createEmailTemplate(
                    'Verificá tu email',
                    'Usá este código para completar la creación de tu cuenta en BusCafé.',
                    code
                ),
            });

        if (error)
        {
            throw new Error(
                `No se pudo enviar el email: ${error.message}`
            );
        }
    };

export const sendEmailChangeVerification =
    async (
        email: string,
        code: string
    ) => {
        const { error } =
            await resend.emails.send({
                from: 'BusCafé <onboarding@resend.dev>',
                to: email,
                subject:
                    'Confirmá tu nuevo email en BusCafé',
                html: createEmailTemplate(
                    'Confirmá tu nuevo email',
                    'Recibimos una solicitud para usar este email en tu cuenta de BusCafé.',
                    code,
                    'Si no solicitaste este cambio, podés ignorar este mensaje.'
                ),
            });

        if (error)
        {
            throw new Error(
                `No se pudo enviar el email: ${error.message}`
            );
        }
    };

export const sendPasswordResetEmail =
    async (
        email: string,
        code: string
    ) => {
        const { error } =
            await resend.emails.send({
                from: 'BusCafé <onboarding@resend.dev>',
                to: email,
                subject:
                    'Restablecé tu contraseña de BusCafé',
                html: createEmailTemplate(
                    'Restablecé tu contraseña',
                    'Recibimos una solicitud para restablecer la contraseña de tu cuenta de BusCafé.',
                    code,
                    'Si no solicitaste este cambio, podés ignorar este mensaje.'
                ),
            });

        if (error)
        {
            throw new Error(
                `No se pudo enviar el email: ${error.message}`
            );
        }
    };