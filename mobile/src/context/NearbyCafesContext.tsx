import {
    createContext,
    ReactNode,
    useCallback,
    useContext,
    useEffect,
    useRef,
    useState,
} from 'react';
import { AppState } from 'react-native';
import { CafeSummary } from '../types/CafeSummary';
import { getNearbyCafes } from '../services/api';
import {
    getCurrentLocation,
    UserLocation,
    watchUserLocation,
} from '../services/location';

const MOVEMENT_THRESHOLD_METERS = 50;
const SIGNIFICANT_ACCURACY_IMPROVEMENT_METERS = 10;
const AUTO_REFRESH_COOLDOWN_MS = 10000;

type NearbyCafesContextValue = {
    userLocation: UserLocation | null;
    cafes: CafeSummary[];
    loading: boolean;
    error: string | null;
    canAskLocationAgain: boolean;
    refreshNearbyCafes: () => Promise<void>;
    markWaitingForLocationSettings: () => void;
};

const NearbyCafesContext =
    createContext<NearbyCafesContextValue | null>(null);

type Props = {
    children: ReactNode;
};

function degreesToRadians(degrees: number): number
{
    return degrees * (Math.PI / 180);
}

function calculateLocationDistanceMeters(
    location1: UserLocation,
    location2: UserLocation
): number
{
    const earthRadiusMeters = 6371000;

    const latitudeDifference =
        degreesToRadians(
            location2.latitude - location1.latitude
        );

    const longitudeDifference =
        degreesToRadians(
            location2.longitude - location1.longitude
        );

    const latitude1 =
        degreesToRadians(location1.latitude);

    const latitude2 =
        degreesToRadians(location2.latitude);

    const a =
        Math.sin(latitudeDifference / 2) ** 2 +
        Math.cos(latitude1) *
            Math.cos(latitude2) *
            Math.sin(longitudeDifference / 2) ** 2;

    const c =
        2 * Math.atan2(
            Math.sqrt(a),
            Math.sqrt(1 - a)
        );

    return earthRadiusMeters * c;
}

export function NearbyCafesProvider(
    { children }: Props
)
{
    const [userLocation, setUserLocation] =
        useState<UserLocation | null>(null);

    const [cafes, setCafes] =
        useState<CafeSummary[]>([]);

    const [loading, setLoading] =
        useState(true);

    const [error, setError] =
        useState<string | null>(null);

    const [
        canAskLocationAgain,
        setCanAskLocationAgain,
    ] = useState(true);

    const selectedLocationRef =
        useRef<UserLocation | null>(null);

    const movementCandidateRef =
        useRef<UserLocation | null>(null);

    const lastAutoRefreshRef =
        useRef(0);

    const autoRefreshInProgressRef =
        useRef(false);

    const waitingForLocationSettings =
        useRef(false);

    const requestIdRef =
        useRef(0);

    const updateNearbyCafesFromLocation =
        useCallback(
            async (
                location: UserLocation,
                showLoading = false
            ) => {
                const requestId =
                    ++requestIdRef.current;

                if (showLoading)
                {
                    setLoading(true);
                }

                setError(null);
                setUserLocation(location);

                try
                {
                    const nearbyCafes =
                        await getNearbyCafes(
                            location.latitude,
                            location.longitude
                        );

                    if (
                        requestId !==
                        requestIdRef.current
                    )
                    {
                        return;
                    }

                    setCafes(nearbyCafes);
                }
                catch (error)
                {
                    console.error(
                        'Error al obtener las cafeterías cercanas:',
                        error
                    );

                    if (
                        requestId ===
                        requestIdRef.current
                    )
                    {
                        setError(
                            'No se pudieron cargar las cafeterías cercanas.'
                        );
                    }
                }
                finally
                {
                    if (
                        showLoading &&
                        requestId ===
                            requestIdRef.current
                    )
                    {
                        setLoading(false);
                    }
                }
            },
            []
        );

    const refreshNearbyCafes =
        useCallback(async () => {
            setLoading(true);
            setError(null);

            try
            {
                const result =
                    await getCurrentLocation();

                if (result.status === 'denied')
                {
                    ++requestIdRef.current;

                    setUserLocation(null);
                    setCafes([]);

                    setCanAskLocationAgain(
                        result.canAskAgain
                    );

                    setError(
                        result.canAskAgain
                            ? 'Necesitamos tu ubicación para mostrar cafeterías cercanas.'
                            : 'El acceso a tu ubicación está desactivado. Habilitalo desde los ajustes del teléfono para ver las cafeterías cercanas.'
                    );

                    return;
                }

                const location =
                    result.location;

                setCanAskLocationAgain(true);

                selectedLocationRef.current =
                    location;

                movementCandidateRef.current =
                    null;

                await updateNearbyCafesFromLocation(
                    location
                );
            }
            catch (error)
            {
                console.error(
                    'Error al actualizar ubicación y cafeterías:',
                    error
                );

                setError(
                    'No se pudieron cargar las cafeterías cercanas.'
                );
            }
            finally
            {
                setLoading(false);
            }
        }, [updateNearbyCafesFromLocation]);

    const autoRefreshNearbyCafes =
        useCallback(
            async (location: UserLocation) => {
                const now = Date.now();

                if (
                    autoRefreshInProgressRef.current
                )
                {
                    return;
                }

                if (
                    now -
                        lastAutoRefreshRef.current <
                    AUTO_REFRESH_COOLDOWN_MS
                )
                {
                    return;
                }

                try
                {
                    autoRefreshInProgressRef.current =
                        true;

                    lastAutoRefreshRef.current =
                        now;

                    await updateNearbyCafesFromLocation(
                        location
                    );
                }
                finally
                {
                    autoRefreshInProgressRef.current =
                        false;
                }
            },
            [updateNearbyCafesFromLocation]
        );

    const markWaitingForLocationSettings =
        useCallback(() => {
            waitingForLocationSettings.current =
                true;
        }, []);

    useEffect(() => {
        void refreshNearbyCafes();
    }, [refreshNearbyCafes]);

    useEffect(() => {
        let subscription:
            Awaited<
                ReturnType<
                    typeof watchUserLocation
                >
            > | null = null;

        let cancelled = false;

        const startLocationWatch =
            async () => {
                try
                {
                    subscription =
                        await watchUserLocation(
                            (location) => {
                                if (cancelled)
                                {
                                    return;
                                }

                                const selectedLocation =
                                    selectedLocationRef.current;

                                if (!selectedLocation)
                                {
                                    selectedLocationRef.current =
                                        location;

                                    setUserLocation(
                                        location
                                    );

                                    return;
                                }

                                const distanceMeters =
                                    calculateLocationDistanceMeters(
                                        selectedLocation,
                                        location
                                    );

                                const currentAccuracy =
                                    selectedLocation.accuracy ??
                                    Number.POSITIVE_INFINITY;

                                const newAccuracy =
                                    location.accuracy ??
                                    Number.POSITIVE_INFINITY;

                                if (
                                    distanceMeters >=
                                    MOVEMENT_THRESHOLD_METERS
                                )
                                {
                                    const candidate =
                                        movementCandidateRef.current;

                                    if (!candidate)
                                    {
                                        movementCandidateRef.current =
                                            location;

                                        return;
                                    }

                                    const candidateDistance =
                                        calculateLocationDistanceMeters(
                                            candidate,
                                            location
                                        );

                                    if (
                                        candidateDistance <=
                                        MOVEMENT_THRESHOLD_METERS
                                    )
                                    {
                                        selectedLocationRef.current =
                                            location;

                                        movementCandidateRef.current =
                                            null;

                                        void autoRefreshNearbyCafes(
                                            location
                                        );

                                        return;
                                    }

                                    movementCandidateRef.current =
                                        location;

                                    return;
                                }

                                movementCandidateRef.current =
                                    null;

                                if (
                                    newAccuracy <
                                    currentAccuracy
                                )
                                {
                                    const accuracyImprovement =
                                        currentAccuracy -
                                        newAccuracy;

                                    selectedLocationRef.current =
                                        location;

                                    if (
                                        accuracyImprovement >=
                                        SIGNIFICANT_ACCURACY_IMPROVEMENT_METERS
                                    )
                                    {
                                        void autoRefreshNearbyCafes(
                                            location
                                        );
                                    }
                                }
                            }
                        );

                    if (cancelled)
                    {
                        subscription.remove();
                    }
                }
                catch (error)
                {
                    console.error(
                        'Error al seguir la ubicación:',
                        error
                    );
                }
            };

        void startLocationWatch();

        return () => {
            cancelled = true;
            subscription?.remove();
        };
    }, [autoRefreshNearbyCafes]);

    useEffect(() => {
        let previousAppState = AppState.currentState;

        const subscription = AppState.addEventListener(
            'change',
            (nextAppState) => {
                const returnedToForeground =
                    (previousAppState === 'background' ||
                    previousAppState === 'inactive') &&
                    nextAppState === 'active';

                previousAppState = nextAppState;

                if (!returnedToForeground)
                {
                    return;
                }

                waitingForLocationSettings.current = false;

                void refreshNearbyCafes();
            }
        );

        return () => {
            subscription.remove();
        };
    }, [refreshNearbyCafes]);

    return (
        <NearbyCafesContext.Provider
            value={{
                userLocation,
                cafes,
                loading,
                error,
                canAskLocationAgain,
                refreshNearbyCafes,
                markWaitingForLocationSettings,
            }}
        >
            {children}
        </NearbyCafesContext.Provider>
    );
}

export function useNearbyCafes()
{
    const context =
        useContext(NearbyCafesContext);

    if (!context)
    {
        throw new Error(
            'useNearbyCafes debe usarse dentro de NearbyCafesProvider'
        );
    }

    return context;
}