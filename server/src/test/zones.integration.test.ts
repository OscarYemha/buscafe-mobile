import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const zones = vi.hoisted(() =>
{
    process.env.JWT_SECRET = 'test-jwt-secret';
    process.env.VERIFICATION_CODE_SECRET = 'test-verification-code-secret';

    return {
        searchZones: vi.fn(),
        getZone: vi.fn(),
    };
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
vi.mock('../services/googleZones.js', () => zones);

import app from '../app.js';
import { GooglePlaceNotFoundError } from '../services/googlePlaces.js';
import { uniqueIp } from './helpers.js';

const get = (path: string, ip = uniqueIp()) =>
    request(app).get(path).set('X-Forwarded-For', ip);

const PALERMO = {
    placeId: 'ChIJpalermo',
    name: 'Palermo',
    description: 'Buenos Aires, Argentina',
    latitude: -34.5889,
    longitude: -58.4304,
};

beforeEach(() =>
{
    vi.clearAllMocks();
});

describe('GET /zones', () =>
{
    it('devuelve las sugerencias y pasa el token de sesión', async () =>
    {
        zones.searchZones.mockResolvedValue([
            { placeId: 'ChIJpalermo', name: 'Palermo', description: 'Buenos Aires, Argentina' },
        ]);

        const res = await get('/zones?query=%20Pale%20&sessionToken=abc-123');

        expect(res.status).toBe(200);
        expect(res.body.zones).toHaveLength(1);
        expect(zones.searchZones).toHaveBeenCalledWith('Pale', 'abc-123', undefined);
    });

    it('400 si el texto es muy corto o muy largo, sin consultar a Google', async () =>
    {
        expect((await get('/zones?query=P')).status).toBe(400);
        expect((await get('/zones')).status).toBe(400);
        expect((await get(`/zones?query=${'a'.repeat(101)}`)).status).toBe(400);
        expect(zones.searchZones).not.toHaveBeenCalled();
    });

    it('pasa la ubicación del usuario para priorizar zonas cercanas', async () =>
    {
        zones.searchZones.mockResolvedValue([]);

        const res = await get('/zones?query=Palermo&latitude=-34.6&longitude=-58.38');

        expect(res.status).toBe(200);
        expect(zones.searchZones).toHaveBeenCalledWith(
            'Palermo',
            undefined,
            { latitude: -34.6, longitude: -58.38 }
        );
    });

    it('400 si la ubicación viene incompleta o fuera de rango', async () =>
    {
        expect((await get('/zones?query=Palermo&latitude=-34.6')).status).toBe(400);
        expect((await get('/zones?query=Palermo&latitude=abc&longitude=-58')).status).toBe(400);
        expect((await get('/zones?query=Palermo&latitude=95&longitude=-58')).status).toBe(400);
        expect(zones.searchZones).not.toHaveBeenCalled();
    });

    it('400 si el token de sesión tiene un formato inválido', async () =>
    {
        expect((await get('/zones?query=Palermo&sessionToken=../x')).status).toBe(400);
        expect(zones.searchZones).not.toHaveBeenCalled();
    });

    it('502 si falla Google', async () =>
    {
        zones.searchZones.mockRejectedValue(new Error('Google caído'));

        expect((await get('/zones?query=Palermo')).status).toBe(502);
    });

    it('limita las consultas por IP', async () =>
    {
        zones.searchZones.mockResolvedValue([]);
        const ip = uniqueIp();

        for (let i = 0; i < 150; i++)
        {
            await get('/zones?query=Palermo', ip);
        }

        expect((await get('/zones?query=Palermo', ip)).status).toBe(429);
        expect((await get('/zones?query=Palermo')).status).toBe(200);
    });
});

describe('GET /zones/:placeId', () =>
{
    it('devuelve la zona con sus coordenadas y pasa el token de sesión', async () =>
    {
        zones.getZone.mockResolvedValue(PALERMO);

        const res = await get('/zones/ChIJpalermo?sessionToken=abc-123');

        expect(res.status).toBe(200);
        expect(res.body).toEqual(PALERMO);
        expect(zones.getZone).toHaveBeenCalledWith('ChIJpalermo', 'abc-123');
    });

    it('400 con un ID inválido, sin consultar a Google', async () =>
    {
        expect((await get('/zones/no%20valido')).status).toBe(400);
        expect(zones.getZone).not.toHaveBeenCalled();
    });

    it('404 si Google no conoce la zona', async () =>
    {
        zones.getZone.mockRejectedValue(new GooglePlaceNotFoundError('ChIJx'));

        expect((await get('/zones/ChIJx')).status).toBe(404);
    });

    it('502 si falla Google', async () =>
    {
        zones.getZone.mockRejectedValue(new Error('Google caído'));

        expect((await get('/zones/ChIJpalermo')).status).toBe(502);
    });
});
