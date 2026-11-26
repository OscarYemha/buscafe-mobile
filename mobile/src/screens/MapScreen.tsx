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
import MapView, { Callout, MapMarker, Marker, Region } from 'react-native-maps';
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


const CARD_WIDTH = 252;

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
 * La tarjeta del café seleccionado es el Callout nativo del pin: la dibuja
 * Google Maps, así que queda anclada al pin al arrastrar, hacer zoom o
 * centrar (antes era una vista flotante que se reacomodaba con retraso).
 *
 * Al seleccionar un café el mapa se centra en él con el pin un poco por
 * debajo del centro, para dejar lugar a la tarjeta. Si se está lejos hace
 * un zoom suave hasta SELECTED_CAFE_DELTA; si ya se está cerca, solo centra.
 */
const SELECTED_CAFE_DELTA = 0.01;
const SELECTED_PIN_OFFSET = 0.15; // fracción de la altura bajo el centro
const SELECT_ANIMATION_MS = 400;
const CALLOUT_OPEN_DELAY_MS = 120;
const REFOCUS_RECENTER_DELAY_MS = 250;

const RECENTER_BUTTON_SIZE = 46;
const RECENTER_BUTTON_MARGIN = 16;

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

    // "Abiertos ahora": muestra solo los cafés que Google marca como abiertos
    // (los sin horario conocido también se ocultan).
    const [showOnlyOpen, setShowOnlyOpen] = useState(false);

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
    const [mapSize, setMapSize] = useState({ width: 0, height: 0 });

    // Para abrir la tarjeta (Callout) del pin seleccionado desde el código.
    const markerRefs = useRef<Record<string, MapMarker | null>>({});
    const selectedCafeIdRef = useRef<string | null>(null);
    selectedCafeIdRef.current = selectedCafeId;

    function showSelectedCallout(cafeId: string | null)
    {
        if (!cafeId)
        {
            return;
        }

        // Solo para selecciones que no vienen de tocar el pin (lista, volver
        // del detalle): al tocar el pin, Google abre la tarjeta solo. Un único
        // pedido: cada showCallout redibuja la tarjeta y repetirlo parpadeaba.
        setTimeout(() =>
        {
            if (selectedCafeIdRef.current === cafeId)
            {
                markerRefs.current[cafeId]?.showCallout();
            }
        }, CALLOUT_OPEN_DELAY_MS);
    }

    function focusCafe(cafe: CafeSummary)
    {
        const currentDelta =
            currentRegionRef.current?.latitudeDelta ?? SELECTED_CAFE_DELTA;
        const delta = Math.min(currentDelta, SELECTED_CAFE_DELTA);

        programmaticMovementRef.current = true;

        mapRef.current?.animateToRegion(
            {
                latitude: cafe.latitude + delta * SELECTED_PIN_OFFSET,
                longitude: cafe.longitude,
                latitudeDelta: delta,
                longitudeDelta: delta,
            },
            SELECT_ANIMATION_MS
        );
    }

    /*
     * Al salir del mapa se limpia la selección (por ejemplo, al cambiar de
     * pestaña), salvo que se haya ido al detalle de un café: al volver, el
     * café sigue seleccionado y la lista en el mismo lugar.
     */
    // Café que estaba seleccionado al abrir su detalle: al volver se
    // restaura (y se reabre su tarjeta), pase lo que pase en el medio.
    const returningFromDetailRef = useRef<string | null>(null);
    const returnToMyLocationRef = useRef<(animationMs?: number) => void>(() => undefined);
    const refocusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    function openCafeDetail(googlePlaceId: string)
    {
        returningFromDetailRef.current = googlePlaceId;
        navigation.navigate('CafeDetail', { googlePlaceId });
    }

    useFocusEffect(
        useCallback(() => {
            const restoredCafeId = returningFromDetailRef.current;

            if (restoredCafeId)
            {
                // Volviendo del detalle: mismo café seleccionado y su tarjeta.
                returningFromDetailRef.current = null;
                setSelectedCafeId(restoredCafeId);
                showSelectedCallout(restoredCafeId);
            }
            else
            {
                // Entrando desde otra pestaña: el mapa como la primera vez
                // (centrado en el usuario, sin selección ni zona explorada).
                // Después de la transición: con el mapa todavía oculto, Android
                // ignora el movimiento de cámara.
                refocusTimerRef.current = setTimeout(() =>
                {
                    refocusTimerRef.current = null;
                    returnToMyLocationRef.current(0);
                }, REFOCUS_RECENTER_DELAY_MS);
            }

            return () => {
                if (refocusTimerRef.current)
                {
                    clearTimeout(refocusTimerRef.current);
                    refocusTimerRef.current = null;
                }

                if (returningFromDetailRef.current)
                {
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

    const allCafes = explorationCafes ?? cafes;

    const displayedCafes = showOnlyOpen
        ? allCafes.filter((cafe) => cafe.isOpen === true)
        : allCafes;

    function toggleShowOnlyOpen()
    {
        const next = !showOnlyOpen;

        // Si el café seleccionado queda oculto, se deselecciona.
        if (next && selectedCafeId)
        {
            const selected = allCafes.find(
                (cafe) => cafe.googlePlaceId === selectedCafeId
            );

            if (selected?.isOpen !== true)
            {
                setSelectedCafeId(null);
            }
        }

        setShowOnlyOpen(next);
    }

    const selectedCafe = displayedCafes.find(
        cafe => cafe.googlePlaceId === selectedCafeId
    ) ?? null;

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

    function returnToMyLocation(animationMs = 350)
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
            animationMs
        );
    }

    // El efecto de foco se define antes que esta función: la usa por ref.
    returnToMyLocationRef.current = returnToMyLocation;

    function renderCafeCard(cafe: CafeSummary)
    {
        const status = getOpenStatus(cafe.isOpen);

        return (
            <View style={styles.calloutContainer}>
                <View style={styles.popupCard}>
                    <View style={styles.popupTitleRow}>
                        <Text style={styles.popupTitle} numberOfLines={2}>
                            {cafe.name}
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
                        {' '}{cafe.shortAddress}
                    </Text>
                    {status && (
                        <Text style={[styles.popupStatus, { color: status.color }]}>
                            ● {status.label}
                        </Text>
                    )}
                    <View style={styles.popupDivider} />
                    <View style={styles.popupRatingRow}>
                        <View style={styles.popupRatingColumn}>
                            <Text style={styles.popupRatingLabel}>Google</Text>
                            <Text style={styles.popupRatingValue}>
                                ★ {cafe.googleRating !== null
                                    ? cafe.googleRating.toFixed(1)
                                    : 'Sin valoraciones'}
                            </Text>
                        </View>
                        <View style={styles.popupRatingColumn}>
                            <Text style={styles.popupRatingLabel}>BusCafé</Text>
                            <Text style={styles.popupRatingValue}>
                                {cafe.buscafeRating !== null
                                    ? `★ ${cafe.buscafeRating.toFixed(1)}`
                                    : 'Sin valoraciones'}
                            </Text>
                        </View>
                        <Text style={styles.popupChevron}>›</Text>
                    </View>
                </View>
                <View style={styles.popupTail} />
            </View>
        );
    }

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
                        showsUserLocation={false}
                        showsMyLocationButton={false}
                        toolbarEnabled={false}
                        moveOnMarkerPress={false}
                        // Los +/- de Google irían abajo a la derecha, donde está
                        // el botón de recentrar. El zoom se hace con dos dedos.
                        zoomControlEnabled={false}
                        onPress={(event) => {
                            if (event.nativeEvent.action === 'marker-press') {
                                return;
                            }

                            setSelectedCafeId(null);
                        }}
                        onRegionChange={(region, details) =>
                        {
                            if (details?.isGesture === true)
                            {
                                isMapGestureActiveRef.current = true;
                                cancelSearchAreaButtonTimer();
                            }
                            currentRegionRef.current = region;
                        }}
                        onRegionChangeComplete={(
                            region,
                            details
                        ) => {
                            isMapGestureActiveRef.current = false;
                            currentRegionRef.current = region;
                            setExploredRegion(region);

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
                                    showSearchAreaButtonAfterDelay();
                                }
                                else
                                {
                                    hideSearchAreaButton();
                                }
                            }

                        }}
                    >

                    {/* Ubicación del usuario como pin propio: el puntito nativo de
                        Google se dibuja por encima de las tarjetas. */}
                    {userLocation && (
                        <Marker
                            coordinate={{
                                latitude: userLocation.latitude,
                                longitude: userLocation.longitude,
                            }}
                            anchor={{ x: 0.5, y: 0.5 }}
                            tappable={false}
                            zIndex={0}
                        >
                            <View style={styles.userDot}>
                                <View style={styles.userDotInner} />
                            </View>
                        </Marker>
                    )}

                    {sortedCafes.map((cafe) => (
                        <Marker
                            // Key estable: recrear el pin al seleccionarlo hacía
                            // parpadear la tarjeta. Cada pin tiene su tarjeta lista
                            // (abajo), así Google la abre en el acto al tocarlo.
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
                            ref={(marker) =>
                            {
                                markerRefs.current[cafe.googlePlaceId] = marker;
                            }}
                            onCalloutPress={() => openCafeDetail(cafe.googlePlaceId)}
                            onPress={() =>
                            {
                                const cafeId = cafe.googlePlaceId;

                                setSelectedCafeId(cafeId);
                                focusCafe(cafe);

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
                        >
                            <Callout tooltip>
                                {renderCafeCard(cafe)}
                            </Callout>
                        </Marker>
                    ))}

                    </MapView>

                    <View
                        style={styles.mapControls}
                        pointerEvents="box-none"
                    >
                        <TouchableOpacity
                            style={[
                                styles.openNowChip,
                                showOnlyOpen && styles.openNowChipActive,
                            ]}
                            onPress={toggleShowOnlyOpen}
                            accessibilityRole="switch"
                            accessibilityState={{ checked: showOnlyOpen }}
                            accessibilityLabel="Mostrar solo cafés abiertos ahora"
                        >
                            <Ionicons
                                name="time"
                                size={14}
                                color={showOnlyOpen ? '#FFFFFF' : '#6B3A22'}
                            />
                            <Text
                                style={[
                                    styles.openNowChipText,
                                    showOnlyOpen && styles.openNowChipTextActive,
                                ]}
                            >
                                Abiertos ahora
                            </Text>
                        </TouchableOpacity>

                    </View>

                    {/* Abajo a la derecha del mapa (no de la pantalla: la lista
                        está en el mismo contenedor), como en Google Maps. */}
                    {mapSize.height > 0 && (
                        <TouchableOpacity
                            style={[
                                styles.recenterButton,
                                {
                                    top: mapSize.height -
                                        RECENTER_BUTTON_SIZE -
                                        RECENTER_BUTTON_MARGIN,
                                },
                            ]}
                            onPress={() => returnToMyLocation()}
                            accessibilityLabel="Volver a mi ubicación"
                        >
                            <Ionicons name="locate" size={24} color="#6B3A22" />
                        </TouchableOpacity>
                    )}
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
                            ListEmptyComponent={
                                showOnlyOpen && allCafes.length > 0 ? (
                                    <Text style={styles.emptyListMessage}>
                                        No hay cafés abiertos en esta zona.
                                    </Text>
                                ) : null
                            }
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
                                        focusCafe(cafe);
                                        showSelectedCallout(cafe.googlePlaceId);
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

    userDot: {
        width: 20,
        height: 20,
        borderRadius: 10,
        backgroundColor: '#FFFFFF',
        alignItems: 'center',
        justifyContent: 'center',
        elevation: 3,
    },

    userDotInner: {
        width: 13,
        height: 13,
        borderRadius: 6.5,
        backgroundColor: '#4285F4',
    },

    calloutContainer: {
        width: CARD_WIDTH,
        alignItems: 'center',
        paddingBottom: 4,
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
        justifyContent: 'flex-end',
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

    openNowChip: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 5,
        paddingHorizontal: 11,
        paddingVertical: 7,
        borderRadius: 18,
        borderWidth: 1,
        borderColor: '#E8D9C7',
        backgroundColor: '#FFFFFF',
        elevation: 4,
    },

    openNowChipActive: {
        backgroundColor: '#6B3A22',
        borderColor: '#6B3A22',
    },

    openNowChipText: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B3A22',
    },

    openNowChipTextActive: {
        color: '#FFFFFF',
    },

    emptyListMessage: {
        padding: 20,
        textAlign: 'center',
        fontSize: 14,
        color: '#7A6254',
    },

    recenterButton: {
        position: 'absolute',
        right: 12,
        zIndex: 20,
        backgroundColor: '#FFFFFF',
        width: RECENTER_BUTTON_SIZE,
        height: RECENTER_BUTTON_SIZE,
        borderRadius: RECENTER_BUTTON_SIZE / 2,
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