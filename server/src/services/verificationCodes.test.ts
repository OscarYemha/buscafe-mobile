import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
    consumeVerificationCode,
    issueVerificationCode,
} from './verificationCodes.js';

type Row = Record<string, unknown>;

/*
 * Fake en memoria de prisma.user con lo justo que usa el servicio
 * (update, updateMany, findUnique). Nunca toca una base real.
 */
const db = vi.hoisted(() =>
{
    const users = new Map<number, Record<string, unknown>>();

    const matches = (row: Record<string, unknown>, where: Record<string, unknown>) =>
        Object.entries(where).every(([key, condition]) =>
        {
            const value = row[key];

            if (condition && typeof condition === 'object' && !(condition instanceof Date))
            {
                const c = condition as { not?: unknown; lt?: number };

                if ('not' in c && value === c.not) return false;
                if (c.lt !== undefined && !((value as number) < c.lt)) return false;

                return true;
            }

            return value === condition;
        });

    const apply = (row: Record<string, unknown>, data: Record<string, unknown>) =>
    {
        for (const [key, value] of Object.entries(data))
        {
            if (value && typeof value === 'object' && 'increment' in value)
            {
                row[key] = (row[key] as number) + (value as { increment: number }).increment;
            }
            else
            {
                row[key] = value;
            }
        }
    };

    const user = {
        update: async ({ where, data }: { where: { id: number }; data: Record<string, unknown> }) =>
        {
            const row = users.get(where.id);
            if (!row) throw new Error('not found');
            apply(row, data);
            return { ...row };
        },
        updateMany: async ({ where, data }: { where: Record<string, unknown>; data: Record<string, unknown> }) =>
        {
            let count = 0;
            for (const row of users.values())
            {
                if (matches(row, where))
                {
                    apply(row, data);
                    count++;
                }
            }
            return { count };
        },
        findUnique: async ({ where }: { where: { id: number } }) =>
        {
            const row = users.get(where.id);
            return row ? { ...row } : null;
        },
    };

    return { users, user };
});

vi.mock('../lib/prisma.js', () => ({ default: { user: db.user } }));

const freshUser = (): Row => ({
    id: 1,
    email: 'old@example.com',
    emailVerified: false,
    pendingEmail: null,
    passwordHash: 'old-hash',
    emailVerificationCodeHash: null,
    emailVerificationExpires: null,
    emailVerificationAttempts: 0,
    emailChangeCodeHash: null,
    emailChangeCodeExpires: null,
    emailChangeAttempts: 0,
    passwordResetCodeHash: null,
    passwordResetCodeExpires: null,
    passwordResetAttempts: 0,
});

const wrongCode = (code: string) =>
    code === '000000' ? '111111' : '000000';

describe('verificationCodes', () =>
{
    beforeEach(() =>
    {
        process.env.VERIFICATION_CODE_SECRET = 'test-secret';
        db.users.clear();
        db.users.set(1, freshUser());
    });

    it('guarda solo el hash del código', async () =>
    {
        const code = await issueVerificationCode('password-reset', 1);
        const row = db.users.get(1)!;

        expect(code).toMatch(/^\d{6}$/);
        expect(row.passwordResetCodeHash).toMatch(/^[0-9a-f]{64}$/);
        expect(row.passwordResetCodeHash).not.toBe(code);
        expect(row.passwordResetCodeExpires).toBeInstanceOf(Date);
    });

    it('acepta el código correcto, aplica los cambios y lo consume', async () =>
    {
        const code = await issueVerificationCode('email-verification', 1);

        const result = await consumeVerificationCode(
            'email-verification', 1, code, () => ({ emailVerified: true })
        );

        expect(result.status).toBe('ok');
        expect(db.users.get(1)).toMatchObject({
            emailVerified: true,
            emailVerificationCodeHash: null,
            emailVerificationExpires: null,
            emailVerificationAttempts: 0,
        });

        // Un segundo uso del mismo código falla.
        expect((await consumeVerificationCode('email-verification', 1, code)).status)
            .toBe('missing');
    });

    it('invalida el código al quinto fallo, aunque después llegue el correcto', async () =>
    {
        const code = await issueVerificationCode('password-reset', 1);
        const wrong = wrongCode(code);

        for (let i = 0; i < 4; i++)
        {
            expect((await consumeVerificationCode('password-reset', 1, wrong)).status)
                .toBe('invalid');
        }

        expect((await consumeVerificationCode('password-reset', 1, wrong)).status)
            .toBe('locked');
        expect(db.users.get(1)!.passwordResetCodeHash).toBeNull();

        const onSuccess = vi.fn(() => ({ passwordHash: 'new-hash' }));
        expect((await consumeVerificationCode('password-reset', 1, code, onSuccess)).status)
            .toBe('missing');
        expect(onSuccess).not.toHaveBeenCalled();
        expect(db.users.get(1)!.passwordHash).toBe('old-hash');
    });

    it('con intentos concurrentes no compara más de 5 veces', async () =>
    {
        const code = await issueVerificationCode('password-reset', 1);
        const wrong = wrongCode(code);

        const results = await Promise.all(
            Array.from({ length: 20 }, () =>
                consumeVerificationCode('password-reset', 1, wrong)
            )
        );

        const compared = results.filter(
            (r) => r.status === 'invalid' || r.status === 'locked'
        );

        expect(compared).toHaveLength(5);
        expect(db.users.get(1)!.passwordResetCodeHash).toBeNull();
    });

    it('un código nuevo reinicia el contador', async () =>
    {
        const first = await issueVerificationCode('password-reset', 1);

        for (let i = 0; i < 3; i++)
        {
            await consumeVerificationCode('password-reset', 1, wrongCode(first));
        }

        const second = await issueVerificationCode('password-reset', 1);
        expect(db.users.get(1)!.passwordResetAttempts).toBe(0);
        expect((await consumeVerificationCode('password-reset', 1, second)).status)
            .toBe('ok');
    });

    it('rechaza un código vencido', async () =>
    {
        const code = await issueVerificationCode('password-reset', 1);
        db.users.get(1)!.passwordResetCodeExpires = new Date(Date.now() - 1000);

        expect((await consumeVerificationCode('password-reset', 1, code)).status)
            .toBe('expired');
        expect(db.users.get(1)!.passwordResetCodeHash).toBeNull();
    });

    it('el código de cambio de email queda atado al email pendiente', async () =>
    {
        const code = await issueVerificationCode('email-change', 1, {
            pendingEmail: 'new@example.com',
        });

        // Si el email pendiente cambia por fuera, el código ya no sirve.
        db.users.get(1)!.pendingEmail = 'attacker@example.com';
        expect((await consumeVerificationCode('email-change', 1, code)).status)
            .toBe('invalid');

        db.users.get(1)!.pendingEmail = 'new@example.com';
        const result = await consumeVerificationCode(
            'email-change', 1, code,
            (pendingEmail) => ({
                ...(pendingEmail ? { email: pendingEmail } : {}),
                pendingEmail: null,
            })
        );

        expect(result.status).toBe('ok');
        expect(db.users.get(1)).toMatchObject({
            email: 'new@example.com',
            pendingEmail: null,
        });
    });
});
