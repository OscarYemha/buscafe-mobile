import {
    createHmac,
    randomInt,
    timingSafeEqual,
} from 'node:crypto';

export const VERIFICATION_CODE_TTL_MS = 15 * 60 * 1000;
export const MAX_VERIFICATION_ATTEMPTS = 5;

export type VerificationCodePurpose =
    | 'email-verification'
    | 'email-change'
    | 'password-reset';

export const generateVerificationCode = (): string =>
    randomInt(100000, 1000000).toString();

export const verificationCodeExpiry = (): Date =>
    new Date(Date.now() + VERIFICATION_CODE_TTL_MS);

const getSecret = (): string =>
{
    const secret = process.env.VERIFICATION_CODE_SECRET;

    if (!secret)
    {
        throw new Error('VERIFICATION_CODE_SECRET no está configurado');
    }

    return secret;
};

/*
 * HMAC con un secreto del servidor: un código de 6 dígitos tiene
 * solo 10^6 valores, así que un hash sin clave se revierte al instante
 * si la base se filtra. El propósito, el usuario y (para el cambio de
 * email) el email pendiente forman parte del mensaje, de modo que un
 * hash no sirve para otro flujo, otro usuario u otro email.
 */
export const hashVerificationCode = (
    purpose: VerificationCodePurpose,
    userId: number,
    code: string,
    context = ''
): string =>
    createHmac('sha256', getSecret())
        .update(`${purpose}\n${userId}\n${context}\n${code}`)
        .digest('hex');

export const verificationCodeMatches = (
    storedHash: string,
    candidateHash: string
): boolean =>
{
    const stored = Buffer.from(storedHash, 'hex');
    const candidate = Buffer.from(candidateHash, 'hex');

    if (stored.length === 0 || stored.length !== candidate.length)
    {
        return false;
    }

    return timingSafeEqual(stored, candidate);
};
