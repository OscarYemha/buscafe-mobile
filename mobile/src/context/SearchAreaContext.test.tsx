import { ReactNode } from 'react';
import { act, renderHook, waitFor } from '@testing-library/react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
    SearchAreaProvider,
    useActiveSearchLocation,
    useSearchArea,
    useStableSearchLocation,
} from './SearchAreaContext';
import { useNearbyCafes } from './NearbyCafesContext';
import { Zone } from '../types/Zone';

jest.mock('@react-native-async-storage/async-storage', () =>
    require('@react-native-async-storage/async-storage/jest/async-storage-mock')
);

// Solo importa la ubicación del usuario; el resto del contexto no se usa.
jest.mock('./NearbyCafesContext', () => ({
    useNearbyCafes: jest.fn(),
}));

const mockedUseNearbyCafes = useNearbyCafes as jest.Mock;

const PALERMO: Zone = {
    placeId: 'ChIJpalermo',
    name: 'Palermo',
    description: 'Cdad. Autónoma de Buenos Aires, Argentina',
    latitude: -34.578,
    longitude: -58.426,
};

const HOME = { latitude: -34.6, longitude: -58.38, accuracy: 10 };

const wrapper = ({ children }: { children: ReactNode }) => (
    <SearchAreaProvider>{children}</SearchAreaProvider>
);

const setUserLocation = (location: typeof HOME | null) =>
    mockedUseNearbyCafes.mockReturnValue({ userLocation: location });

beforeEach(async () =>
{
    await AsyncStorage.clear();
    setUserLocation(HOME);
});

describe('SearchAreaContext', () =>
{
    it('arranca en "cerca de mí" con la ubicación del usuario', async () =>
    {
        const { result } = await renderHook(() => useActiveSearchLocation(), { wrapper });

        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(result.current).toMatchObject({
            mode: 'nearby',
            label: 'Cerca de vos',
            coordinates: { latitude: HOME.latitude, longitude: HOME.longitude },
        });
    });

    it('en "cerca de mí" sin ubicación no hay coordenadas', async () =>
    {
        setUserLocation(null);

        const { result } = await renderHook(() => useActiveSearchLocation(), { wrapper });

        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(result.current.coordinates).toBeNull();
    });

    it('elegir una zona la usa y la guarda en el teléfono', async () =>
    {
        const { result } = await renderHook(
            () => ({ area: useSearchArea(), active: useActiveSearchLocation() }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.area.isSearchAreaReady).toBe(true));

        await act(async () => result.current.area.chooseZone(PALERMO));

        expect(result.current.active).toMatchObject({
            mode: 'zone',
            label: 'Palermo, Cdad. Autónoma de Buenos Aires, Argentina',
            coordinates: { latitude: PALERMO.latitude, longitude: PALERMO.longitude },
        });
        await waitFor(async () =>
            expect(JSON.parse((await AsyncStorage.getItem('search_area'))!))
                .toEqual({ mode: 'zone', zone: PALERMO })
        );
    });

    it('recuerda la zona guardada al abrir la app', async () =>
    {
        await AsyncStorage.setItem('search_area', JSON.stringify({ mode: 'zone', zone: PALERMO }));

        const { result } = await renderHook(() => useActiveSearchLocation(), { wrapper });

        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(result.current.mode).toBe('zone');
        expect(result.current.label).toContain('Palermo');
    });

    it.each([
        ['JSON roto', '{no es json'],
        ['zona sin coordenadas', JSON.stringify({ mode: 'zone', zone: { placeId: 'x', name: 'X', description: '' } })],
        ['modo desconocido', JSON.stringify({ mode: 'otro' })],
    ])('ignora lo guardado si está mal (%s) y arranca en "cerca de mí"', async (_case, stored) =>
    {
        await AsyncStorage.setItem('search_area', stored);
        jest.spyOn(console, 'error').mockImplementation(() => undefined);

        const { result } = await renderHook(() => useActiveSearchLocation(), { wrapper });

        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(result.current.mode).toBe('nearby');
    });

    it('volver a "cerca de mí" después de una zona', async () =>
    {
        const { result } = await renderHook(
            () => ({ area: useSearchArea(), active: useActiveSearchLocation() }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.area.isSearchAreaReady).toBe(true));

        await act(async () => result.current.area.chooseZone(PALERMO));
        await act(async () => result.current.area.chooseNearby());

        expect(result.current.active.mode).toBe('nearby');
        expect(result.current.active.label).toBe('Cerca de vos');
    });
});

describe('useStableSearchLocation', () =>
{
    // Que Resultados no vuelva a buscar cada vez que el GPS se actualiza.
    it('en "cerca de mí" se queda con la primera ubicación aunque te muevas', async () =>
    {
        const { result, rerender } = await renderHook(() => useStableSearchLocation(), { wrapper });
        await waitFor(() => expect(result.current.isReady).toBe(true));

        setUserLocation({ latitude: -34.61, longitude: -58.39, accuracy: 10 });
        await rerender({});

        expect(result.current.coordinates).toEqual({ latitude: HOME.latitude, longitude: HOME.longitude });
    });

    it('si al principio no había ubicación, toma la primera que llega', async () =>
    {
        setUserLocation(null);
        const { result, rerender } = await renderHook(() => useStableSearchLocation(), { wrapper });
        await waitFor(() => expect(result.current.isReady).toBe(true));
        expect(result.current.coordinates).toBeNull();

        setUserLocation(HOME);
        await rerender({});

        expect(result.current.coordinates).toEqual({ latitude: HOME.latitude, longitude: HOME.longitude });
    });

    it('cambia al elegir otra zona, y al volver a "cerca de mí" toma la ubicación actual', async () =>
    {
        const { result } = await renderHook(
            () => ({ area: useSearchArea(), stable: useStableSearchLocation() }),
            { wrapper }
        );
        await waitFor(() => expect(result.current.area.isSearchAreaReady).toBe(true));

        await act(async () => result.current.area.chooseZone(PALERMO));
        expect(result.current.stable.coordinates).toEqual({
            latitude: PALERMO.latitude,
            longitude: PALERMO.longitude,
        });

        const moved = { latitude: -34.62, longitude: -58.40, accuracy: 10 };
        setUserLocation(moved);
        await act(async () => result.current.area.chooseNearby());

        expect(result.current.stable.coordinates).toEqual({
            latitude: moved.latitude,
            longitude: moved.longitude,
        });
    });
});
