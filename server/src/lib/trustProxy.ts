/*
 * Proxies en los que confiamos para calcular req.ip (lo usa el rate
 * limiting por IP).
 *
 * En Render un request llega así (X-Forwarded-For, de izquierda a derecha):
 *   cliente → Cloudflare → balanceador interno de Render (10.x) → proxy
 *   local del contenedor (::1)
 *
 * Confiamos en redes, no en una cantidad fija de saltos: Express recorre la
 * cadena de derecha a izquierda salteando estos proxies y toma la primera
 * IP que no es de confianza. Así funciona aunque cambie la cantidad de
 * saltos, y lo que el cliente escriba a mano en X-Forwarded-For queda a la
 * izquierda de su IP real y se ignora.
 *
 * Rangos de Cloudflare: https://www.cloudflare.com/ips/ (revisados el
 * 2026-11-20). Si Cloudflare agrega rangos, sumarlos acá.
 */
const CLOUDFLARE_IPV4 = [
    '173.245.48.0/20',
    '103.21.244.0/22',
    '103.22.200.0/22',
    '103.31.4.0/22',
    '141.101.64.0/18',
    '108.162.192.0/18',
    '190.93.240.0/20',
    '188.114.96.0/20',
    '197.234.240.0/22',
    '198.41.128.0/17',
    '162.158.0.0/15',
    '104.16.0.0/13',
    '104.24.0.0/14',
    '172.64.0.0/13',
    '131.0.72.0/22',
];

const CLOUDFLARE_IPV6 = [
    '2400:cb00::/32',
    '2606:4700::/32',
    '2803:f800::/32',
    '2405:b500::/32',
    '2405:8100::/32',
    '2a06:98c0::/29',
    '2c0f:f248::/32',
];

export const TRUSTED_PROXIES = [
    // ::1 / 127.0.0.1: proxy local del contenedor.
    'loopback',
    // 10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16, fc00::/7: red interna de Render.
    'uniquelocal',
    ...CLOUDFLARE_IPV4,
    ...CLOUDFLARE_IPV6,
];
