import * as Location from 'expo-location';
import { getCurrentLocation } from './location';

jest.mock('expo-location', () => ({
    Accuracy: { High: 4 },
    getForegroundPermissionsAsync: jest.fn(),
    requestForegroundPermissionsAsync: jest.fn(),
    hasServicesEnabledAsync: jest.fn(),
    getCurrentPositionAsync: jest.fn(),
    getLastKnownPositionAsync: jest.fn(),
}));

const mocked = Location as jest.Mocked<typeof Location>;

const permission = (status: 'granted' | 'denied' | 'undetermined', canAskAgain = true) =>
    ({ status, canAskAgain, granted: status === 'granted', expires: 'never' }) as Location.LocationPermissionResponse;

const position = (latitude: number, longitude: number, accuracy = 10) =>
    ({ coords: { latitude, longitude, accuracy }, timestamp: 0 }) as Location.LocationObject;

const never = () => new Promise<never>(() => undefined);

beforeEach(() =>
{
    mocked.getForegroundPermissionsAsync.mockResolvedValue(permission('granted'));
    mocked.requestForegroundPermissionsAsync.mockResolvedValue(permission('granted'));
    mocked.hasServicesEnabledAsync.mockResolvedValue(true);
    mocked.getCurrentPositionAsync.mockResolvedValue(position(-34.6, -58.4));
    mocked.getLastKnownPositionAsync.mockResolvedValue(null);
});

afterEach(() =>
{
    jest.useRealTimers();
});

describe('getCurrentLocation: permisos', () =>
{
    it('con permiso devuelve la ubicación sin pedirlo de nuevo', async () =>
    {
        await expect(getCurrentLocation()).resolves.toEqual({
            status: 'granted',
            location: { latitude: -34.6, longitude: -58.4, accuracy: 10 },
        });
        expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('sin permiso todavía, lo pide', async () =>
    {
        mocked.getForegroundPermissionsAsync.mockResolvedValue(permission('undetermined'));

        const result = await getCurrentLocation();

        expect(mocked.requestForegroundPermissionsAsync).toHaveBeenCalledTimes(1);
        expect(result.status).toBe('granted');
    });

    it('si el usuario lo niega devuelve denied con canAskAgain', async () =>
    {
        mocked.getForegroundPermissionsAsync.mockResolvedValue(permission('undetermined'));
        mocked.requestForegroundPermissionsAsync.mockResolvedValue(permission('denied', true));

        await expect(getCurrentLocation()).resolves.toEqual({ status: 'denied', canAskAgain: true });
        expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    // Regresión del parpadeo: pedir el permiso al volver a primer plano
    // mandaba la app a segundo plano y se armaba un loop.
    it('con askPermission: false solo consulta, no pide', async () =>
    {
        mocked.getForegroundPermissionsAsync.mockResolvedValue(permission('denied', true));

        await expect(getCurrentLocation({ askPermission: false }))
            .resolves.toEqual({ status: 'denied', canAskAgain: true });
        expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });

    it('si Android ya no deja preguntar (canAskAgain: false), no lo pide', async () =>
    {
        mocked.getForegroundPermissionsAsync.mockResolvedValue(permission('denied', false));

        await expect(getCurrentLocation())
            .resolves.toEqual({ status: 'denied', canAskAgain: false });
        expect(mocked.requestForegroundPermissionsAsync).not.toHaveBeenCalled();
    });
});

describe('getCurrentLocation: GPS', () =>
{
    it('con la ubicación del teléfono apagada devuelve services-disabled', async () =>
    {
        mocked.hasServicesEnabledAsync.mockResolvedValue(false);

        await expect(getCurrentLocation()).resolves.toEqual({ status: 'services-disabled' });
        expect(mocked.getCurrentPositionAsync).not.toHaveBeenCalled();
    });

    it('con permiso denegado no revisa el GPS (el aviso de permiso es más útil)', async () =>
    {
        mocked.getForegroundPermissionsAsync.mockResolvedValue(permission('denied', false));
        mocked.hasServicesEnabledAsync.mockResolvedValue(false);

        const result = await getCurrentLocation();

        expect(result.status).toBe('denied');
        expect(mocked.hasServicesEnabledAsync).not.toHaveBeenCalled();
    });
});

describe('getCurrentLocation: timeout y última posición conocida', () =>
{
    it('si el GPS tarda más de 10 s usa la última posición conocida', async () =>
    {
        jest.useFakeTimers();
        mocked.getCurrentPositionAsync.mockReturnValue(never());
        mocked.getLastKnownPositionAsync.mockResolvedValue(position(-34.58, -58.42, 50));

        const promise = getCurrentLocation();
        await jest.advanceTimersByTimeAsync(10_000);

        await expect(promise).resolves.toEqual({
            status: 'granted',
            location: { latitude: -34.58, longitude: -58.42, accuracy: 50 },
        });
        expect(mocked.getLastKnownPositionAsync).toHaveBeenCalledWith({ maxAge: 10 * 60 * 1000 });
    });

    it('si el GPS falla y no hay última posición, tira el error original', async () =>
    {
        mocked.getCurrentPositionAsync.mockRejectedValue(new Error('GPS caído'));
        mocked.getLastKnownPositionAsync.mockResolvedValue(null);

        await expect(getCurrentLocation()).rejects.toThrow('GPS caído');
    });

    // Regresión: sin timeout en el fallback, Home quedaba en
    // "Buscando cafeterías cercanas…" para siempre.
    it('si la última posición tampoco responde, termina con error en vez de colgarse', async () =>
    {
        jest.useFakeTimers();
        mocked.getCurrentPositionAsync.mockReturnValue(never());
        mocked.getLastKnownPositionAsync.mockReturnValue(never());

        const promise = getCurrentLocation();
        const assertion = expect(promise).rejects.toThrow('Tiempo de espera agotado');

        await jest.advanceTimersByTimeAsync(10_000 + 3_000);
        await assertion;
    });
});
