import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import { db } from './fakePrisma.js';

export const TEST_JWT_SECRET = 'test-jwt-secret';
export const TEST_CODE_SECRET = 'test-verification-code-secret';

/*
 * Los rate limiters guardan estado durante todo el archivo de tests.
 * Cada request usa una IP propia (X-Forwarded-For, con trust proxy = 1)
 * salvo que el test quiera compartirla a propósito.
 */
let ipCounter = 0;

export const uniqueIp = (): string =>
{
    ipCounter++;
    return `10.${(ipCounter >> 16) & 255}.${(ipCounter >> 8) & 255}.${ipCounter & 255}`;
};

let emailCounter = 0;

export const uniqueEmail = (prefix = 'user'): string =>
{
    emailCounter++;
    return `${prefix}${emailCounter}@example.com`;
};

export const tokenFor = (userId: number): string =>
    jwt.sign({ userId }, TEST_JWT_SECRET, { expiresIn: '1h' });

export const createUser = async ({
    email = uniqueEmail(),
    password = 'password-correcta',
    name = 'Usuario de prueba',
    emailVerified = true,
}: {
    email?: string;
    password?: string;
    name?: string;
    emailVerified?: boolean;
} = {}) =>
{
    const row = db.users.insert({
        name,
        email,
        passwordHash: await bcrypt.hash(password, 4),
        emailVerified,
    });

    return {
        id: row.id as number,
        email,
        password,
        token: tokenFor(row.id as number),
    };
};

/** Último código enviado por un mock de email (segundo argumento). */
export const lastCodeSent = (
    mock: { mock: { calls: unknown[][] } },
    to?: string
): string =>
{
    const calls = mock.mock.calls.filter(
        (call) => to === undefined || call[0] === to
    );
    const code = calls.at(-1)?.[1];

    if (typeof code !== 'string')
    {
        throw new Error(`No se envió ningún código${to ? ` a ${to}` : ''}`);
    }

    return code;
};

export const otherCode = (code: string): string =>
    code === '000000' ? '111111' : '000000';
