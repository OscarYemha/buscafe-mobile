import {
    ActivityIndicator,
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
import MapView, { Marker, Region } from 'react-native-maps';
import { useNearbyCafes } from '../context/NearbyCafesContext';
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

export default function MapScreen(
    { navigation }: Props
)
{
    const {
        userLocation,
        cafes,
        loading,
        error,
        canAskLocationAgain,
        refreshNearbyCafes,
        markWaitingForLocationSettings,
    } = useNearbyCafes();

    const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
    const [selectedCafePoint, setSelectedCafePoint] = useState<{ x: number; y: number } | null>(null);
    const [exploredRegion, setExploredRegion] = useState<Region | null>(null);
    const [showSearchAreaButton, setShowSearchAreaButton] = useState(false);
    const [explorationCafes, setExplorationCafes] = useState<CafeSummary[] | null>(null);
    const [explorationLoading, setExplorationLoading] = useState(false);
    const [explorationError, setExplorationError] = useState<string | null>(null);
    const [mapSize, setMapSize] = useState({width: 0, height: 0,});

    const mapRef = useRef<MapView>(null);
    const listRef = useRef<FlatList<CafeSummary>>(null);
    const programmaticMovementRef = useRef(false);
    const isMapGestureActiveRef = useRef(false);
    const isExploringMapRef = useRef(false);
    const explorationRequestIdRef = useRef(0);

    useFocusEffect(
        useCallback(() => {
            return () => {
                setSelectedCafeId(null);
                setSelectedCafePoint(null);

                listRef.current?.scrollToOffset({
                    offset: 0,
                    animated: false,
                });
            };
        }, [])
    );

    const displayedCafes = explorationCafes ?? cafes;

    const sortedCafes = [...displayedCafes].sort((a, b) => {
        if (a.distanceKm === null && b.distanceKm === null)
        {
            return 0;
        }

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

    const CARD_WIDTH = 240;
    const CARD_HEIGHT = 135;
    const MAP_MARGIN = 12;

    const selectedCardPosition =
        selectedCafePoint && mapSize.width > 0 && mapSize.height > 0
            ? {
                left: Math.max(
                    CARD_WIDTH / 2 + MAP_MARGIN,
                    Math.min(
                        selectedCafePoint.x,
                        mapSize.width - CARD_WIDTH / 2 - MAP_MARGIN
                    )
                ),
                top: Math.max(
                    CARD_HEIGHT + MAP_MARGIN,
                    Math.min(
                        selectedCafePoint.y,
                        mapSize.height - MAP_MARGIN
                    )
                ),
            }
            : null;

    async function updateSelectedCafePoint(
        cafe: CafeSummary
    )
    {
        if (!mapRef.current)
        {
            return;
        }

        try
        {
            const point =
                await mapRef.current.pointForCoordinate({
                    latitude: cafe.latitude,
                    longitude: cafe.longitude,
                });

            setSelectedCafePoint(point);
        }
        catch (error)
        {
            console.error(
                'Error al calcular la posición del café seleccionado',
                error
            );
        }
    }

    useEffect(() => {
        if (
            !userLocation ||
            !mapRef.current ||
            isMapGestureActiveRef.current ||
            isExploringMapRef.current ||
            explorationCafes !== null ||
            showSearchAreaButton
        )
        {
            return;
        }

        programmaticMovementRef.current = true;

        mapRef.current.animateToRegion(
            {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            },
            350
        );
    }, [userLocation]);

    async function searchInThisArea()
    {
        if (!exploredRegion || explorationLoading)
        {
            return;
        }

        const requestId =
            ++explorationRequestIdRef.current;

        setExplorationLoading(true);
        setExplorationError(null);
        setShowSearchAreaButton(false);

        try
        {
            const nearbyCafes = await getNearbyCafes(
                exploredRegion.latitude,
                exploredRegion.longitude
            );

            if (requestId !== explorationRequestIdRef.current)
            {
                return;
            }

            setExplorationCafes(nearbyCafes);
            setSelectedCafeId(null);
            setSelectedCafePoint(null);

            listRef.current?.scrollToOffset({
                offset: 0,
                animated: false,
            });
        }
        catch (error)
        {
            console.error(
                'Error al buscar cafeterías en esta zona:',
                error
            );

            if (requestId === explorationRequestIdRef.current)
            {
                setExplorationError(
                    'No se pudieron buscar cafeterías en esta zona.'
                );

                setShowSearchAreaButton(true);
            }
        }
        finally
        {
            if (requestId === explorationRequestIdRef.current)
            {
                setExplorationLoading(false);
            }
        }
    }

    function returnToMyLocation()
    {
        isExploringMapRef.current = false;

        ++explorationRequestIdRef.current;

        setExplorationCafes(null);
        setExplorationError(null);
        setExplorationLoading(false);
        setShowSearchAreaButton(false);
        setExploredRegion(null);
        setSelectedCafeId(null);
        setSelectedCafePoint(null);

        listRef.current?.scrollToOffset({
            offset: 0,
            animated: false,
        });

        if (!userLocation || !mapRef.current)
        {
            return;
        }

        programmaticMovementRef.current = true;

        mapRef.current.animateToRegion(
            {
                latitude: userLocation.latitude,
                longitude: userLocation.longitude,
                latitudeDelta: 0.02,
                longitudeDelta: 0.02,
            },
            350
        );
    }

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

            {loading && !userLocation && (
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

            {!loading && error && !userLocation && (
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
                                    void refreshNearbyCafes();
                                }
                                else
                                {
                                    markWaitingForLocationSettings();
                                    void Linking.openSettings();
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

            {userLocation && (
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
                        onLayout={(event) => {
                            const { width, height } = event.nativeEvent.layout;

                            setMapSize({
                                width,
                                height,
                            });
                        }}
                        onPress={(event) => {
                            if (event.nativeEvent.action === 'marker-press') {
                                return;
                            }

                            setSelectedCafeId(null);
                            setSelectedCafePoint(null);
                        }}
                        onRegionChange={(_region, details) => {
                            setSelectedCafePoint(null);

                            if (details?.isGesture === true) {
                                isMapGestureActiveRef.current = true;
                            }
                        }}
                        onRegionChangeComplete={(
                            region,
                            details
                        ) => {
                            isMapGestureActiveRef.current = false;
                            setExploredRegion(region);

                            if (details?.isGesture === true)
                            {
                                programmaticMovementRef.current = false;
                            }
                            else if (programmaticMovementRef.current)
                            {
                                programmaticMovementRef.current = false;

                                if (selectedCafe)
                                {
                                    void updateSelectedCafePoint(selectedCafe);
                                }

                                return;
                            }

                            if (details?.isGesture === true)
                            {
                                isExploringMapRef.current = true;

                                ++explorationRequestIdRef.current;

                                setExplorationLoading(false);
                                setExplorationError(null);
                                setShowSearchAreaButton(true);
                            }

                            if (selectedCafe)
                            {
                                void updateSelectedCafePoint(selectedCafe);
                            }
                        }}
                    >
                        {sortedCafes.map((cafe) => (
                            <Marker
                                key={cafe.googlePlaceId}
                                image={
                                    selectedCafeId === cafe.googlePlaceId
                                        ? require('../../assets/cafe-marker-selected.png')
                                        : require('../../assets/cafe-marker.png')
                                }
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

                                    programmaticMovementRef.current = true;

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
                    <View
                        style={styles.mapControls}
                        pointerEvents="box-none"
                    >
                        {showSearchAreaButton && (
                            <TouchableOpacity
                                style={styles.searchAreaButton}
                                onPress={() => {
                                    void searchInThisArea();
                                }}
                                disabled={explorationLoading}
                            >
                                <Text style={styles.searchAreaButtonText}>
                                    Buscar en esta zona
                                </Text>
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.recenterButton}
                            onPress={returnToMyLocation}
                            accessibilityLabel="Volver a mi ubicación"
                        >
                            <Text style={styles.recenterButtonText}>
                                🎯
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {explorationLoading && (
                        <View style={styles.explorationStatus}>
                            <ActivityIndicator
                                size="small"
                                color="#6B3A22"
                            />
                            <Text>Buscando cafeterías...</Text>
                        </View>
                    )}

                    {explorationError && (
                        <Text style={styles.explorationError}>
                            {explorationError}
                        </Text>
                    )}
                    {selectedCafe && selectedCardPosition && (
                        <TouchableOpacity
                            style={[
                                styles.selectedCafeCard,
                                {
                                    left: selectedCardPosition.left,
                                    top: selectedCardPosition.top,
                                },
                            ]}
                            activeOpacity={0.85}
                            onPress={() => {
                                navigation.navigate(
                                    'CafeDetail',
                                    {
                                        googlePlaceId:
                                            selectedCafe.googlePlaceId,
                                    }
                                );
                            }}
                        >
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

                            <View style={styles.selectedCafeArrow} />
                        </TouchableOpacity>
                    )}
                    <View style={styles.listContainer}>
                        <Text style={styles.listTitle}>
                            {explorationCafes !== null
                                ? 'Cafeterías de esta zona'
                                : 'Cafeterías cercanas'}
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

                                        programmaticMovementRef.current = true;

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
        width: 240,
        zIndex: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 10,
        paddingHorizontal: 14,
        paddingVertical: 10,
        borderWidth: 1,
        borderColor: '#E8D9C7',
        elevation: 5,
        transform: [
            { translateX: -120 },
            { translateY: -135 },
        ],
    },

    selectedCafeArrow: {
        position: 'absolute',
        bottom: -9,
        left: 110,
        width: 18,
        height: 18,
        backgroundColor: '#FFFFFF',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E8D9C7',
        transform: [
            { rotate: '45deg' },
        ],
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

    mapControls: {
        position: 'absolute',
        top: 12,
        left: 12,
        right: 12,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20,
    },

    searchAreaButton: {
        backgroundColor: '#FFFFFF',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E8D9C7',
        elevation: 4,
    },

    searchAreaButtonText: {
        color: '#4A2416',
        fontWeight: '700',
        fontSize: 14,
    },

    recenterButton: {
        marginLeft: 'auto',
        backgroundColor: '#FFFFFF',
        width: 46,
        height: 46,
        borderRadius: 23,
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 4,
    },

    recenterButtonText: {
        fontSize: 23,
    },

    explorationStatus: {
        position: 'absolute',
        top: 70,
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        padding: 12,
        borderRadius: 12,
        zIndex: 15,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    explorationError: {
        position: 'absolute',
        top: 70,
        alignSelf: 'center',
        backgroundColor: '#FFFFFF',
        color: '#A13D32',
        padding: 12,
        borderRadius: 12,
        zIndex: 15,
    },
});
