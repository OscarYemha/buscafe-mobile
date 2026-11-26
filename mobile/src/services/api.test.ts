import * as SecureStore from 'expo-secure-store';
import * as FileSystem from 'expo-file-system/legacy';
import {
    changePassword,
    InvalidSessionError,
    isInvalidSessionError,
    removeFavorite,
    setInvalidSessionHandler,
    updateProfile,
    uploadAvatar,
} from './api';

jest.mock('expo-secure-store', () => ({
    getItemAsync: jest.fn(),
}));

jest.mock('expo-file-system/legacy', () => ({
    uploadAsync: jest.fn(),
    FileSystemUploadType: { MULTIPART: 1 },
}));

jest.mock('expo-file-system', () => ({ File: jest.fn() }));
jest.mock('expo/fetch', () => ({ fetch: jest.fn() }));

const mockedSecureStore = SecureStore as jest.Mocked<typeof SecureStore>;
const mockedFileSystem = FileSystem as jest.Mocked<typeof FileSystem>;

const jsonResponse = (status: number, body: unknown) =>
    new Response(JSON.stringify(body), {
        status,
        headers: { 'Content-Type': 'application/json' },
    });

const fetchMock = jest.fn();
const handler = jest.fn();

beforeEach(() =>
{
    globalThis.fetch = fetchMock as unknown as typeof fetch;
    setInvalidSessionHandler(handler);
    mockedSecureStore.getItemAsync.mockResolvedValue('token-guardado');
});

afterEach(() =>
{
    setInvalidSessionHandler(null);
});

describe('401: sesión inválida', () =>
{
    it('avisa al handler con el token que usó el request y tira InvalidSessionError', async () =>
    {
        fetchMock.mockResolvedValue(jsonResponse(401, { error: 'Sesión inválida o vencida' }));

        const error = await removeFavorite('ChIJ123').catch((e: unknown) => e);

        expect(isInvalidSessionError(error)).toBe(true);
        expect(handler).toHaveBeenCalledWith('token-guardado');
    });

    it('funciona igual en las funciones que reciben el token por parámetro', async () =>
    {
        fetchMock.mockResolvedValue(jsonResponse(401, {}));

        await expect(updateProfile('token-viejo', 'Oscar')).rejects.toBeInstanceOf(InvalidSessionError);
        expect(handler).toHaveBeenCalledWith('token-viejo');
    });

    it('también en la subida de avatar, que no usa fetch', async () =>
    {
        mockedFileSystem.uploadAsync.mockResolvedValue({ status: 401, body: '{}', headers: {} } as never);

        await expect(uploadAvatar('token-viejo', 'file:///foto.jpg')).rejects.toBeInstanceOf(InvalidSessionError);
        expect(handler).toHaveBeenCalledWith('token-viejo');
    });

    it('si el handler falla, igual tira InvalidSessionError', async () =>
    {
        handler.mockRejectedValueOnce(new Error('SecureStore roto'));
        fetchMock.mockResolvedValue(jsonResponse(401, {}));
        jest.spyOn(console, 'error').mockImplementation(() => undefined);

        await expect(removeFavorite('ChIJ123')).rejects.toBeInstanceOf(InvalidSessionError);
    });

    it('sin handler registrado, igual tira InvalidSessionError', async () =>
    {
        setInvalidSessionHandler(null);
        fetchMock.mockResolvedValue(jsonResponse(401, {}));

        await expect(removeFavorite('ChIJ123')).rejects.toBeInstanceOf(InvalidSessionError);
    });
});

describe('otros errores no cierran la sesión', () =>
{
    // El server responde 403 (no 401) a la contraseña actual incorrecta:
    // si fuera 401, equivocarse de contraseña te desloguearía.
    it('403 por contraseña incorrecta muestra el mensaje del server sin tocar la sesión', async () =>
    {
        fetchMock.mockResolvedValue(jsonResponse(403, { error: 'La contraseña actual es incorrecta' }));

        await expect(changePassword('token', 'mal', 'nueva-contraseña'))
            .rejects.toThrow('La contraseña actual es incorrecta');
        expect(handler).not.toHaveBeenCalled();
    });

    it('un 500 es un error común', async () =>
    {
        fetchMock.mockResolvedValue(jsonResponse(500, {}));

        const error = await removeFavorite('ChIJ123').catch((e: unknown) => e);

        expect(isInvalidSessionError(error)).toBe(false);
        expect(handler).not.toHaveBeenCalled();
    });

    it('un request exitoso no llama al handler', async () =>
    {
        fetchMock.mockResolvedValue(jsonResponse(200, { token: 'token-nuevo' }));

        await expect(changePassword('token', 'actual', 'nueva-contraseña')).resolves.toBe('token-nuevo');
        expect(handler).not.toHaveBeenCalled();
    });
});

describe('sin token guardado', () =>
{
    it('no hace el request y pide iniciar sesión', async () =>
    {
        mockedSecureStore.getItemAsync.mockResolvedValue(null);

        await expect(removeFavorite('ChIJ123')).rejects.toThrow('Tenés que iniciar sesión');
        expect(fetchMock).not.toHaveBeenCalled();
    });
});
