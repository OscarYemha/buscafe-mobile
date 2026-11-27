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
import { EDIT_GRACE_PERIOD_MS } from '../routes/reviews.routes.js';
import { db } from './fakePrisma.js';
import { createUser, uniqueIp } from './helpers.js';

const MINUTE = 60 * 1000;

const patchReview = (id: unknown, body: object, token?: string) =>
{
    const req = request(app)
        .patch(`/reviews/${id}`)
        .set('X-Forwarded-For', uniqueIp())
        .send(body);

    return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

const deleteReview = (id: unknown, token?: string) =>
{
    const req = request(app)
        .delete(`/reviews/${id}`)
        .set('X-Forwarded-For', uniqueIp());

    return token ? req.set('Authorization', `Bearer ${token}`) : req;
};

const seedReview = (userId: number, minutesAgo = 60, extra: object = {}) =>
{
    const cafe = db.cafes.insert({
        googlePlaceId: `ChIJ${Math.random().toString(36).slice(2)}`,
        name: 'Café de prueba',
        address: 'Calle 123, CABA',
        latitude: -34.6,
        longitude: -58.38,
    });

    return db.reviews.insert({
        userId,
        cafeId: cafe.id,
        rating: 3,
        comment: 'Original',
        coffeeRating: 4,
        goodForWork: true,
        hasWifi: true,
        createdAt: new Date(Date.now() - minutesAgo * MINUTE),
        ...extra,
    });
};

const validEdit = { rating: 5, comment: '  Mejoró mucho  ' };

beforeEach(() =>
{
    db.reset();
});

describe('PATCH /reviews/:id', () =>
{
    it('401 sin sesión', async () =>
    {
        const me = await createUser();
        const review = seedReview(me.id);

        expect((await patchReview(review.id, validEdit)).status).toBe(401);
    });

    it('404 con una reseña de otra persona, sin tocarla', async () =>
    {
        const owner = await createUser();
        const other = await createUser();
        const review = seedReview(owner.id);

        const res = await patchReview(review.id, validEdit, other.token);

        expect(res.status).toBe(404);
        expect(db.reviews.find({ id: review.id })?.comment).toBe('Original');
    });

    it('404 con una reseña que no existe o un id inválido', async () =>
    {
        const me = await createUser();

        expect((await patchReview(999999, validEdit, me.token)).status).toBe(404);
        expect((await patchReview('abc', validEdit, me.token)).status).toBe(404);
        expect((await patchReview('1.5', validEdit, me.token)).status).toBe(404);
    });

    it('400 con datos inválidos', async () =>
    {
        const me = await createUser();
        const review = seedReview(me.id);

        for (const body of [
            { comment: 'Sin puntaje' },
            { rating: 6, comment: 'Fuera de rango' },
            { rating: 4, comment: '   ' },
            { rating: 4, comment: 'Ok', coffeeRating: 0 },
            { rating: 4, comment: 'Ok', hasWifi: 'sí' },
        ])
        {
            expect((await patchReview(review.id, body, me.token)).status).toBe(400);
        }

        expect(db.reviews.find({ id: review.id })?.rating).toBe(3);
    });

    it('reemplaza el contenido: lo que no viene queda vacío', async () =>
    {
        const me = await createUser();
        const review = seedReview(me.id);
        const { cafeId, createdAt } = review;

        const res = await patchReview(
            review.id,
            { ...validEdit, foodRating: 2, hasPowerOutlets: false },
            me.token
        );

        expect(res.status).toBe(200);

        const saved = db.reviews.find({ id: review.id })!;

        expect(saved).toMatchObject({
            rating: 5,
            comment: 'Mejoró mucho',
            coffeeRating: null,
            foodRating: 2,
            goodForWork: null,
            hasWifi: null,
            hasPowerOutlets: false,
            cafeId,
            userId: me.id,
        });
        expect(saved.createdAt).toEqual(createdAt);
    });

    it('marca la reseña como editada pasado el período de gracia', async () =>
    {
        const me = await createUser();
        const review = seedReview(me.id, EDIT_GRACE_PERIOD_MS / MINUTE + 1);

        const before = Date.now();
        const res = await patchReview(review.id, validEdit, me.token);

        expect(res.status).toBe(200);
        expect(new Date(res.body.editedAt).getTime()).toBeGreaterThanOrEqual(before);
    });

    it('no marca la reseña como editada dentro del período de gracia', async () =>
    {
        const me = await createUser();
        const review = seedReview(me.id, 5);

        const res = await patchReview(review.id, validEdit, me.token);

        expect(res.status).toBe(200);
        expect(res.body.editedAt).toBeNull();
    });

    it('una marca anterior se mantiene aunque la edición nueva sea rápida', async () =>
    {
        const me = await createUser();
        const editedAt = new Date('2026-11-01T12:00:00Z');
        // Caso raro (createdAt reciente con editedAt): la marca nunca se pierde.
        const review = seedReview(me.id, 5, { editedAt });

        const res = await patchReview(review.id, validEdit, me.token);

        expect(new Date(res.body.editedAt)).toEqual(editedAt);
    });
});

describe('DELETE /reviews/:id', () =>
{
    it('401 sin sesión', async () =>
    {
        const me = await createUser();
        const review = seedReview(me.id);

        expect((await deleteReview(review.id)).status).toBe(401);
        expect(db.reviews.find({ id: review.id })).toBeDefined();
    });

    it('404 con una reseña de otra persona, sin borrarla', async () =>
    {
        const owner = await createUser();
        const other = await createUser();
        const review = seedReview(owner.id);

        expect((await deleteReview(review.id, other.token)).status).toBe(404);
        expect(db.reviews.find({ id: review.id })).toBeDefined();
    });

    it('borra mi reseña y deja las demás', async () =>
    {
        const me = await createUser();
        const mine = seedReview(me.id);
        const alsoMine = seedReview(me.id);

        const res = await deleteReview(mine.id, me.token);

        expect(res.status).toBe(204);
        expect(db.reviews.find({ id: mine.id })).toBeUndefined();
        expect(db.reviews.find({ id: alsoMine.id })).toBeDefined();
    });

    it('borrarla dos veces da 404 la segunda', async () =>
    {
        const me = await createUser();
        const review = seedReview(me.id);

        expect((await deleteReview(review.id, me.token)).status).toBe(204);
        expect((await deleteReview(review.id, me.token)).status).toBe(404);
    });
});
