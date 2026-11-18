import prisma from '../lib/prisma.js';
import type { Prisma } from '../generated/prisma/client.js';
import {
    generateVerificationCode,
    hashVerificationCode,
    MAX_VERIFICATION_ATTEMPTS,
    verificationCodeExpiry,
    verificationCodeMatches,
    type VerificationCodePurpose,
} from '../lib/verificationCode.js';

interface CodeFields
{
    hash:
        | 'emailVerificationCodeHash'
        | 'emailChangeCodeHash'
        | 'passwordResetCodeHash';
    expires:
        | 'emailVerificationExpires'
        | 'emailChangeCodeExpires'
        | 'passwordResetCodeExpires';
    attempts:
        | 'emailVerificationAttempts'
        | 'emailChangeAttempts'
        | 'passwordResetAttempts';
}

const CODE_FIELDS: Record<VerificationCodePurpose, CodeFields> = {
    'email-verification': {
        hash: 'emailVerificationCodeHash',
        expires: 'emailVerificationExpires',
        attempts: 'emailVerificationAttempts',
    },
    'email-change': {
        hash: 'emailChangeCodeHash',
        expires: 'emailChangeCodeExpires',
        attempts: 'emailChangeAttempts',
    },
    'password-reset': {
        hash: 'passwordResetCodeHash',
        expires: 'passwordResetCodeExpires',
        attempts: 'passwordResetAttempts',
    },
};

/*
 * El cambio de email ata el código al email pendiente: si el usuario
 * pide cambiar a otro email, el código anterior deja de servir.
 */
const contextFor = (
    purpose: VerificationCodePurpose,
    pendingEmail: string | null
): string =>
    purpose === 'email-change' ? pendingEmail ?? '' : '';

const clearedCodeData = (
    fields: CodeFields
): Prisma.UserUpdateManyMutationInput => ({
    [fields.hash]: null,
    [fields.expires]: null,
    [fields.attempts]: 0,
});

/**
 * Genera un código nuevo, guarda solo su hash y reinicia el contador
 * de intentos. Devuelve el código en claro para enviarlo por email.
 */
export const issueVerificationCode = async (
    purpose: VerificationCodePurpose,
    userId: number,
    extraData: Prisma.UserUpdateInput = {}
): Promise<string> =>
{
    const fields = CODE_FIELDS[purpose];
    const code = generateVerificationCode();
    const pendingEmail =
        typeof extraData.pendingEmail === 'string'
            ? extraData.pendingEmail
            : null;

    await prisma.user.update({
        where: { id: userId },
        data: {
            ...extraData,
            [fields.hash]: hashVerificationCode(
                purpose,
                userId,
                code,
                contextFor(purpose, pendingEmail)
            ),
            [fields.expires]: verificationCodeExpiry(),
            [fields.attempts]: 0,
        },
    });

    return code;
};

export type CodeCheckResult =
    | { status: 'ok'; pendingEmail: string | null }
    | { status: 'missing' }
    | { status: 'expired' }
    | { status: 'invalid' }
    | { status: 'locked' };

/**
 * Verifica un código y, si es correcto, lo consume aplicando
 * `onSuccess` en la misma escritura.
 *
 * El intento se reserva con un incremento atómico ANTES de comparar,
 * así que ni siquiera con requests concurrentes se hacen más de
 * MAX_VERIFICATION_ATTEMPTS comparaciones por código. Al agotar los
 * intentos el código se borra y hay que pedir uno nuevo.
 */
export const consumeVerificationCode = async (
    purpose: VerificationCodePurpose,
    userId: number,
    code: string,
    onSuccess: (
        pendingEmail: string | null
    ) => Promise<Prisma.UserUpdateManyMutationInput> | Prisma.UserUpdateManyMutationInput = () => ({})
): Promise<CodeCheckResult> =>
{
    const fields = CODE_FIELDS[purpose];

    const reserved = await prisma.user.updateMany({
        where: {
            id: userId,
            [fields.hash]: { not: null },
            [fields.attempts]: { lt: MAX_VERIFICATION_ATTEMPTS },
        },
        data: {
            [fields.attempts]: { increment: 1 },
        },
    });

    if (reserved.count === 0)
    {
        return { status: 'missing' };
    }

    const user = await prisma.user.findUnique({
        where: { id: userId },
        select: {
            [fields.hash]: true,
            [fields.expires]: true,
            [fields.attempts]: true,
            pendingEmail: true,
        },
    }) as Record<string, unknown> | null;

    const storedHash = user?.[fields.hash];
    const expiresAt = user?.[fields.expires];
    const attempts = user?.[fields.attempts];
    const pendingEmail =
        typeof user?.pendingEmail === 'string'
            ? user.pendingEmail
            : null;

    if (
        typeof storedHash !== 'string' ||
        !(expiresAt instanceof Date) ||
        typeof attempts !== 'number'
    )
    {
        return { status: 'missing' };
    }

    if (expiresAt < new Date())
    {
        await prisma.user.updateMany({
            where: { id: userId, [fields.hash]: storedHash },
            data: clearedCodeData(fields),
        });

        return { status: 'expired' };
    }

    const candidateHash = hashVerificationCode(
        purpose,
        userId,
        code,
        contextFor(purpose, pendingEmail)
    );

    if (!verificationCodeMatches(storedHash, candidateHash))
    {
        if (attempts >= MAX_VERIFICATION_ATTEMPTS)
        {
            await prisma.user.updateMany({
                where: { id: userId, [fields.hash]: storedHash },
                data: clearedCodeData(fields),
            });

            return { status: 'locked' };
        }

        return { status: 'invalid' };
    }

    const successData = await onSuccess(pendingEmail);

    // La condición sobre el hash evita que el mismo código se use dos veces.
    const consumed = await prisma.user.updateMany({
        where: { id: userId, [fields.hash]: storedHash },
        data: {
            ...successData,
            ...clearedCodeData(fields),
        },
    });

    if (consumed.count === 0)
    {
        return { status: 'missing' };
    }

    return { status: 'ok', pendingEmail };
};

export const TOO_MANY_ATTEMPTS_MESSAGE =
    'Demasiados intentos fallidos. Pedí un código nuevo.';
