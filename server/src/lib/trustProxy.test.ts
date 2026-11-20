import { describe, expect, it, vi } from 'vitest';
import express from 'express';
import request from 'supertest';
import { TRUSTED_PROXIES } from './trustProxy.js';

/*
 * supertest conecta por loopback (127.0.0.1), igual que el proxy local
 * del contenedor en Render (::1).
 */
const ipApp = express();
ipApp.set('trust proxy', TRUSTED_PROXIES);
ipApp.get('/ip', (req, res) => res.json({ ip: req.ip }));

const ipFor = async (xForwardedFor?: string) =>
{
    const req = request(ipApp).get('/ip');
    const res = await (xForwardedFor ? req.set('X-Forwarded-For', xForwardedFor) : req);
    return res.body.ip as string;
};

const CLIENT = '186.136.49.174';
const CLOUDFLARE = '162.158.195.194';
const RENDER_LB = '10.28.117.134';

describe('TRUSTED_PROXIES', () =>
{
    it('toma la IP del cliente con la cadena real de Render', async () =>
    {
        expect(await ipFor(`${CLIENT}, ${CLOUDFLARE}, ${RENDER_LB}`)).toBe(CLIENT);
    });

    it('ignora lo que el cliente agregue a mano en X-Forwarded-For', async () =>
    {
        expect(await ipFor(`6.6.6.6, ${CLIENT}, ${CLOUDFLARE}, ${RENDER_LB}`)).toBe(CLIENT);
    });

    it('funciona aunque cambie la cantidad de saltos', async () =>
    {
        expect(await ipFor(`${CLIENT}, ${RENDER_LB}`)).toBe(CLIENT);
        expect(await ipFor(`${CLIENT}, ${CLOUDFLARE}`)).toBe(CLIENT);
        expect(await ipFor(CLIENT)).toBe(CLIENT);
    });

    it('acepta clientes IPv6 y proxies IPv6 de Cloudflare', async () =>
    {
        expect(await ipFor(`2001:db8::1, 2606:4700::1111, ${RENDER_LB}`)).toBe('2001:db8::1');
    });

    it('no confía en una IP pública que no es de Cloudflare', async () =>
    {
        // Un proxy desconocido en el medio: su IP es la que cuenta, no la que dice reenviar.
        expect(await ipFor(`${CLIENT}, 8.8.8.8, ${RENDER_LB}`)).toBe('8.8.8.8');
    });

    it('la app usa esta configuración', async () =>
    {
        vi.stubEnv('JWT_SECRET', 'x');
        const { default: app } = await import('../app.js');

        expect(app.get('trust proxy')).toBe(TRUSTED_PROXIES);
    });
});
