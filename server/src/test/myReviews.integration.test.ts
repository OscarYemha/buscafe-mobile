import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

vi.hoisted(() =>
{
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.VERIFICATION_CODE_SECRET = 'test-verification-code-secret';
});

vi.mock('dotenv/config', () => ({}));
vi.mock('../lib/prisma.js', async () => ({
    default: (await import('./fakePrisma.js')).fakePrisma,
}));
vi.mock('../lib/supabase.js', () => ({ supabase: {} }));
vi.mock('../services/email.js', () => ({
    sendVerificationEmail: vi.fn(),
    sendEmailChangeVerification: vi.fn(),
    sendPasswordResetEmail: vi.fn(),
}));

import app from '../app.js';
import { db } from './fakePrisma.js';
import { createUser, uniqueIp } from './helpers.js';

const getMyReviews = (token?: string) =>
{
    const req = request(app).get('/users/me/reviews').set('X-Forwarded-For', uniqueIp());
    return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

const seedCafe = (googlePlaceId: string, name: string) =>
    db.cafes.insert({
        googlePlaceId,
        name,
        address: `${name} 123, CABA`,
        latitude: -34.6,
        longitude: -58.38,
    });

const seedReview = (
    userId: number | null,
    cafeId: unknown,
    comment: string,
    createdAt: Date
) =>
    db.reviews.insert({
        userId,
        cafeId,
        rating: 4,
        comment,
        createdAt,
        idempotencyKey: `00000000-0000-4000-8000-${String(Math.random()).slice(2, 14).padEnd(12, '0')}`,
    });

beforeEach(() =>
{
    db.reset();
});

describe('GET /users/me/reviews', () =>
{
    it('401 sin sesión', async () =>
    {
        expect((await getMyReviews()).status).toBe(401);
    });

    it('devuelve solo mis reseñas, de la más nueva a la más vieja, con el café', async () =>
    {
        const me = await createUser();
        const other = await createUser();
        const palermo = seedCafe('ChIJpalermo', 'Café Palermo');
        const centro = seedCafe('ChIJcentro', 'Café Centro');

        seedReview(me.id, palermo.id, 'La vieja', new Date('2026-10-01'));
        seedReview(me.id, centro.id, 'La nueva', new Date('2026-11-20'));
        seedReview(other.id, palermo.id, 'De otra persona', new Date('2026-11-25'));

        const res = await getMyReviews(me.token);

        expect(res.status).toBe(200);
        expect(res.body.reviews.map((r: { comment: string }) => r.comment)).toEqual(['La nueva', 'La vieja']);
        expect(res.body.reviews[0]).toMatchObject({
            rating: 4,
            comment: 'La nueva',
            cafe: { googlePlaceId: 'ChIJcentro', name: 'Café Centro', address: 'Café Centro 123, CABA' },
        });
    });

    it('devuelve lo editable y no los datos internos (userId, idempotencyKey)', async () =>
    {
        const me = await createUser();
        const cafe = seedCafe('ChIJx', 'Café X');
        seedReview(me.id, cafe.id, 'Rico', new Date());

        const res = await getMyReviews(me.token);

        expect(Object.keys(res.body.reviews[0]).sort()).toEqual([
            'cafe',
            'coffeeRating',
            'comfortRating',
            'comment',
            'createdAt',
            'editedAt',
            'foodRating',
            'goodForDate',
            'goodForStudy',
            'goodForWork',
            'hasPowerOutlets',
            'hasWifi',
            'id',
            'quietRating',
            'rating',
            'serviceRating',
        ]);
    });

    it('sin reseñas devuelve una lista vacía', async () =>
    {
        const me = await createUser();

        const res = await getMyReviews(me.token);

        expect(res.status).toBe(200);
        expect(res.body.reviews).toEqual([]);
    });
});
