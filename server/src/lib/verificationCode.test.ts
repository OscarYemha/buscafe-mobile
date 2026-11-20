import { beforeEach, describe, expect, it } from 'vitest';
import {
    generateVerificationCode,
    hashVerificationCode,
    verificationCodeMatches,
} from './verificationCode.js';

describe('verificationCode', () =>
{
    beforeEach(() =>
    {
        process.env.VERIFICATION_CODE_SECRET = 'test-secret';
    });

    it('genera códigos de 6 dígitos', () =>
    {
        for (let i = 0; i < 50; i++)
        {
            expect(generateVerificationCode()).toMatch(/^\d{6}$/);
        }
    });

    it('el hash no contiene el código y es determinístico', () =>
    {
        const hash = hashVerificationCode('password-reset', 1, '123456');

        expect(hash).toMatch(/^[0-9a-f]{64}$/);
        expect(hash).not.toContain('123456');
        expect(hashVerificationCode('password-reset', 1, '123456')).toBe(hash);
    });

    it('el hash depende del propósito, el usuario, el contexto y el secreto', () =>
    {
        const base = hashVerificationCode('email-change', 1, '123456', 'a@b.com');

        expect(hashVerificationCode('password-reset', 1, '123456', 'a@b.com')).not.toBe(base);
        expect(hashVerificationCode('email-change', 2, '123456', 'a@b.com')).not.toBe(base);
        expect(hashVerificationCode('email-change', 1, '123456', 'c@d.com')).not.toBe(base);

        process.env.VERIFICATION_CODE_SECRET = 'otro-secreto';
        expect(hashVerificationCode('email-change', 1, '123456', 'a@b.com')).not.toBe(base);
    });

    it('falla si falta el secreto', () =>
    {
        delete process.env.VERIFICATION_CODE_SECRET;

        expect(() => hashVerificationCode('password-reset', 1, '123456'))
            .toThrow('VERIFICATION_CODE_SECRET');
    });

    it('compara hashes sin aceptar largos distintos ni vacíos', () =>
    {
        const hash = hashVerificationCode('password-reset', 1, '123456');
        const other = hashVerificationCode('password-reset', 1, '654321');

        expect(verificationCodeMatches(hash, hash)).toBe(true);
        expect(verificationCodeMatches(hash, other)).toBe(false);
        expect(verificationCodeMatches(hash, hash.slice(0, 10))).toBe(false);
        expect(verificationCodeMatches('', '')).toBe(false);
    });
});
