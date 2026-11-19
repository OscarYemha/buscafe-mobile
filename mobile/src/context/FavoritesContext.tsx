import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { Alert } from 'react-native';
import NetInfo from '@react-native-community/netinfo';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useAuth } from './AuthContext';
import {
    addFavorite,
    Favorite,
    getFavorites,
    removeFavorite as removeFavoriteApi,
} from '../services/api';
import { isDefinitiveApiError } from '../services/apiError';
import { CafeSummary } from '../types/CafeSummary';

type FavoritesContextType = {
    favorites: Favorite[];
    isLoadingFavorites: boolean;

    isFavorite: (
        googlePlaceId: string
    ) => boolean;

    toggleFavorite: (
        cafe: CafeSummary
    ) => Promise<void>;

    removeFavorite: (
        googlePlaceId: string
    ) => Promise<void>;

    refreshFavorites: () => Promise<void>;
};

const FavoritesContext =
    createContext<FavoritesContextType | undefined>(
        undefined
    );

const FAVORITES_CACHE_PREFIX = 'buscafe_favorites_';

function getFavoritesCacheKey(userId: number): string
{
    return `${FAVORITES_CACHE_PREFIX}${userId}`;
}

async function readCachedFavorites(
    userId: number
): Promise<Favorite[]>
{
    try
    {
        const stored = await AsyncStorage.getItem(
            getFavoritesCacheKey(userId)
        );

        if (!stored)
        {
            return [];
        }

        const parsed: unknown = JSON.parse(stored);

        if (!Array.isArray(parsed))
        {
            return [];
        }

        return parsed.filter(
            (item): item is Favorite =>
                typeof item === 'object' &&
                item !== null &&
                typeof item.cafe === 'object' &&
                item.cafe !== null &&
                typeof item.cafe.googlePlaceId === 'string'
        );
    }
    catch (error)
    {
        console.error(
            'ERROR LEYENDO FAVORITOS LOCALES:',
            error
        );

        return [];
    }
}

async function saveCachedFavorites(
    userId: number,
    favorites: Favorite[]
): Promise<void>
{
    try
    {
        await AsyncStorage.setItem(
            getFavoritesCacheKey(userId),
            JSON.stringify(favorites)
        );
    }
    catch (error)
    {
        console.error(
            'ERROR GUARDANDO FAVORITOS LOCALES:',
            error
        );
    }
}

export function FavoritesProvider({
    children,
}: {
    children: ReactNode;
})
{
    const { isAuthenticated, user } = useAuth();

    const isAuthenticatedRef = useRef(isAuthenticated);
    isAuthenticatedRef.current = isAuthenticated;

    const userIdRef = useRef(user?.id);
    userIdRef.current = user?.id;

    const favoritesRequestIdRef = useRef(0);
    const favoritesMutationCountRef = useRef(0);
    const favoritesRef = useRef<Favorite[]>([]);
    const pendingMutationsRef = useRef<Set<string>>(new Set());
    const mutationQueueRef = useRef<Promise<void>>(Promise.resolve());
    const cacheWriteQueueRef = useRef<Promise<void>>(Promise.resolve());
    const cacheReadyRef = useRef(false);
    const isOnlineRef = useRef<boolean | null>(null);
    const needsReconciliationRef = useRef(false);
    const refreshFavoritesRef = useRef<() => Promise<void>>(
        async () => {}
    );

    const [favorites, setFavorites] = useState<Favorite[]>([]);
    const [isLoadingFavorites, setIsLoadingFavorites] = useState(false);

    const updateFavorites = (
        nextFavorites: Favorite[]
    ) => {
        favoritesRef.current = nextFavorites;
        setFavorites(nextFavorites);
    };

    const isCurrentUser = (
        requestedUserId: number
    ) => {
        return (
            isAuthenticatedRef.current &&
            userIdRef.current === requestedUserId
        );
    };

    const persistFavorites = (
        requestedUserId: number,
        nextFavorites: Favorite[]
    ): Promise<void> => {
        const write = async () => {
            if (
                !isCurrentUser(requestedUserId) ||
                !cacheReadyRef.current
            )
            {
                return;
            }

            await saveCachedFavorites(
                requestedUserId,
                nextFavorites
            );
        };

        const nextWrite =
            cacheWriteQueueRef.current.then(write, write);

        cacheWriteQueueRef.current = nextWrite;

        return nextWrite;
    };

    const refreshFavorites = async () => {
        const requestedUserId = user?.id;

        if (
            !isAuthenticated ||
            requestedUserId === undefined
        )
        {
            ++favoritesRequestIdRef.current;
            updateFavorites([]);
            setIsLoadingFavorites(false);
            return;
        }

        const requestId = ++favoritesRequestIdRef.current;
        const mutationCountAtStart =
            favoritesMutationCountRef.current;

        try
        {
            setIsLoadingFavorites(true);

            const result = await getFavorites();

            if (
                isCurrentUser(requestedUserId) &&
                favoritesRequestIdRef.current === requestId &&
                favoritesMutationCountRef.current === mutationCountAtStart &&
                pendingMutationsRef.current.size === 0
            )
            {
                updateFavorites(result);
                needsReconciliationRef.current = false;

                await persistFavorites(
                    requestedUserId,
                    result
                );
            }
        }
        catch (error)
        {
            console.error(
                'ERROR CARGANDO FAVORITOS:',
                error
            );
        }
        finally
        {
            if (favoritesRequestIdRef.current === requestId)
            {
                setIsLoadingFavorites(false);
            }
        }
    };

    refreshFavoritesRef.current = refreshFavorites;

    useEffect(() => {
        const requestId = ++favoritesRequestIdRef.current;
        const currentUserId = user?.id;

        cacheReadyRef.current = false;
        needsReconciliationRef.current = false;
        updateFavorites([]);
        setIsLoadingFavorites(false);

        if (
            !isAuthenticated ||
            currentUserId === undefined
        )
        {
            return;
        }

        let cancelled = false;

        const initializeFavorites = async () => {
            const cachedFavorites =
                await readCachedFavorites(currentUserId);

            if (
                cancelled ||
                favoritesRequestIdRef.current !== requestId ||
                !isCurrentUser(currentUserId)
            )
            {
                return;
            }

            updateFavorites(cachedFavorites);
            cacheReadyRef.current = true;

            await refreshFavoritesRef.current();
        };

        void initializeFavorites();

        return () => {
            cancelled = true;
            cacheReadyRef.current = false;
        };
    }, [isAuthenticated, user?.id]);

    useEffect(() => {
        let wasOnline = false;

        const unsubscribe = NetInfo.addEventListener(state => {
            const isOnline =
                state.isConnected === true &&
                state.isInternetReachable === true;

            isOnlineRef.current = isOnline;

            if (isOnline && !wasOnline)
            {
                if (
                    isAuthenticatedRef.current &&
                    cacheReadyRef.current
                )
                {
                    // Solo marcamos la reconciliación como terminada
                    // cuando la lectura del servidor se haya completado.
                    void refreshFavoritesRef.current();
                }
            }

            wasOnline = isOnline;
        });

        return () => {
            unsubscribe();
        };
    }, []);

    const isFavorite = (
        googlePlaceId: string
    ) => {
        return favorites.some(
            favorite =>
                favorite.cafe.googlePlaceId ===
                googlePlaceId
        );
    };

    const checkConnection = async (): Promise<boolean> => {
        try
        {
            let state = await NetInfo.fetch();

            // Si todavía no se evaluó el acceso real a Internet,
            // pedimos una comprobación adicional antes de permitir cambios.
            if (
                state.isConnected === true &&
                state.isInternetReachable === null
            )
            {
                state = await NetInfo.refresh();
            }

            const isOnline =
                state.isConnected === true &&
                state.isInternetReachable === true;

            isOnlineRef.current = isOnline;

            if (!isOnline)
            {
                Alert.alert(
                    'Sin conexión',
                    'Para modificar tus favoritos necesitamos confirmar la conexión a Internet. No se realizó ningún cambio.'
                );
            }

            return isOnline;
        }
        catch (error)
        {
            console.error(
                'ERROR COMPROBANDO CONEXIÓN:',
                error
            );

            Alert.alert(
                'Sin conexión',
                'No pudimos comprobar tu conexión a Internet. Intentá nuevamente más tarde.'
            );

            return false;
        }
    };

    const executeMutation = async (
        googlePlaceId: string,
        operation: (
            requestedUserId: number
        ) => Promise<void>
    ): Promise<void> => {
        const requestedUserId = user?.id;

        if (
            !isAuthenticated ||
            requestedUserId === undefined
        )
        {
            Alert.alert(
                'Iniciá sesión',
                'Tenés que iniciar sesión para modificar tus favoritos.'
            );
            return;
        }

        if (pendingMutationsRef.current.has(googlePlaceId))
        {
            return;
        }

        pendingMutationsRef.current.add(googlePlaceId);

        const previousMutation = mutationQueueRef.current;

        const currentMutation = async () => {
            try
            {
                await previousMutation;

                if (!isCurrentUser(requestedUserId))
                {
                    return;
                }

                const isOnline = await checkConnection();

                if (!isOnline)
                {
                    return;
                }

                ++favoritesMutationCountRef.current;
                ++favoritesRequestIdRef.current;
                setIsLoadingFavorites(false);

                await operation(requestedUserId);
            }
            catch (error)
            {
                console.error(
                    'ERROR MODIFICANDO FAVORITOS:',
                    error
                );

                // El servidor respondió que no aplicó el cambio (4xx o
                // 502): no hay nada que reconciliar, mostramos su motivo.
                if (isDefinitiveApiError(error))
                {
                    Alert.alert(
                        'No se pudo actualizar tus favoritos',
                        error.message
                    );

                    return;
                }

                // Una solicitud puede haberse aplicado en el servidor
                // aunque el teléfono no haya recibido su respuesta.
                // No cambiamos la caché basándonos en ese error.
                needsReconciliationRef.current = true;

                Alert.alert(
                    'No se pudo confirmar el cambio',
                    'Puede que el servidor haya recibido la solicitud. Conservamos tus favoritos locales y volveremos a sincronizarlos cuando sea posible.'
                );
            }
            finally
            {
                pendingMutationsRef.current.delete(googlePlaceId);

                // Las lecturas iniciadas durante una mutación se descartan.
                // Al terminar, volvemos a consultar el servidor si hubo
                // una respuesta incierta y todavía hay conexión.
                if (
                    needsReconciliationRef.current &&
                    pendingMutationsRef.current.size === 0 &&
                    isCurrentUser(requestedUserId) &&
                    isOnlineRef.current === true
                )
                {
                    void refreshFavoritesRef.current();
                }
            }
        };

        const task = currentMutation();

        mutationQueueRef.current = task;

        await task;
    };

    const removeFavorite = async (
        googlePlaceId: string
    ) => {
        await executeMutation(
            googlePlaceId,
            async requestedUserId => {
                await removeFavoriteApi(googlePlaceId);

                if (!isCurrentUser(requestedUserId))
                {
                    return;
                }

                const updatedFavorites =
                    favoritesRef.current.filter(
                        favorite =>
                            favorite.cafe.googlePlaceId !== googlePlaceId
                    );

                updateFavorites(updatedFavorites);

                await persistFavorites(
                    requestedUserId,
                    updatedFavorites
                );
            }
        );
    };

    const toggleFavorite = async (
        cafe: CafeSummary
    ) => {
        await executeMutation(
            cafe.googlePlaceId,
            async requestedUserId => {
                const alreadyFavorite =
                    favoritesRef.current.some(
                        favorite =>
                            favorite.cafe.googlePlaceId ===
                            cafe.googlePlaceId
                    );

                if (alreadyFavorite)
                {
                    await removeFavoriteApi(cafe.googlePlaceId);

                    if (!isCurrentUser(requestedUserId))
                    {
                        return;
                    }

                    const updatedFavorites =
                        favoritesRef.current.filter(
                            favorite =>
                                favorite.cafe.googlePlaceId !==
                                cafe.googlePlaceId
                        );

                    updateFavorites(updatedFavorites);

                    await persistFavorites(
                        requestedUserId,
                        updatedFavorites
                    );

                    return;
                }

                const favorite = await addFavorite({
                    googlePlaceId:
                        cafe.googlePlaceId,

                    cafeName:
                        cafe.name,

                    cafeAddress:
                        cafe.address,

                    cafeLatitude:
                        cafe.latitude,

                    cafeLongitude:
                        cafe.longitude,
                });

                if (!isCurrentUser(requestedUserId))
                {
                    return;
                }

                const updatedFavorites = [
                    favorite,
                    ...favoritesRef.current.filter(
                        current =>
                            current.cafe.googlePlaceId !==
                            cafe.googlePlaceId
                    ),
                ];

                updateFavorites(updatedFavorites);

                await persistFavorites(
                    requestedUserId,
                    updatedFavorites
                );
            }
        );
    };

    return (
        <FavoritesContext.Provider
            value={{
                favorites,
                isLoadingFavorites,
                isFavorite,
                toggleFavorite,
                removeFavorite,
                refreshFavorites,
            }}
        >
            {children}
        </FavoritesContext.Provider>
    );
}

export function useFavorites()
{
    const context =
        useContext(FavoritesContext);

    if (!context)
    {
        throw new Error(
            'useFavorites debe usarse dentro de FavoritesProvider'
        );
    }

    return context;
}