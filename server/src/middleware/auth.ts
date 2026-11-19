import {
    NextFunction,
    Request,
    Response,
} from 'express';

import jwt from 'jsonwebtoken';
import prisma from '../lib/prisma.js';
import { getJwtSecret, type AuthTokenPayload } from '../lib/authToken.js';

export type AuthenticatedRequest =
    Request & {
        userId?: number;
    };

export async function requireAuth(
    req: AuthenticatedRequest,
    res: Response,
    next: NextFunction
)
{
    const authorization =
        req.headers.authorization;

    if (
        !authorization ||
        !authorization.startsWith('Bearer ')
    )
    {
        return res.status(401).json({
            error: 'Autenticación requerida',
        });
    }

    const token =
        authorization.substring(
            'Bearer '.length
        );

    const jwtSecret = getJwtSecret();

    try
    {
        const payload =
            jwt.verify(
                token,
                jwtSecret
            ) as AuthTokenPayload;

        if (
            !Number.isInteger(payload.userId) ||
            payload.userId <= 0
        )
        {
            return res.status(401).json({
                error: 'Token inválido',
            });
        }

        const user =
            await prisma.user.findUnique({
                where: { id: payload.userId },
                select: { tokenVersion: true },
            });

        const tokenVersion = 
            payload.tokenVersion ?? 0;

        if (!user || user.tokenVersion !== tokenVersion)
        {
            return res.status(401).json({
                error: 'Sesión inválida o vencida',
            });
        }

        req.userId =
            payload.userId;

        next();
    }
    catch (error)
    {
        if (error instanceof jwt.JsonWebTokenError)
        {
            return res.status(401).json({
                error: 'Token inválido o vencido',
            });
        }

        throw error;
    }
}