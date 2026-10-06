import {
    ActivityIndicator,
    AppState,
    FlatList,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    useCallback,
    useEffect,
    useRef,
    useState,
} from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import MapView, { Marker } from 'react-native-maps';
import {
    getCurrentLocation,
    watchUserLocation,
    UserLocation,
} from '../services/location';
import { getNearbyCafes } from '../services/api';
import { CafeSummary } from '../types/CafeSummary';
import {
    CompositeScreenProps,
    useFocusEffect
} from '@react-navigation/native';

import {
    BottomTabScreenProps,
} from '@react-navigation/bottom-tabs';

import {
    NativeStackScreenProps,
} from '@react-navigation/native-stack';

import {
    MainTabParamList,
    RootStackParamlist,
} from '../navigation/AppNavigator';


type Props = CompositeScreenProps<
    BottomTabScreenProps<
        MainTabParamList,
        'Map'
    >,
    NativeStackScreenProps<RootStackParamlist>
>;

const MOVEMENT_THRESHOLD_METERS = 50;
const AUTO_REFRESH_COOLDOWN_MS = 10000;

export default function MapScreen(
    { navigation }: Props
)
{
    const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
    const [cafes, setCafes] = useState<CafeSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [canAskLocationAgain, setCanAskLocationAgain] = useState(true);
    const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
    const waitingForLocationSettings = useRef(false);
    const mapRef = useRef<MapView>(null);
    const listRef = useRef<FlatList<CafeSummary>>(null);
    const selectedLocationRef = useRef<UserLocation | null>(null);
    const movementCandidateRef = useRef<UserLocation | null>(null);
    const lastAutoRefreshRef = useRef(0);
    const autoRefreshInProgressRef = useRef(false);
    const cafesRequestIdRef = useRef(0);

    useFocusEffect(
        useCallback(() => {
            return () => {
                setSelectedCafeId(null);

                listRef.current?.scrollToOffset({
                    offset: 0,
                    animated: false,
                });
            };
        }, [])
    );

    const sortedCafes = [...cafes].sort((a, b) => {
        if (a.distanceKm === null)
        {
            return 1;
        }

        if (b.distanceKm === null)
        {
            return -1;
        }

        return a.distanceKm - b.distanceKm;
    });

    const selectedCafe =
    selectedCafeId !== null
        ? sortedCafes.find(
            (cafe) =>
                cafe.googlePlaceId === selectedCafeId
        ) ?? null
        : null;

    function calculateDistanceMeters(
        from: UserLocation,
        to: UserLocation
    ): number
    {
        const earthRadiusMeters = 6371000;

        const lat1 =
            from.latitude * Math.PI / 180;

        const lat2 =
            to.latitude * Math.PI / 180;

        const deltaLat =
            (to.latitude - from.latitude) *
            Math.PI / 180;

        const deltaLon =
            (to.longitude - from.longitude) *
            Math.PI / 180;

        const a =
            Math.sin(deltaLat / 2) ** 2 +
            Math.cos(lat1) *
            Math.cos(lat2) *
            Math.sin(deltaLon / 2) ** 2;

        const c =
            2 *
            Math.atan2(
                Math.sqrt(a),
                Math.sqrt(1 - a)
            );

        return earthRadiusMeters * c;
    }

    async function loadMap()
    {
        try
        {
            setLoading(true);
            setError(null);

            const locationResult =
                await getCurrentLocation();

            if (locationResult.status === 'denied')
            {
                setUserLocation(null);

                setCanAskLocationAgain(
                    locationResult.canAskAgain
                );

                setError(
                    locationResult.canAskAgain
                        ? 'Necesitamos tu ubicación para mostrar cafeterías cercanas.'
                        : 'El acceso a tu ubicación está desactivado. Habilitalo desde los ajustes del teléfono para explorar cafeterías cercanas.'
                );

                return;
            }

            setCanAskLocationAgain(true);

            const location = locationResult.location;

            setUserLocation(location);

            selectedLocationRef.current = location;
            movementCandidateRef.current = null;

            const requestId =
                ++cafesRequestIdRef.current;

            const nearbyCafes =
                await getNearbyCafes(
                    location.latitude,
                    location.longitude
                );

            if (
                requestId ===
                cafesRequestIdRef.current
            )
            {
                setCafes(nearbyCafes);
                setSelectedCafeId(null);

                listRef.current?.scrollToOffset({
                    offset: 0,
                    animated: false,
                });
            }
        }
        catch (error)
        {
            console.error(
                'Error al cargar el mapa',
                error
            );

            setError(
                'No se pudo cargar el mapa'
            );
        }
        finally
        {
            setLoading(false);
        }
    }

    useEffect(() => {
        loadMap();
    }, []);

    useEffect(() => {
        let subscription:
            Awaited<
                ReturnType<typeof watchUserLocation>
            > | null = null;

        let cancelled = false;

        async function startWatching()
        {
            try
            {
                subscription =
                    await watchUserLocation(
                        async (location) => {
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

                                setUserLocation(location);

                                return;
                            }

                            const distance =
                                calculateDistanceMeters(
                                    selectedLocation,
                                    location
                                );

                            if (
                                distance <
                                MOVEMENT_THRESHOLD_METERS
                            )
                            {
                                movementCandidateRef.current =
                                    null;

                                return;
                            }

                            const candidate =
                                movementCandidateRef.current;

                            if (!candidate)
                            {
                                movementCandidateRef.current =
                                    location;

                                return;
                            }

                            const candidateDistance =
                                calculateDistanceMeters(
                                    candidate,
                                    location
                                );

                            if (
                                candidateDistance >=
                                MOVEMENT_THRESHOLD_METERS
                            )
                            {
                                movementCandidateRef.current =
                                    location;

                                return;
                            }

                            const now = Date.now();

                            if (
                                autoRefreshInProgressRef.current ||
                                now -
                                    lastAutoRefreshRef.current <
                                    AUTO_REFRESH_COOLDOWN_MS
                            )
                            {
                                return;
                            }

                            selectedLocationRef.current =
                                location;

                            movementCandidateRef.current =
                                null;

                            setUserLocation(location);

                            autoRefreshInProgressRef.current =
                                true;

                            try
                            {
                                const requestId =
                                    ++cafesRequestIdRef.current;

                                const nearbyCafes =
                                    await getNearbyCafes(
                                        location.latitude,
                                        location.longitude
                                    );

                                if (cancelled)
                                {
                                    return;
                                }

                                if (
                                    requestId ===
                                    cafesRequestIdRef.current
                                )
                                {
                                    setCafes(nearbyCafes);
                                    setSelectedCafeId(null);

                                    listRef.current?.scrollToOffset({
                                        offset: 0,
                                        animated: false,
                                    });
                                }

                                lastAutoRefreshRef.current =
                                    Date.now();
                            }
                            catch (error)
                            {
                                console.error(
                                    'Error al actualizar cafeterías por movimiento',
                                    error
                                );
                            }
                            finally
                            {
                                autoRefreshInProgressRef.current =
                                    false;
                            }
                        }
                    );
            }
            catch (error)
            {
                console.error(
                    'Error al seguir la ubicación en el mapa',
                    error
                );
            }
        }

        startWatching();

        return () => {
            cancelled = true;
            subscription?.remove();
        };
    }, []);

    useEffect(() => {
        const subscription =
            AppState.addEventListener(
                'change',
                (nextAppState) => {
                    if (
                        nextAppState === 'active' &&
                        waitingForLocationSettings.current
                    )
                    {
                        waitingForLocationSettings.current = false;

                        loadMap();
                    }
                }
            );

        return () => {
            subscription.remove();
        };
    }, []);

    return (
        <SafeAreaView
            style={styles.container}
            edges={['left', 'right']}
        >
            <View style={styles.header}>
                <Text style={styles.title}>
                    Mapa
                </Text>

                <Text style={styles.description}>
                    Explorá cafeterías cerca de vos.
                </Text>
            </View>

            {loading && (
                <View style={styles.center}>
                    <ActivityIndicator
                        size="large"
                        color="#6B3A22"
                    />

                    <Text style={styles.message}>
                        Buscando cafeterías...
                    </Text>
                </View>
            )}

            {!loading && error && (
                <View style={styles.center}>
                    <View style={styles.locationCard}>
                        <Text style={styles.error}>
                            {error}
                        </Text>

                        <TouchableOpacity
                            style={styles.locationButton}
                            onPress={() => {
                                if (canAskLocationAgain)
                                {
                                    loadMap();
                                }
                                else
                                {
                                    waitingForLocationSettings.current =
                                        true;

                                    Linking.openSettings();
                                }
                            }}
                        >
                            <Text
                                style={
                                    styles.locationButtonText
                                }
                            >
                                {canAskLocationAgain
                                    ? '📍 Usar mi ubicación'
                                    : '⚙️ Abrir ajustes'}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            )}

            {!loading &&
                !error &&
                userLocation && (
                    <View style={styles.mapContent}>
                        <MapView
                            ref={mapRef}
                            style={styles.map}
                            mapType="standard"
                            customMapStyle={[
                                {
                                    featureType: 'poi',
                                    elementType: 'all',
                                    stylers: [
                                        {
                                            visibility: 'off',
                                        },
                                    ],
                                },
                            ]}
                            initialRegion={{
                                latitude:
                                    userLocation.latitude,
                                longitude:
                                    userLocation.longitude,
                                latitudeDelta: 0.02,
                                longitudeDelta: 0.02,
                            }}
                            showsUserLocation
                            showsMyLocationButton
                        >
                            {sortedCafes.map((cafe) => (
                                <Marker
                                    key={cafe.googlePlaceId}
                                    pinColor="#6B3A22"
                                    coordinate={{
                                        latitude: cafe.latitude,
                                        longitude: cafe.longitude,
                                    }}
                                    zIndex={
                                        selectedCafeId === cafe.googlePlaceId
                                            ? 1000
                                            : 1
                                    }
                                    onPress={() => {
                                        const cafeId =
                                            cafe.googlePlaceId;

                                        setSelectedCafeId(cafeId);

                                        mapRef.current?.animateToRegion(
                                            {
                                                latitude: cafe.latitude,
                                                longitude: cafe.longitude,
                                                latitudeDelta: 0.01,
                                                longitudeDelta: 0.01,
                                            },
                                            350
                                        );

                                        requestAnimationFrame(() => {
                                            const currentIndex =
                                                sortedCafes.findIndex(
                                                    (item) =>
                                                        item.googlePlaceId ===
                                                        cafeId
                                                );

                                            if (currentIndex < 0)
                                            {
                                                return;
                                            }

                                            listRef.current?.scrollToIndex({
                                                index: currentIndex,
                                                animated: true,
                                                viewPosition: 0.5,
                                            });
                                        });
                                    }}
                                />
                            ))}
                        </MapView>
                        {selectedCafe && (
                            <View style={styles.selectedCafeCard}>
                                <Text style={styles.selectedCafeName}>
                                    {selectedCafe.name}
                                </Text>

                                <Text
                                    style={styles.selectedCafeAddress}
                                    numberOfLines={1}
                                    ellipsizeMode="tail"
                                >
                                    {selectedCafe.shortAddress}
                                </Text>

                                <Text style={styles.selectedCafeRating}>
                                    Google ⭐{' '}
                                    {selectedCafe.googleRating !== null
                                        ? selectedCafe.googleRating.toFixed(1)
                                        : 'Sin puntuación'}
                                </Text>

                                <Text style={styles.selectedCafeRating}>
                                    BusCafé ⭐{' '}
                                    {selectedCafe.buscafeRating !== null
                                        ? selectedCafe.buscafeRating.toFixed(1)
                                        : 'Sin puntuación'}
                                </Text>
                            </View>
                        )}
                        <View style={styles.listContainer}>
                            <Text style={styles.listTitle}>
                                Cafeterías cercanas
                            </Text>

                            <FlatList
                                ref={listRef}
                                data={sortedCafes}
                                onScrollToIndexFailed={(info) => {
                                    listRef.current?.scrollToOffset({
                                        offset:
                                            info.averageItemLength *
                                            info.index,
                                        animated: false,
                                    });

                                    setTimeout(() => {
                                        listRef.current?.scrollToIndex({
                                            index: info.index,
                                            animated: true,
                                            viewPosition: 0.5,
                                        });
                                    }, 100);
                                }}
                                keyExtractor={(cafe) =>
                                    cafe.googlePlaceId
                                }
                                showsVerticalScrollIndicator
                                renderItem={({ item: cafe }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.cafeRow,
                                            selectedCafeId ===
                                                cafe.googlePlaceId &&
                                                styles.cafeRowSelected,
                                        ]}
                                        activeOpacity={0.7}
                                        onPress={() => {
                                            if (
                                                selectedCafeId ===
                                                cafe.googlePlaceId
                                            )
                                            {
                                                navigation.navigate(
                                                    'CafeDetail',
                                                    {
                                                        googlePlaceId:
                                                            cafe.googlePlaceId,
                                                    }
                                                );

                                                return;
                                            }

                                            setSelectedCafeId(
                                                cafe.googlePlaceId
                                            );

                                            mapRef.current?.animateToRegion(
                                                {
                                                    latitude: cafe.latitude,
                                                    longitude: cafe.longitude,
                                                    latitudeDelta: 0.01,
                                                    longitudeDelta: 0.01,
                                                },
                                                350
                                            );
                                        }}
                                    >
                                        <View style={styles.cafeMainInfo}>
                                            <Text
                                                style={styles.cafeName}
                                                numberOfLines={1}
                                                ellipsizeMode="tail"
                                            >
                                                {cafe.name}
                                                {cafe.shortAddress
                                                    ? ` • ${cafe.shortAddress}`
                                                    : ''}
                                            </Text>

                                            <Text style={styles.cafeRatings}>
                                                Google ★{' '}
                                                {cafe.googleRating !== null
                                                    ? cafe.googleRating.toFixed(1)
                                                    : 'Sin reseñas'}
                                                {'   ·   '}
                                                BusCafé ★{' '}
                                                {cafe.buscafeRating !== null
                                                    ? cafe.buscafeRating.toFixed(1)
                                                    : 'Sin reseñas'}
                                            </Text>
                                        </View>

                                        <Text style={styles.cafeDistance}>
                                            {cafe.distanceKm !== null
                                                ? `${cafe.distanceKm.toFixed(1)} km`
                                                : '—'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            />
                        </View>
                    </View>
                )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F1E7',
    },

    header: {
        paddingHorizontal: 20,
        paddingTop: 5,
        paddingBottom: 8,
    },

    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#4A2416',
    },

    description: {
        marginTop: 6,
        fontSize: 15,
        color: '#7A6254',
    },

    center: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingHorizontal: 30,
    },

    message: {
        marginTop: 12,
        fontSize: 15,
        color: '#7A6254',
    },

    error: {
        fontSize: 15,
        color: '#A13D32',
        textAlign: 'center',
    },

    mapContent: {
        flex: 1,
    },

    map: {
        flex: 1,
    },

    selectedCafeRatings: {
        marginTop: 8,
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 14,
    },

    selectedCafeCard: {
        position: 'absolute',
        alignSelf: 'center',
        maxWidth: '85%',
        minWidth: 210,
        bottom: 216,
        zIndex: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E8D9C7',
        elevation: 5,
    },

    selectedCafeName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4A2416',
    },

    selectedCafeAddress: {
        marginTop: 2,
        fontSize: 13,
        color: '#7A6254',
    },

    selectedCafeRating: {
        marginTop: 2,
        fontSize: 13,
        color: '#4A2416',
    },

    listContainer: {
        height: 200,
        backgroundColor: '#FFFDFC',
    },

    listTitle: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        marginBottom: 0,
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
        backgroundColor: '#6B3A22',
        borderBottomWidth: 1,
        borderBottomColor: '#E8D9C7',
    },

    cafeRow: {
        minHeight: 65,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 9,
        borderBottomWidth: 1,
        borderBottomColor: '#EEE2D6',
    },

    cafeMainInfo: {
        flex: 1,
        paddingRight: 10,
    },

    cafeName: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4A2416',
    },

    cafeRatings: {
        marginTop: 5,
        fontSize: 12,
        color: '#7A6254',
    },

    cafeDistance: {
        fontSize: 13,
        fontWeight: '600',
        color: '#6B3A22',
    },

    locationCard: {
        width: '100%',
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        padding: 16,
        borderWidth: 1,
        borderColor: '#E8D9C7',
    },

    locationButton: {
        marginTop: 14,
        backgroundColor: '#6B3A22',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },

    locationButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    cafeRowSelected: {
        backgroundColor: '#F3E4C8',
    },
});
