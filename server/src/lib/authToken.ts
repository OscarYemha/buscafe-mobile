import jwt from 'jsonwebtoken';

const AUTH_TOKEN_EXPIRES_IN = '7d';

/*
 * tokenVersion es opcional porque los tokens emitidos antes de agregarlo
 * no lo traen: se toman como versión 0 para no desloguear a nadie.
 */
export type AuthTokenPayload = {
    userId: number;
    tokenVersion?: number;
};

export function getJwtSecret(): string
{
    const jwtSecret = process.env.JWT_SECRET;

    if (!jwtSecret)
    {
        throw new Error('JWT_SECRET no está configurado');
    }

    return jwtSecret;
}

export function signAuthToken(user: {
    id: number;
    tokenVersion: number;
}): string
{
    const payload: AuthTokenPayload = {
        userId: user.id,
        tokenVersion: user.tokenVersion,
    };

    return jwt.sign(payload, getJwtSecret(), {
        expiresIn: AUTH_TOKEN_EXPIRES_IN,
    });
}
