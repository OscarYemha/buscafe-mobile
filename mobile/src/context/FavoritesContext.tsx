import {
    createContext,
    ReactNode,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';

import { useAuth } from './AuthContext';

import {
    addFavorite,
    Favorite,
    getFavorites,
    removeFavorite as removeFavoriteApi,
} from '../services/api';

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

    const [favorites, setFavorites] =
        useState<Favorite[]>([]);

    const [isLoadingFavorites, setIsLoadingFavorites] =
        useState(false);

    const refreshFavorites = async () => {
        if (!isAuthenticated)
        {
            ++favoritesRequestIdRef.current;
            setFavorites([]);
            setIsLoadingFavorites(false);
            return;
        }

        const requestedUserId = user?.id;
        const requestId = ++favoritesRequestIdRef.current;

        try
        {
            setIsLoadingFavorites(true);

            const result =
                await getFavorites();

            if (
                isAuthenticatedRef.current &&
                userIdRef.current === requestedUserId &&
                favoritesRequestIdRef.current === requestId
            )
            {
                setFavorites(result);
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

    useEffect(() => {
        ++favoritesRequestIdRef.current;

        setFavorites([]);
        setIsLoadingFavorites(false);

        refreshFavorites();
    }, [isAuthenticated, user?.id]);

    const isFavorite = (
        googlePlaceId: string
    ) => {
        return favorites.some(
            favorite =>
                favorite.cafe.googlePlaceId ===
                googlePlaceId
        );
    };

    const removeFavorite = async (
        googlePlaceId: string
    ) => {
        await removeFavoriteApi(googlePlaceId);

        setFavorites(current =>
            current.filter(
                favorite =>
                    favorite.cafe.googlePlaceId !== googlePlaceId
            )
        );
    };

    const toggleFavorite = async (
        cafe: CafeSummary
    ) => {
        if (isFavorite(cafe.googlePlaceId))
        {
            await removeFavorite(
                cafe.googlePlaceId
            );

            return;
        }

        const favorite =
            await addFavorite({
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

        setFavorites(current => [
            favorite,
            ...current,
        ]);
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