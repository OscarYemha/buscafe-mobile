import {
    ActivityIndicator,
    FlatList,
    Linking,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { formatDistance } from '../utils/distance';
import { Ionicons } from '@expo/vector-icons';
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
import { getOpenStatus } from '../utils/openStatus';


type MapPoint = { x: number; y: number };

const CARD_WIDTH = 252;
const PIN_VERTICAL_OFFSET = 36;

/*
 * "Buscar en esta zona": aparece si el mapa se movió al menos un 30 % de
 * la pantalla o cambió el zoom un 35 %, y recién cuando quedó quieto
 * 700 ms (si se vuelve a mover antes, se cancela). Con menos, aparecía
 * con cualquier desplazamiento chico.
 */
const SEARCH_AREA_MIN_MOVEMENT = 0.30;
const SEARCH_AREA_MIN_ZOOM_CHANGE = 0.35;
const SEARCH_AREA_BUTTON_DELAY_MS = 700;

/*
 * Al seleccionar un café el mapa se centra con el pin más abajo (a un 70 %
 * de la altura), para dejar lugar arriba a la tarjeta. Si igual no entra
 * arriba, la tarjeta se muestra debajo del pin en vez de ocultarse.
 */
const SELECTED_CAFE_DELTA = 0.01;
const SELECTED_PIN_OFFSET = 0.2; // fracción de la altura bajo el centro
const POPUP_EDGE_MARGIN = 12;
const POPUP_BELOW_GAP = 10;

// Proyección de Mercator para acompañar el gesto sin esperar al puente nativo.
function mercatorY(latitude: number): number
{
    const lat = Math.max(-85.05112878, Math.min(85.05112878, latitude));
    const radians = lat * Math.PI / 180;
    return Math.log(Math.tan(Math.PI / 4 + radians / 2));
}

function projectCafe(
    latitude: number,
    longitude: number,
    region: Region,
    width: number,
    height: number
): MapPoint
{
    // Maneja el cruce del meridiano 180.
    const diffLongitude = ((longitude - region.longitude + 540) % 360) - 180;
    const top = mercatorY(region.latitude + region.latitudeDelta / 2);
    const bottom = mercatorY(region.latitude - region.latitudeDelta / 2);
    const spanY = top - bottom;
    return {
        x: width / 2 + (diffLongitude / region.longitudeDelta) * width,
        y: spanY === 0 ? height / 2 :
            (top - mercatorY(latitude)) / spanY * height,
    };
}

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
        locationServicesDisabled,
        enableLocationServices,
    } = useNearbyCafes();

    const [selectedCafeId, setSelectedCafeId] = useState<string | null>(null);
    const [exploredRegion, setExploredRegion] = useState<Region | null>(null);
    const [showSearchAreaButton, setShowSearchAreaButton] = useState(false);

    const searchAreaTimerRef =
        useRef<ReturnType<typeof setTimeout> | null>(null);

    function cancelSearchAreaButtonTimer()
    {
        if (searchAreaTimerRef.current)
        {
            clearTimeout(searchAreaTimerRef.current);
            searchAreaTimerRef.current = null;
        }
    }

    function hideSearchAreaButton()
    {
        cancelSearchAreaButtonTimer();
        setShowSearchAreaButton(false);
    }

    function showSearchAreaButtonAfterDelay()
    {
        cancelSearchAreaButtonTimer();

        searchAreaTimerRef.current = setTimeout(() =>
        {
            searchAreaTimerRef.current = null;
            setShowSearchAreaButton(true);
        }, SEARCH_AREA_BUTTON_DELAY_MS);
    }

    // Que no quede un timer vivo al salir de la pantalla.
    useEffect(() => cancelSearchAreaButtonTimer, []);
    const [explorationCafes, setExplorationCafes] = useState<CafeSummary[] | null>(null);
    const [explorationLoading, setExplorationLoading] = useState(false);
    const [explorationError, setExplorationError] = useState<string | null>(null);

    const mapRef = useRef<MapView>(null);
    const listRef = useRef<FlatList<CafeSummary>>(null);
    const programmaticMovementRef = useRef(false);
    const isMapGestureActiveRef = useRef(false);
    const isExploringMapRef = useRef(false);
    const explorationRequestIdRef = useRef(0);
    const currentRegionRef = useRef<Region | null>(null);
    const searchReferenceRegionRef = useRef<Region | null>(null);
    const projectionEpochRef = useRef(0);
    const lastPopupUpdateRef = useRef(0);
    const [mapSize, setMapSize] = useState({ width: 0, height: 0 });
    const [popupHeight, setPopupHeight] = useState(0);
    const [popupPoint, setPopupPoint] = useState<(MapPoint & { id: string }) | null>(null);

    /*
     * Al salir del mapa se limpia la selección (por ejemplo, al cambiar de
     * pestaña), salvo que se haya ido al detalle de un café: al volver, el
     * café sigue seleccionado y la lista en el mismo lugar.
     */
    const keepSelectionOnBlurRef = useRef(false);

    function openCafeDetail(googlePlaceId: string)
    {
        keepSelectionOnBlurRef.current = true;
        navigation.navigate('CafeDetail', { googlePlaceId });
    }

    useFocusEffect(
        useCallback(() => {
            return () => {
                if (keepSelectionOnBlurRef.current)
                {
                    keepSelectionOnBlurRef.current = false;
                    return;
                }

                setSelectedCafeId(null);

                listRef.current?.scrollToOffset({
                    offset: 0,
                    animated: false,
                });
            };
        }, [])
    );

    const displayedCafes = explorationCafes ?? cafes;

    const selectedCafe = displayedCafes.find(
        cafe => cafe.googlePlaceId === selectedCafeId
    ) ?? null;

    const selectedCafeStatus = selectedCafe
        ? getOpenStatus(selectedCafe.isOpen)
        : null;

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

    function hasSignificantMapMovement(
        reference: Region,
        current: Region
    ): boolean {
        const latitudeMovement =
            Math.abs(current.latitude - reference.latitude) /
            reference.latitudeDelta;

        const longitudeDifference =
            Math.abs(current.longitude - reference.longitude);

        const longitudeMovement =
            Math.min(
                longitudeDifference,
                360 - longitudeDifference
            ) / reference.longitudeDelta;

        // Solo cuenta alejarse (ver más área). Acercarse no muestra lugares
        // nuevos: lo que se ve ya está cubierto por la búsqueda.
        const zoomOut = Math.max(
            current.latitudeDelta / reference.latitudeDelta - 1,
            current.longitudeDelta / reference.longitudeDelta - 1
        );

        return (
            latitudeMovement >= SEARCH_AREA_MIN_MOVEMENT ||
            longitudeMovement >= SEARCH_AREA_MIN_MOVEMENT ||
            zoomOut >= SEARCH_AREA_MIN_ZOOM_CHANGE
        );
    }

    // Calculamos solo la posición de la cafetería seleccionada.
    // Al terminar el gesto, corregimos usando la proyección real de Google Maps.
    function updatePopupPosition(region: Region, cafe: CafeSummary | null)
    {
        currentRegionRef.current = region;
        ++projectionEpochRef.current;
        if (!cafe || !mapSize.width || !mapSize.height)
        {
            setPopupPoint(null);
            return;
        }
        const point = projectCafe(
            cafe.latitude, cafe.longitude,
            region, mapSize.width, mapSize.height
        );
        setPopupPoint({ ...point, id: cafe.googlePlaceId });
    }

    function syncPopupWithNativeMap(cafe: CafeSummary | null)
    {
        if (!cafe || !mapRef.current)
        {
            return;
        }
        const epoch = ++projectionEpochRef.current;
        void mapRef.current.pointForCoordinate({
            latitude: cafe.latitude,
            longitude: cafe.longitude,
        }).then(point => {
            if (projectionEpochRef.current !== epoch)
            {
                return;
            }
            setPopupPoint({ ...point, id: cafe.googlePlaceId });
        }).catch(error => {
            console.warn('No se pudo proyectar el pin seleccionado:', error);
        });
    }

    useEffect(() => {
        if (currentRegionRef.current)
        {
            updatePopupPosition(currentRegionRef.current, selectedCafe);
        }
        else
        {
            setPopupPoint(null);
        }
    }, [selectedCafeId, mapSize.width, mapSize.height]);

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
        hideSearchAreaButton();

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
            setPopupPoint(null);

            searchReferenceRegionRef.current = exploredRegion;

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
        hideSearchAreaButton();
        setExploredRegion(null);
        setSelectedCafeId(null);

        listRef.current?.scrollToOffset({
            offset: 0,
            animated: false,
        });

        if (!userLocation || !mapRef.current)
        {
            return;
        }

        searchReferenceRegionRef.current = {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        };

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

    const popupFitsAbove =
        popupPoint !== null &&
        popupPoint.y - PIN_VERTICAL_OFFSET - popupHeight >= POPUP_EDGE_MARGIN;

    const popupFitsBelow =
        popupPoint !== null &&
        popupPoint.y + POPUP_BELOW_GAP + popupHeight <=
            mapSize.height - POPUP_EDGE_MARGIN;

    const popupPlacement: 'above' | 'below' =
        popupFitsAbove ? 'above' : 'below';

    const isPopupVisible =
        selectedCafe !== null &&
        popupPoint !== null &&
        popupPoint.id === selectedCafe.googlePlaceId &&
        popupHeight > 0 &&
        popupPoint.x >= 0 &&
        popupPoint.x <= mapSize.width &&
        popupPoint.y <= mapSize.height &&
        (popupFitsAbove || popupFitsBelow);

    useEffect(() => {
        if (!userLocation || searchReferenceRegionRef.current) {
            return;
        }

        searchReferenceRegionRef.current = {
            latitude: userLocation.latitude,
            longitude: userLocation.longitude,
            latitudeDelta: 0.02,
            longitudeDelta: 0.02,
        };
    }, [userLocation]);

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
                                if (locationServicesDisabled)
                                {
                                    void enableLocationServices();
                                }
                                else if (canAskLocationAgain)
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
                                <Ionicons
                                    name={
                                        locationServicesDisabled || canAskLocationAgain
                                            ? 'location'
                                            : 'settings'
                                    }
                                    size={16}
                                    color="#FFFFFF"
                                />
                                {'  '}
                                {locationServicesDisabled
                                    ? 'Activar ubicación'
                                    : canAskLocationAgain
                                        ? 'Usar mi ubicación'
                                        : 'Abrir ajustes'}
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
                        onLayout={event => {
                            const { width, height } = event.nativeEvent.layout;
                            setMapSize({ width, height });
                        }}
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
                        showsMyLocationButton={false}
                        toolbarEnabled={false}
                        onPress={(event) => {
                            if (event.nativeEvent.action === 'marker-press') {
                                return;
                            }

                            setSelectedCafeId(null);
                            setPopupPoint(null);
                        }}
                        onRegionChange={(region, details) =>
                        {
                            if (details?.isGesture === true)
                            {
                                isMapGestureActiveRef.current = true;
                                cancelSearchAreaButtonTimer();
                            }
                            currentRegionRef.current = region;
                            // Máximo ~30 actualizaciones/segundo durante el gesto.
                            const now = Date.now();
                            if (now - lastPopupUpdateRef.current >= 33)
                            {
                                lastPopupUpdateRef.current = now;
                                updatePopupPosition(region, selectedCafe);
                            }
                        }}
                        onRegionChangeComplete={(
                            region,
                            details
                        ) => {
                            isMapGestureActiveRef.current = false;
                            setExploredRegion(region);
                            updatePopupPosition(region, selectedCafe);
                            syncPopupWithNativeMap(selectedCafe);

                            if (details?.isGesture === true)
                            {
                                programmaticMovementRef.current = false;
                            }
                            else if (programmaticMovementRef.current)
                            {
                                programmaticMovementRef.current = false;

                                return;
                            }

                            if (details?.isGesture === true)
                            {
                                const reference = searchReferenceRegionRef.current;

                                if (!reference)
                                {
                                    searchReferenceRegionRef.current = region;
                                    return;
                                }

                                const movedEnough =
                                    hasSignificantMapMovement(reference, region);

                                if (movedEnough)
                                {
                                    isExploringMapRef.current = true;

                                    ++explorationRequestIdRef.current;

                                    setExplorationLoading(false);
                                    setExplorationError(null);

                                    setSelectedCafeId(null);
                                    setPopupPoint(null);
                                    showSearchAreaButtonAfterDelay();
                                }
                                else
                                {
                                    hideSearchAreaButton();
                                }
                            }

                        }}
                    >

                    {sortedCafes.map((cafe) => (
                        <Marker
                            // La key cambia con la selección para recrear el
                            // marcador: en Android, Google Maps no aplica un
                            // zIndex nuevo a un marcador ya dibujado, y el pin
                            // elegido desde la lista quedaba debajo del resto.
                            key={
                                selectedCafeId === cafe.googlePlaceId
                                    ? `${cafe.googlePlaceId}-selected`
                                    : cafe.googlePlaceId
                            }
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
                            onPress={() =>
                            {
                                const cafeId = cafe.googlePlaceId;

                                setSelectedCafeId(cafeId);
                                if (currentRegionRef.current)
                                {
                                    updatePopupPosition(currentRegionRef.current, cafe);
                                }
                                programmaticMovementRef.current = true;

                                mapRef.current?.animateToRegion(
                                    {
                                        latitude: cafe.latitude +
                                            SELECTED_CAFE_DELTA * SELECTED_PIN_OFFSET,
                                        longitude: cafe.longitude,
                                        latitudeDelta: SELECTED_CAFE_DELTA,
                                        longitudeDelta: 0.01,
                                    },
                                    350
                                );

                                requestAnimationFrame(() =>
                                {
                                    const currentIndex = sortedCafes.findIndex(
                                        (item) =>
                                            item.googlePlaceId === cafeId
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

                    {selectedCafe && popupPoint?.id === selectedCafe.googlePlaceId &&
                        popupPoint.x >= 0 && popupPoint.x <= mapSize.width &&
                        popupPoint.y >= 0 && popupPoint.y <= mapSize.height && (
                        <View
                            pointerEvents={isPopupVisible ? 'box-none' : 'none'}
                            style={[
                                styles.popupAnchor,
                                {
                                    left: popupPoint.x - CARD_WIDTH / 2,
                                    ...(popupPlacement === 'above'
                                        ? {
                                            top: popupPoint.y - PIN_VERTICAL_OFFSET,
                                            transform: [{ translateY: -popupHeight }],
                                        }
                                        : {
                                            top: popupPoint.y + POPUP_BELOW_GAP,
                                        }),
                                    opacity: isPopupVisible ? 1 : 0,
                                },
                            ]}
                            onLayout={event => {
                                const height = event.nativeEvent.layout.height;
                                if (Math.abs(height - popupHeight) > 1)
                                {
                                    setPopupHeight(height);
                                }
                            }}
                        >
                            {popupPlacement === 'below' && (
                                <View style={styles.popupTailUp} />
                            )}
                            <TouchableOpacity
                                activeOpacity={0.9}
                                accessibilityRole="button"
                                accessibilityLabel={`Ver detalles de ${selectedCafe.name}`}
                                style={styles.popupCard}
                                onPress={() => openCafeDetail(selectedCafe.googlePlaceId)}
                            >
                                <View style={styles.popupTitleRow}>
                                    <Text style={styles.popupTitle} numberOfLines={2}>
                                        {selectedCafe.name}
                                    </Text>
                                    <Ionicons
                                        name="cafe"
                                        size={18}
                                        color="#6B3A22"
                                        style={styles.popupCoffee}
                                    />
                                </View>
                                <Text style={styles.popupAddress} numberOfLines={1}>
                                    <Ionicons name="location" size={12} color="#7A6254" />
                                    {' '}{selectedCafe.shortAddress}
                                </Text>
                                {selectedCafeStatus && (
                                    <Text
                                        style={[
                                            styles.popupStatus,
                                            { color: selectedCafeStatus.color },
                                        ]}
                                    >
                                        ● {selectedCafeStatus.label}
                                    </Text>
                                )}
                                <View style={styles.popupDivider} />
                                <View style={styles.popupRatingRow}>
                                    <View style={styles.popupRatingColumn}>
                                        <Text style={styles.popupRatingLabel}>Google</Text>
                                        <Text style={styles.popupRatingValue}>
                                            ★ {selectedCafe.googleRating !== null
                                                ? selectedCafe.googleRating.toFixed(1)
                                                : 'Sin valoraciones'}
                                        </Text>
                                    </View>
                                    <View style={styles.popupRatingColumn}>
                                        <Text style={styles.popupRatingLabel}>BusCafé</Text>
                                        <Text style={styles.popupRatingValue}>
                                            {selectedCafe.buscafeRating !== null
                                                ? `★ ${selectedCafe.buscafeRating.toFixed(1)}`
                                                : 'Sin valoraciones'}
                                        </Text>
                                    </View>
                                    <Text style={styles.popupChevron}>›</Text>
                                </View>
                            </TouchableOpacity>
                            {popupPlacement === 'above' && (
                                <View style={styles.popupTail} />
                            )}
                        </View>
                    )}

                    <View
                        style={styles.mapControls}
                        pointerEvents="box-none"
                    >
                        <TouchableOpacity
                            style={styles.recenterButton}
                            onPress={returnToMyLocation}
                            accessibilityLabel="Volver a mi ubicación"
                        >
                            <Ionicons name="locate" size={24} color="#6B3A22" />
                        </TouchableOpacity>
                    </View>
                    {showSearchAreaButton && !explorationLoading && !selectedCafe && (
                        <View
                            style={styles.searchAreaContainer}
                            pointerEvents="box-none"
                        >
                            <TouchableOpacity
                                style={styles.searchAreaButton}
                                onPress={() =>
                                {
                                    void searchInThisArea();
                                }}
                            >
                                <Text style={styles.searchAreaButtonText}>
                                    Buscar en esta zona
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
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
                                            openCafeDetail(cafe.googlePlaceId);

                                            return;
                                        }

                                        setSelectedCafeId(
                                            cafe.googlePlaceId
                                        );

                                        programmaticMovementRef.current = true;

                                        mapRef.current?.animateToRegion(
                                            {
                                                latitude: cafe.latitude +
                                                    SELECTED_CAFE_DELTA * SELECTED_PIN_OFFSET,
                                                longitude: cafe.longitude,
                                                latitudeDelta: SELECTED_CAFE_DELTA,
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
                                                : 'Sin valoraciones'}
                                            {'   ·   '}
                                            BusCafé ★{' '}
                                            {cafe.buscafeRating !== null
                                                ? cafe.buscafeRating.toFixed(1)
                                                : 'Sin valoraciones'}
                                        </Text>
                                    </View>

                                    <View style={styles.cafeSideInfo}>
                                        <Text style={styles.cafeDistance}>
                                            {cafe.distanceKm !== null
                                                ? formatDistance(cafe.distanceKm)
                                                : '—'}
                                        </Text>
                                        {(() => {
                                            const status = getOpenStatus(cafe.isOpen);

                                            return status && (
                                                <Text
                                                    style={[
                                                        styles.cafeStatus,
                                                        { color: status.color },
                                                    ]}
                                                >
                                                    {status.label}
                                                </Text>
                                            );
                                        })()}
                                    </View>
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

    popupAnchor: {
        position: 'absolute',
        width: CARD_WIDTH,
        alignItems: 'center',
        zIndex: 10,
        elevation: 10,
    },
    popupCard: {
        width: CARD_WIDTH,
        backgroundColor: '#FFFFFF',
        borderRadius: 15,
        borderWidth: 1,
        borderColor: '#E8D9C7',
        padding: 13,
        elevation: 5,
    },
    popupTitleRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },
    popupTitle: {
        flex: 1,
        fontWeight: '700',
        fontSize: 16,
        color: '#4A2416',
    },
    popupCoffee: { marginLeft: 8 },
    popupAddress: { marginTop: 5, color: '#7A6254', fontSize: 12 },
    popupStatus: { marginTop: 4, fontSize: 12, fontWeight: '700' },
    popupDivider: {
        height: 1,
        backgroundColor: '#E8D9C7',
        marginVertical: 10,
    },
    popupRatingRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    popupRatingColumn: { flex: 1 },
    popupRatingLabel: { fontSize: 11, color: '#7A6254' },
    popupRatingValue: {
        fontSize: 13,
        fontWeight: '600',
        color: '#4A2416',
        marginTop: 3,
    },
    popupChevron: { fontSize: 26, color: '#7A6254' },
    popupTail: {
        width: 12,
        height: 12,
        backgroundColor: '#FFFFFF',
        borderRightWidth: 1,
        borderBottomWidth: 1,
        borderColor: '#E8D9C7',
        transform: [{ rotate: '45deg' }],
        marginTop: -7,
    },
    popupTailUp: {
        width: 12,
        height: 12,
        backgroundColor: '#FFFFFF',
        borderLeftWidth: 1,
        borderTopWidth: 1,
        borderColor: '#E8D9C7',
        transform: [{ rotate: '45deg' }],
        marginBottom: -7,
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

    calloutContent: {
        width: 220,
        paddingHorizontal: 8,
        paddingVertical: 6,
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

    cafeSideInfo: {
        alignItems: 'flex-end',
        gap: 2,
    },

    cafeStatus: {
        fontSize: 12,
        fontWeight: '700',
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
        paddingHorizontal: 14,
        paddingVertical: 9,
        borderRadius: 24,
        borderWidth: 1,
        borderColor: '#E8D9C7',
        elevation: 4,
    },

    searchAreaButtonText: {
        color: '#4A2416',
        fontWeight: '700',
        fontSize: 13,
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

    searchAreaContainer: {
        position: 'absolute',
        top: 70,
        alignSelf: 'center',
        zIndex: 15,
    },
});