import { Router } from "express";
import prisma from "../lib/prisma.js";
import { Prisma } from "../generated/prisma/client.js";
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import {
    AuthenticatedRequest,
    requireAuth
} from "../middleware/auth.js";
import {
    sendEmailChangeVerification,
    sendPasswordResetEmail,
    sendVerificationEmail
} from '../services/email.js';
import { randomInt } from 'node:crypto';
import multer from 'multer';
import { supabase } from '../lib/supabase.js';

const router = Router();

const avatarUpload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 5 * 1024 * 1024,
    },
    fileFilter: (
        _req,
        file,
        callback
    ) => {
        const allowedMimeTypes = [
            'image/jpeg',
            'image/png',
            'image/webp',
        ];

        if (
            !allowedMimeTypes.includes(
                file.mimetype
            )
        )
        {
            callback(
                new Error('Formato de imagen no permitido')
            );

            return;
        }

        callback(null, true);
    },
});

router.get(
    '/me',
    requireAuth,
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        try
        {
            const userId = req.userId;

            if (!userId)
            {
                return res.status(401).json({
                    error: 'Autenticación requerida',
                });
            }

            const user = 
                await prisma.user.findUnique({
                    where: {
                        id: userId,
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                    },
                });

            if (!user)
            {
                return res.status(401).json({
                    error: 'Usuario no encontrado',
                });
            }

            return res.json(user);
        }
        catch (error)
        {
            console.error(error);

            return res.status(500).json({
                error: 'No se pudo obtener el usuario',
            });
        }
    }
);

router.patch(
    '/me',
    requireAuth,
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        try
        {
            const userId = req.userId;
            const { name } = req.body;

            if (!userId)
            {
                return res.status(401).json({
                    error: 'Autenticación requerida',
                });
            }

            if (
                typeof name !== 'string' ||
                !name.trim()
            )
            {
                return res.status(400).json({
                    error: 'El nombre es obligatorio',
                });
            }

            const normalizedName =
                name.trim();

            if (normalizedName.length > 100)
            {
                return res.status(400).json({
                    error: 'El nombre es demasiado largo',
                });
            }

            const user =
                await prisma.user.update({
                    where: {
                        id: userId,
                    },
                    data: {
                        name: normalizedName,
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                    },
                });

            return res.json(user);
        }
        catch (error)
        {
            console.error(error);

            return res.status(500).json({
                error: 'No se pudo actualizar el perfil',
            });
        }
    }
);

router.patch(
    '/me/password',
    requireAuth,
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        try
        {
            const userId = req.userId;

            const {
                currentPassword,
                newPassword,
            } = req.body;

            if (!userId)
            {
                return res.status(401).json({
                    error: 'Autenticación requerida',
                });
            }

            if (
                typeof currentPassword !== 'string' ||
                currentPassword === '' ||
                typeof newPassword !== 'string'
            )
            {
                return res.status(400).json({
                    error:
                        'La contraseña actual y la nueva son obligatorias',
                });
            }

            if (newPassword.length < 8)
            {
                return res.status(400).json({
                    error:
                        'La nueva contraseña debe tener al menos 8 caracteres',
                });
            }

            if (currentPassword === newPassword)
            {
                return res.status(400).json({
                    error:
                        'La nueva contraseña debe ser diferente a la actual',
                });
            }

            const user =
                await prisma.user.findUnique({
                    where: {
                        id: userId,
                    },
                    select: {
                        passwordHash: true,
                    },
                });

            if (!user)
            {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                });
            }

            const currentPasswordIsValid =
                await bcrypt.compare(
                    currentPassword,
                    user.passwordHash
                );

            if (!currentPasswordIsValid)
            {
                return res.status(401).json({
                    error:
                        'La contraseña actual es incorrecta',
                });
            }

            const newPasswordHash =
                await bcrypt.hash(
                    newPassword,
                    10
                );

            await prisma.user.update({
                where: {
                    id: userId,
                },
                data: {
                    passwordHash:
                        newPasswordHash,
                },
            });

            return res.json({
                message:
                    'Contraseña actualizada correctamente',
            });
        }
        catch (error)
        {
            console.error(error);

            return res.status(500).json({
                error:
                    'No se pudo actualizar la contraseña',
            });
        }
    }
);

router.delete(
    '/me',
    requireAuth,
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        try
        {
            const userId = req.userId;
            const { password } = req.body;

            if (!userId)
            {
                return res.status(401).json({
                    error: 'Autenticación requerida',
                });
            }

            if (
                typeof password !== 'string' ||
                password === ''
            )
            {
                return res.status(400).json({
                    error:
                        'La contraseña actual es obligatoria',
                });
            }

            const user =
                await prisma.user.findUnique({
                    where: {
                        id: userId,
                    },
                    select: {
                        passwordHash: true,
                        avatarUrl: true,
                    },
                });

            if (!user)
            {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                });
            }

            const passwordIsValid =
                await bcrypt.compare(
                    password,
                    user.passwordHash
                );

            if (!passwordIsValid)
            {
                return res.status(401).json({
                    error:
                        'La contraseña actual es incorrecta',
                });
            }

            await prisma.user.delete({
                where: {
                    id: userId,
                },
            });

            if (user.avatarUrl)
            {
                const avatarExtensions = [
                    'jpg',
                    'png',
                    'webp',
                ];

                const avatarPaths =
                    avatarExtensions.map(
                        (extension) =>
                            `users/${userId}/avatar.${extension}`
                    );

                const {
                    error: avatarDeleteError,
                } = await supabase.storage
                    .from('avatars')
                    .remove(avatarPaths);

                if (avatarDeleteError)
                {
                    console.error(
                        'No se pudo eliminar el avatar:',
                        avatarDeleteError
                    );
                }
            }

            return res.json({
                message:
                    'Cuenta eliminada correctamente',
            });
        }
        catch (error)
        {
            console.error(error);

            return res.status(500).json({
                error:
                    'No se pudo eliminar la cuenta',
            });
        }
    }
);

router.post(
    '/me/email-change',
    requireAuth,
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        try
        {
            const userId = req.userId;
            const { email } = req.body;

            if (!userId)
            {
                return res.status(401).json({
                    error: 'Autenticación requerida',
                });
            }

            if (
                typeof email !== 'string' ||
                !email.trim()
            )
            {
                return res.status(400).json({
                    error: 'El nuevo email es obligatorio',
                });
            }

            const normalizedEmail =
                email.trim().toLowerCase();

            const currentUser =
                await prisma.user.findUnique({
                    where: {
                        id: userId,
                    },
                    select: {
                        email: true,
                    },
                });

            if (!currentUser)
            {
                return res.status(404).json({
                    error: 'Usuario no encontrado',
                });
            }

            if (
                currentUser.email.toLowerCase() ===
                normalizedEmail
            )
            {
                return res.status(400).json({
                    error:
                        'El nuevo email debe ser diferente al actual',
                });
            }

            const existingUser =
                await prisma.user.findUnique({
                    where: {
                        email: normalizedEmail,
                    },
                    select: {
                        id: true,
                    },
                });

            if (existingUser)
            {
                return res.status(409).json({
                    error:
                        'Ese email ya está asociado a otra cuenta',
                });
            }

            const code =
                randomInt(
                    100000,
                    1000000
                ).toString();

            const expiresAt =
                new Date(
                    Date.now() +
                    15 * 60 * 1000
                );

            await prisma.user.update({
                where: {
                    id: userId,
                },
                data: {
                    pendingEmail:
                        normalizedEmail,
                    emailChangeCode:
                        code,
                    emailChangeCodeExpires:
                        expiresAt,
                },
            });

            await sendEmailChangeVerification(
                normalizedEmail,
                code
            );

            return res.json({
                message:
                    'Código de verificación enviado',
            });
        }
        catch (error)
        {
            console.error(error);

            return res.status(500).json({
                error:
                    'No se pudo iniciar el cambio de email',
            });
        }
    }
);

router.post(
    '/me/email-change/verify',
    requireAuth,
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        try
        {
            const userId = req.userId;
            const { code } = req.body;

            if (!userId)
            {
                return res.status(401).json({
                    error: 'Autenticación requerida',
                });
            }

            if (
                typeof code !== 'string' ||
                !/^\d{6}$/.test(code)
            )
            {
                return res.status(400).json({
                    error:
                        'El código debe tener 6 dígitos',
                });
            }

            const user =
                await prisma.user.findUnique({
                    where: {
                        id: userId,
                    },
                    select: {
                        pendingEmail: true,
                        emailChangeCode: true,
                        emailChangeCodeExpires: true,
                    },
                });

            if (
                !user ||
                !user.pendingEmail ||
                !user.emailChangeCode ||
                !user.emailChangeCodeExpires
            )
            {
                return res.status(400).json({
                    error:
                        'No hay un cambio de email pendiente',
                });
            }

            if (
                user.emailChangeCodeExpires <
                new Date()
            )
            {
                return res.status(400).json({
                    error:
                        'El código de verificación venció',
                });
            }

            if (
                user.emailChangeCode !== code
            )
            {
                return res.status(400).json({
                    error:
                        'El código de verificación es incorrecto',
                });
            }

            const existingUser =
                await prisma.user.findUnique({
                    where: {
                        email: user.pendingEmail,
                    },
                    select: {
                        id: true,
                    },
                });

            if (
                existingUser &&
                existingUser.id !== userId
            )
            {
                return res.status(409).json({
                    error:
                        'Ese email ya está asociado a otra cuenta',
                });
            }

            const updatedUser =
                await prisma.user.update({
                    where: {
                        id: userId,
                    },
                    data: {
                        email:
                            user.pendingEmail,
                        pendingEmail: null,
                        emailChangeCode: null,
                        emailChangeCodeExpires:
                            null,
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                    },
                });

            return res.json(updatedUser);
        }
        catch (error)
        {
            console.error(error);

            return res.status(500).json({
                error:
                    'No se pudo confirmar el cambio de email',
            });
        }
    }
);

router.patch(
    '/me/avatar',
    requireAuth,
    avatarUpload.single('avatar'),
    async (
        req: AuthenticatedRequest,
        res
    ) => {
        try
        {
            const userId = req.userId;
            const file = req.file;

            if (!userId)
            {
                return res.status(401).json({
                    error: 'Autenticación requerida',
                });
            }

            if (!file)
            {
                return res.status(400).json({
                    error: 'No se recibió ninguna imagen',
                });
            }

            const extension =
                file.mimetype === 'image/png'
                    ? 'png'
                    : file.mimetype === 'image/webp'
                        ? 'webp'
                        : 'jpg';

            const filePath =
                `users/${userId}/avatar.${extension}`;

            const {
                error: uploadError,
            } = await supabase.storage
                .from('avatars')
                .upload(
                    filePath,
                    file.buffer,
                    {
                        contentType: file.mimetype,
                        upsert: true,
                    }
                );

            if (uploadError)
            {
                console.error(uploadError);

                return res.status(500).json({
                    error: 'No se pudo subir la imagen',
                });
            }

            const {
                data: publicUrlData,
            } = supabase.storage
                .from('avatars')
                .getPublicUrl(filePath);

            const avatarUrl =
                `${publicUrlData.publicUrl}?v=${Date.now()}`;

            const user =
                await prisma.user.update({
                    where: {
                        id: userId,
                    },
                    data: {
                        avatarUrl,
                    },
                    select: {
                        id: true,
                        name: true,
                        email: true,
                        avatarUrl: true,
                    },
                });

            return res.json(user);
        }
        catch (error)
        {
            console.error(error);

            return res.status(500).json({
                error: 'No se pudo actualizar la foto de perfil',
            });
        }
    }
);

router.get('/', async (req, res) => {
    try
    {
        const users = await prisma.user.findMany({
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
            },
        });

        return res.json(users);
    }
    catch (error)
    {
        console.error(error);

        return res.status(500).json({
            error: 'No se pudieron obtener los usuarios',
        });
    }
});

const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

router.post('/', async (req, res) => {
    try 
    {
        const {
            name,
            email,
            password,
        } = req.body;

        if (
            typeof name !== 'string' ||
            name.trim() === '' ||
            typeof email !== 'string' ||
            email.trim() === '' ||
            !isValidEmail(email.trim()) ||
            typeof password !== 'string' ||
            password.trim().length < 8
        ) {
            return res.status(400).json({
                error: 'Los datos del usuario son inválidos',
            });
        }

        const passwordHash = await bcrypt.hash(password, 10);

        const verificationCode =
            randomInt(
                100000,
                1000000
            ).toString();

        const verificationExpires =
            new Date(
                Date.now() + 15 * 60 * 1000
            );

        const user = await prisma.user.create({
            data: {
                name: name.trim(),
                email: email.trim().toLowerCase(),
                passwordHash,
                emailVerificationCode: verificationCode,
                emailVerificationExpires: verificationExpires,
            },
            select: {
                id: true,
                name: true,
                email: true,
                createdAt: true,
            },
        });

        try
        {
            await sendVerificationEmail(
                user.email,
                verificationCode
            );
        }
        catch (error)
        {
            await prisma.user.delete({
                where: {
                    id: user.id,
                },
            });

            throw error;
        }

        return res.status(201).json({
            requiresEmailVerification: true,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
            },
        });
    } 
    catch (error) 
    {
        if (
            error instanceof Prisma.PrismaClientKnownRequestError &&
            error.code === 'P2002'
        ) {
            return res.status(409).json({
                error: 'Ya existe un usuario con ese email',
            });
        }

        console.error(error);

        return res.status(500).json({
            error: 'No se pudo crear el usuario',
        });
    }
});

router.post('/resend-verification', async (req, res) => {
    try
    {
        const {
            email,
        } = req.body;

        if (
            typeof email !== 'string' ||
            email.trim() === '' ||
            !isValidEmail(email.trim())
        )
        {
            return res.status(400).json({
                error: 'Email inválido',
            });
        }

        const user =
            await prisma.user.findUnique({
                where: {
                    email:
                        email.trim().toLowerCase(),
                },
            });

        if (!user)
        {
            return res.status(404).json({
                error: 'Usuario no encontrado',
            });
        }

        if (user.emailVerified)
        {
            return res.status(400).json({
                error: 'El email ya está verificado',
            });
        }

        const verificationCode =
            randomInt(
                100000,
                1000000
            ).toString();

        const verificationExpires =
            new Date(
                Date.now() + 15 * 60 * 1000
            );

        await prisma.user.update({
            where: {
                id: user.id,
            },
            data: {
                emailVerificationCode:
                    verificationCode,
                emailVerificationExpires:
                    verificationExpires,
            },
        });

        await sendVerificationEmail(
            user.email,
            verificationCode
        );

        return res.json({
            message:
                'Código de verificación reenviado',
        });
    }
    catch (error)
    {
        console.error(error);

        return res.status(500).json({
            error:
                'No se pudo reenviar el código de verificación',
        });
    }
});

router.post('/verify-email', async (req, res) => {
    try
    {
        const {
            email,
            code,
        } = req.body;

        if (
            typeof email !== 'string' ||
            email.trim() === '' ||
            typeof code !== 'string' ||
            !/^\d{6}$/.test(code)
        )
        {
            return res.status(400).json({
                error: 'Email o código de verificación inválido',
            });
        }

        const user =
            await prisma.user.findUnique({
                where: {
                    email:
                        email.trim().toLowerCase(),
                },
            });

        if (!user)
        {
            return res.status(400).json({
                error: 'Código de verificación inválido',
            });
        }

        if (
            user.emailVerificationCode !== code ||
            !user.emailVerificationExpires ||
            user.emailVerificationExpires < new Date()
        )
        {
            return res.status(400).json({
                error: 'El código de verificación es inválido o venció',
            });
        }

        const verifiedUser =
            await prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    emailVerified: true,
                    emailVerificationCode: null,
                    emailVerificationExpires: null,
                },
                select: {
                    id: true,
                    name: true,
                    email: true,
                },
            });

        const jwtSecret =
            process.env.JWT_SECRET;

        if (!jwtSecret)
        {
            throw new Error('JWT_SECRET no está configurado');
        }

        const token =
            jwt.sign(
                {
                    userId: verifiedUser.id,
                },
                jwtSecret,
                {
                    expiresIn: '7d',
                }
            );

        return res.json({
            token,
            user: verifiedUser,
        });
    }
    catch (error)
    {
        console.error(error);

        return res.status(500).json({
            error: 'No se pudo verificar el email',
        });
    }
});

router.post(
    '/password-reset/request',
    async (req, res) => {
        try
        {
            const { email } = req.body;

            if (
                typeof email !== 'string' ||
                email.trim() === '' ||
                !isValidEmail(email.trim())
            )
            {
                return res.status(400).json({
                    error: 'Email inválido',
                });
            }

            const normalizedEmail =
                email.trim().toLowerCase();

            const user =
                await prisma.user.findUnique({
                    where: {
                        email: normalizedEmail,
                    },
                });

            /*
             * Respondemos igual aunque el usuario
             * no exista para no revelar qué emails
             * están registrados.
             */
            if (!user)
            {
                return res.json({
                    message:
                        'Si existe una cuenta asociada a ese email, recibirás un código para restablecer tu contraseña.',
                });
            }

            const code =
                randomInt(
                    100000,
                    1000000
                ).toString();

            const expiresAt =
                new Date(
                    Date.now() +
                    15 * 60 * 1000
                );

            await prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    passwordResetCode: code,
                    passwordResetCodeExpires:
                        expiresAt,
                },
            });

            await sendPasswordResetEmail(
                user.email,
                code
            );

            return res.json({
                message:
                    'Si existe una cuenta asociada a ese email, recibirás un código para restablecer tu contraseña.',
            });
        }
        catch (error)
        {
            console.error(error);

            return res.status(500).json({
                error:
                    'No se pudo iniciar la recuperación de contraseña',
            });
        }
    }
);

router.post(
    '/password-reset/confirm',
    async (req, res) => {
        try
        {
            const {
                email,
                code,
                newPassword,
            } = req.body;

            if (
                typeof email !== 'string' ||
                email.trim() === '' ||
                !isValidEmail(email.trim()) ||
                typeof code !== 'string' ||
                !/^\d{6}$/.test(code) ||
                typeof newPassword !== 'string' ||
                newPassword.length < 8
            )
            {
                return res.status(400).json({
                    error:
                        'Los datos para restablecer la contraseña son inválidos',
                });
            }

            const normalizedEmail =
                email.trim().toLowerCase();

            const user =
                await prisma.user.findUnique({
                    where: {
                        email: normalizedEmail,
                    },
                });

            if (
                !user ||
                !user.passwordResetCode ||
                !user.passwordResetCodeExpires
            )
            {
                return res.status(400).json({
                    error:
                        'El código es inválido o venció',
                });
            }

            if (
                user.passwordResetCodeExpires <
                new Date()
            )
            {
                return res.status(400).json({
                    error:
                        'El código es inválido o venció',
                });
            }

            if (
                user.passwordResetCode !== code
            )
            {
                return res.status(400).json({
                    error:
                        'El código es inválido o venció',
                });
            }

            const passwordHash =
                await bcrypt.hash(
                    newPassword,
                    10
                );

            await prisma.user.update({
                where: {
                    id: user.id,
                },
                data: {
                    passwordHash,
                    passwordResetCode: null,
                    passwordResetCodeExpires:
                        null,
                },
            });

            return res.json({
                message:
                    'Contraseña restablecida correctamente',
            });
        }
        catch (error)
        {
            console.error(error);

            return res.status(500).json({
                error:
                    'No se pudo restablecer la contraseña',
            });
        }
    }
);

router.post('/login', async (req, res) => {
    try
    {
        const {
            email,
            password
        } = req.body;

        if (
            typeof email !== 'string' ||
            email.trim() === '' ||
            typeof password !== 'string' ||
            password === ''
        )
        {
            return res.status(400).json({
                error: 'Email y contraseña son obligatorios',
            });
        }

        const user = await prisma.user.findUnique({
            where: {
                email: email.trim().toLowerCase(),
            },
        });

        if (!user)
        {
            return res.status(401).json({
                error: 'Email o contraseña incorrectos',
            });
        }

        const passwordIsValid = await bcrypt.compare(
            password,
            user.passwordHash
        );

        if (!passwordIsValid)
        {
            return res.status(401).json({
                error: 'Email o contraseña incorrectos',
            });
        }

        if (!user.emailVerified)
        {
            return res.status(403).json({
                error: 'Tenés que verificar tu email antes de iniciar sesión',
                requiresEmailVerification: true,
            });
        }

        const jwtSecret = process.env.JWT_SECRET;

        if (!jwtSecret)
        {
            throw new Error('JWT_SECRET no está configurado');
        }

        const token = 
            jwt.sign(
                {
                    userId: user.id,
                },
                jwtSecret,
                {
                    expiresIn: '7d',
                }
            );

        return res.json({
            token,
            user: {
                id: user.id,
                name: user.name,
                email: user.email,
                avatarUrl: user.avatarUrl,
            },
        });
    }
    catch (error)
    {
        console.error(error);

        return res.status(500).json({
            error: 'No se pudo iniciar sesión',
        });
    }
});

export default router;