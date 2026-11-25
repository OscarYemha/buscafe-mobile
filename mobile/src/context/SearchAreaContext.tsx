import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useMemo,
    useRef,
    useState,
} from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Zone } from '../types/Zone';
import { useNearbyCafes } from './NearbyCafesContext';

/*
 * Dónde buscan las categorías: cerca de la ubicación del usuario o en una
 * zona elegida a mano ("Elegir zona"). Se recuerda entre sesiones, así
 * que si elegís Palermo para estudiar y después tocás Buen café, sigue
 * buscando en Palermo.
 *
 * "Cafés cerca de vos" de Home no usa esto: siempre es por GPS.
 */
export type SearchArea =
    | { mode: 'nearby' }
    | { mode: 'zone'; zone: Zone };

type SearchAreaContextValue = {
    searchArea: SearchArea;
    /** false mientras se lee la zona guardada en el teléfono. */
    isSearchAreaReady: boolean;
    chooseNearby: () => void;
    chooseZone: (zone: Zone) => void;
};

const STORAGE_KEY = 'search_area';
const NEARBY: SearchArea = { mode: 'nearby' };

const SearchAreaContext =
    createContext<SearchAreaContextValue | null>(null);

function isStoredZone(value: unknown): value is Zone
{
    const zone = value as Partial<Zone> | null;

    return (
        typeof zone?.placeId === 'string' &&
        typeof zone.name === 'string' &&
        typeof zone.description === 'string' &&
        typeof zone.latitude === 'number' &&
        typeof zone.longitude === 'number'
    );
}

export function SearchAreaProvider({ children }: { children: ReactNode })
{
    const [searchArea, setSearchArea] = useState<SearchArea>(NEARBY);
    const [isSearchAreaReady, setIsSearchAreaReady] = useState(false);

    useEffect(() =>
    {
        let active = true;

        const load = async () =>
        {
            try
            {
                const stored = await AsyncStorage.getItem(STORAGE_KEY);
                const parsed = stored ? JSON.parse(stored) : null;

                // Si lo guardado está roto, se arranca con "cerca de mí".
                if (active && parsed?.mode === 'zone' && isStoredZone(parsed.zone))
                {
                    setSearchArea({ mode: 'zone', zone: parsed.zone });
                }
            }
            catch (error)
            {
                console.error('No se pudo recuperar la zona de búsqueda:', error);
            }
            finally
            {
                if (active)
                {
                    setIsSearchAreaReady(true);
                }
            }
        };

        void load();

        return () => {
            active = false;
        };
    }, []);

    const save = useCallback((next: SearchArea) =>
    {
        setSearchArea(next);

        // Si no se puede guardar, igual vale para esta sesión.
        AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(next)).catch(
            (error) => console.error('No se pudo guardar la zona de búsqueda:', error)
        );
    }, []);

    const value = useMemo<SearchAreaContextValue>(() => ({
        searchArea,
        isSearchAreaReady,
        chooseNearby: () => save(NEARBY),
        chooseZone: (zone) => save({ mode: 'zone', zone }),
    }), [searchArea, isSearchAreaReady, save]);

    return (
        <SearchAreaContext.Provider value={value}>
            {children}
        </SearchAreaContext.Provider>
    );
}

export function useSearchArea(): SearchAreaContextValue
{
    const context = useContext(SearchAreaContext);

    if (!context)
    {
        throw new Error('useSearchArea debe usarse dentro de SearchAreaProvider');
    }

    return context;
}

export type ActiveSearchLocation = {
    /** null si la zona es "cerca de mí" y todavía no hay ubicación. */
    coordinates: { latitude: number; longitude: number } | null;
    /** "Cerca de vos" o "Palermo, Ciudad Autónoma de Buenos Aires…". */
    label: string;
    mode: SearchArea['mode'];
    isReady: boolean;
};

/** Coordenadas y texto de la zona donde buscan las categorías. */
export function useActiveSearchLocation(): ActiveSearchLocation
{
    const { searchArea, isSearchAreaReady } = useSearchArea();
    const { userLocation } = useNearbyCafes();

    if (searchArea.mode === 'zone')
    {
        const { zone } = searchArea;

        return {
            coordinates: { latitude: zone.latitude, longitude: zone.longitude },
            label: zone.description ? `${zone.name}, ${zone.description}` : zone.name,
            mode: 'zone',
            isReady: isSearchAreaReady,
        };
    }

    return {
        coordinates: userLocation
            ? { latitude: userLocation.latitude, longitude: userLocation.longitude }
            : null,
        label: 'Cerca de vos',
        mode: 'nearby',
        isReady: isSearchAreaReady,
    };
}

/**
 * Igual que useActiveSearchLocation, pero en modo "cerca de mí" se queda
 * con la primera ubicación conocida: así Resultados no vuelve a buscar
 * cada vez que el GPS se actualiza mientras caminás. Cambia solo si se
 * elige otra zona (o "cerca de mí" de nuevo después de una zona).
 */
export function useStableSearchLocation(): ActiveSearchLocation
{
    const active = useActiveSearchLocation();
    const frozenRef = useRef<{
        key: string;
        coordinates: ActiveSearchLocation['coordinates'];
    } | null>(null);

    const key = active.mode === 'zone' && active.coordinates
        ? `zone:${active.coordinates.latitude},${active.coordinates.longitude}`
        : 'nearby';

    if (frozenRef.current?.key !== key || frozenRef.current.coordinates === null)
    {
        frozenRef.current = { key, coordinates: active.coordinates };
    }

    return { ...active, coordinates: frozenRef.current.coordinates };
}
