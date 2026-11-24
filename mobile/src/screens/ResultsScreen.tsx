
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
    RefreshControl,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamlist } from '../navigation/AppNavigator';
import { cafeIntents } from '../data/cafeIntents';
import { getNearbyCafes } from '../services/api';
import { CafeSummary } from '../types/CafeSummary';
import NearbyCafeCard from '../components/NearbyCafeCard';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import CafeSortSelector from '../components/CafeSortSelector';
import { CafeSortOption, sortCafes } from '../utils/sortCafes';
import { Ionicons } from '@expo/vector-icons';
import { useStableSearchLocation } from '../context/SearchAreaContext';


type Props = NativeStackScreenProps<RootStackParamlist, 'Results'>;


export default function ResultsScreen({ route, navigation }: Props)
{
    const {
        intent,
        latitude: fixedLatitude,
        longitude: fixedLongitude,
    } = route.params;

    const searchLocation = useStableSearchLocation();

    // "Ver todos" de Home manda coordenadas fijas (GPS); las categorías
    // usan la zona activa (cerca de mí o la zona elegida).
    const followsSearchArea =
        fixedLatitude === undefined || fixedLongitude === undefined;

    const latitude = followsSearchArea
        ? searchLocation.coordinates?.latitude
        : fixedLatitude;

    const longitude = followsSearchArea
        ? searchLocation.coordinates?.longitude
        : fixedLongitude;

    const isWaitingForSearchArea =
        followsSearchArea && !searchLocation.isReady;


    const scrollViewRef = useRef<ScrollView>(null);
    const requestIdRef = useRef(0);
    const refreshingRef = useRef(false);
    const requestInProgressRef = useRef(false);

    const { isAuthenticated } = useAuth();
    const { isFavorite, toggleFavorite } = useFavorites();

    const [cafes, setCafes] = useState<CafeSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [refreshing, setRefreshing] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);
    const [sortBy, setSortBy] = useState<CafeSortOption>('distance');

    const loadNearbyCafes = useCallback(async (
        isRefreshing = false
    ) =>
    {
        if (isRefreshing && requestInProgressRef.current)
        {
            return;
        }

        if (isWaitingForSearchArea)
        {
            return;
        }

        if (latitude === undefined || longitude === undefined)
        {
            setCafes([]);
            setLoading(false);
            return;
        }

        const requestId = ++requestIdRef.current;

        requestInProgressRef.current = true;

        if (isRefreshing)
        {
            refreshingRef.current = true;
            setRefreshing(true);
        }
        else
        {
            setLoading(true);
            setRefreshing(false);
            refreshingRef.current = false;
        }

        setError(null);

        try
        {
            const nearbyCafes = await getNearbyCafes(
                latitude,
                longitude,
                intent
            );

            if (requestId !== requestIdRef.current)
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

            if (requestId === requestIdRef.current)
            {
                setError('No se pudieron actualizar las cafeterías.');
            }
        }
        finally
        {
            if (requestId === requestIdRef.current)
            {
                requestInProgressRef.current = false;
                refreshingRef.current = false;
                setRefreshing(false);
                setLoading(false);
            }
        }
    }, [latitude, longitude, intent, isWaitingForSearchArea]);

    useEffect(() =>
    {
        void loadNearbyCafes();

        return () =>
        {
            ++requestIdRef.current;
            requestInProgressRef.current = false;
            refreshingRef.current = false;
        };
    }, [loadNearbyCafes]);

    const handleRefresh = useCallback(() =>
    {
        void loadNearbyCafes(true);
    }, [loadNearbyCafes]);

    const handleFavoritePress = async (cafe: CafeSummary) =>
    {
        if (!isAuthenticated)
        {
            navigation.navigate('Login', {
                returnTo: 'previous',
            });

            return;
        }

        try
        {
            await toggleFavorite(cafe);
        }
        catch (error)
        {
            console.error('Error al actualizar favorito:', error);
        }
    };

    const intentOption = intent
        ? cafeIntents.find((option) => option.id === intent)
        : undefined;

    const title = intentOption
        ? `Cafés para ${intentOption.description}`
        : 'Cafés cerca de vos';

    const sortedCafes = useMemo(() =>
    {
        return sortCafes(cafes, sortBy);
    }, [cafes, sortBy]);

    return (
        <SafeAreaView
            style={styles.container}
            edges={['left', 'right', 'bottom']}
        >
            <View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                    Encontrá la cafetería ideal para tu momento.
                </Text>
                {followsSearchArea && (
                    <TouchableOpacity
                        style={styles.zoneBanner}
                        onPress={() => navigation.navigate('ChooseZone')}
                        accessibilityRole="button"
                        accessibilityLabel={`Buscando en ${searchLocation.label}. Cambiar zona`}
                    >
                        <Ionicons
                            name="location"
                            size={15}
                            color="#6B3A22"
                        />
                        <Text style={styles.zoneBannerText} numberOfLines={1}>
                            {searchLocation.label}
                        </Text>
                        <Text style={styles.zoneBannerAction}>Cambiar zona</Text>
                    </TouchableOpacity>
                )}

            </View>

            <View style={styles.sortContainer}>
                <CafeSortSelector
                    value={sortBy}
                    onChange={setSortBy}
                />
            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.scrollView}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                refreshControl={
                    <RefreshControl
                        refreshing={refreshing}
                        onRefresh={handleRefresh}
                        colors={['#6B3A22']}
                        tintColor="#6B3A22"
                    />
                }
                onScroll={(event) =>
                {
                    const offsetY =
                        event.nativeEvent.contentOffset.y;

                    setShowScrollTop(offsetY > 500);
                }}
                scrollEventThrottle={16}
            >
                {latitude === undefined && !isWaitingForSearchArea && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyTitle}>¿Dónde buscamos?</Text>
                        <Text style={styles.emptyText}>
                            Activá la ubicación o elegí una zona para ver cafeterías.
                        </Text>
                        <TouchableOpacity
                            style={styles.chooseZoneButton}
                            onPress={() => navigation.navigate('ChooseZone')}
                        >
                            <Text style={styles.chooseZoneButtonText}>Elegir zona</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {loading && cafes.length === 0 && (
                    <Text style={styles.message}>
                        Buscando cafeterías...
                    </Text>
                )}

                {error && (
                    <TouchableOpacity
                        style={styles.errorContainer}
                        onPress={handleRefresh}
                    >
                        <Text style={styles.error}>
                            {error} Tocá para reintentar.
                        </Text>
                    </TouchableOpacity>
                )}

                {!loading && !error && cafes.length === 0 && latitude !== undefined && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyTitle}>
                            Todavía no encontramos cafeterías
                        </Text>

                        <Text style={styles.emptyText}>
                            {intentOption
                                ? `Aún no hay suficientes datos para recomendarte cafeterías ideales para ${intentOption.description}.`
                                : 'No encontramos cafeterías cercanas en esta zona.'}
                        </Text>
                    </View>
                )}

                {sortedCafes.map((cafe) => (
                    <NearbyCafeCard
                        key={cafe.googlePlaceId}
                        cafe={cafe}
                        isFavorite={isFavorite(cafe.googlePlaceId)}
                        onFavoritePress={() =>
                        {
                            void handleFavoritePress(cafe);
                        }}
                        onPress={() =>
                        {
                            navigation.navigate('CafeDetail', {
                                googlePlaceId: cafe.googlePlaceId,
                            });
                        }}
                    />
                ))}
            </ScrollView>

            {showScrollTop && (
                <TouchableOpacity
                    style={styles.scrollTopButton}
                    onPress={() =>
                    {
                        scrollViewRef.current?.scrollTo({
                            y: 0,
                            animated: true,
                        });
                    }}
                >
                    <Text style={styles.scrollTopButtonText}>
                        ↑ Ir arriba
                    </Text>
                </TouchableOpacity>
            )}
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F1E7',
        paddingHorizontal: 20,
    },

    title: {
        marginTop: 20,
        fontSize: 28,
        fontWeight: '700',
        color: '#4A2416',
    },

    subtitle: {
        marginTop: 8,
        fontSize: 16,
        color: '#7A6254',
    },

    sortContainer: {
        marginTop: 20,
    },

    scrollView: {
        flex: 1,
    },

    list: {
        flexGrow: 1,
        gap: 14,
        paddingTop: 20,
        paddingBottom: 30,
    },

    message: {
        fontSize: 16,
        color: '#7A6254',
    },

    errorContainer: {
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#FCE8E6',
    },

    error: {
        fontSize: 14,
        color: '#A13D32',
    },

    emptyContainer: {
        marginTop: 40,
        alignItems: 'center',
        paddingHorizontal: 20,
    },

    emptyTitle: {
        fontSize: 18,
        fontWeight: '600',
        color: '#4A2416',
        textAlign: 'center',
    },

    emptyText: {
        marginTop: 8,
        fontSize: 15,
        color: '#7A6254',
        textAlign: 'center',
        lineHeight: 21,
    },

    scrollTopButton: {
        position: 'absolute',
        right: 20,
        bottom: 70,
        backgroundColor: '#6B3A22',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 24,
        elevation: 4,
    },

    scrollTopButtonText: {
        color: '#FFFFFF',
        fontSize: 14,
        fontWeight: '600',
    },

    sortStar: {
        color: '#6B3A22',
        fontSize: 17,
    },

    sortStarActive: {
        color: '#F8E6CF',
        fontSize: 17,
    },

    zoneBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginTop: 12,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
        borderColor: '#E8D9C7',
        backgroundColor: '#FFFFFF',
    },

    zoneBannerText: {
        flex: 1,
        fontSize: 14,
        color: '#4A2416',
    },

    zoneBannerAction: {
        fontSize: 14,
        fontWeight: '700',
        color: '#6B3A22',
    },

    chooseZoneButton: {
        marginTop: 16,
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 12,
        backgroundColor: '#6B3A22',
    },

    chooseZoneButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },

});
