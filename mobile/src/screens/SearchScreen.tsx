import {
    useEffect,
    useRef,
    useState,
} from 'react';
import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    SafeAreaView,
    useSafeAreaInsets,
} from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import {
    NativeStackScreenProps,
} from '@react-navigation/native-stack';

import {
    RootStackParamlist,
} from '../navigation/AppNavigator';
import {
    searchCafes,
} from '../services/api';
import {
    getCurrentLocation,
    UserLocation,
} from '../services/location';
import {
    CafeSummary,
} from '../types/CafeSummary';
import NearbyCafeCard from '../components/NearbyCafeCard';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';

type Props =
    NativeStackScreenProps<
        RootStackParamlist,
        'Search'
    >;

export default function SearchScreen(
    { navigation }: Props
)
{
    const { isAuthenticated } = useAuth();
    const insets = useSafeAreaInsets();

    const {
        isFavorite,
        toggleFavorite,
    } = useFavorites();

    const [searchText, setSearchText] =
        useState('');

    const [searchResults, setSearchResults] =
        useState<CafeSummary[]>([]);

    const [searchLoading, setSearchLoading] =
        useState(false);

    const [searchError, setSearchError] =
        useState<string | null>(null);

    const [nextPageToken, setNextPageToken] =
        useState<string | null>(null);

    const [resolvedQuery, setResolvedQuery] =
        useState<string | null>(null);

    const [loadingMore, setLoadingMore] =
        useState(false);

    const [userLocation, setUserLocation] =
        useState<UserLocation | null>(null);

    const scrollViewRef =
    useRef<ScrollView>(null);

    const [showScrollTop, setShowScrollTop] =
        useState(false);

    useEffect(() => {
        async function loadLocation()
        {
            try
            {
                const result =
                    await getCurrentLocation();

                if (result.status === 'granted')
                {
                    setUserLocation(result.location);
                }
            }
            catch (error)
            {
                console.log(
                    'No se pudo obtener la ubicación para la búsqueda:',
                    error
                );
            }
        }

        loadLocation();
    }, []);

    useEffect(() => {
        const query = searchText.trim();

        if (query.length < 3)
        {
            setSearchResults([]);
            setNextPageToken(null);
            setResolvedQuery(null);
            setSearchLoading(false);
            setSearchError(null);

            return;
        }

        const timeoutId =
            setTimeout(async () => {
                try
                {
                    setSearchLoading(true);
                    setSearchError(null);

                    const result =
                        await searchCafes(
                            query,
                            undefined,
                            undefined,
                            userLocation?.latitude,
                            userLocation?.longitude,
                        );

                    setSearchResults(
                        [...result.cafes].sort(
                            (a, b) => {
                                if (
                                    a.distanceKm === null
                                )
                                {
                                    return 1;
                                }

                                if (
                                    b.distanceKm === null
                                )
                                {
                                    return -1;
                                }

                                return (
                                    a.distanceKm -
                                    b.distanceKm
                                );
                            }
                        )
                    );

                    setNextPageToken(
                        result.nextPageToken
                    );

                    setResolvedQuery(
                        result.resolvedQuery
                    );
                }
                catch (error)
                {
                    console.error(
                        'Error al buscar cafeterías:',
                        error
                    );

                    setSearchResults([]);
                    setNextPageToken(null);
                    setResolvedQuery(null);
                    setSearchError(
                        'No se pudieron buscar cafeterías.'
                    );
                }
                finally
                {
                    setSearchLoading(false);
                }
            }, 500);

        return () => {
            clearTimeout(timeoutId);
        };
    }, [searchText, userLocation]);

    async function loadMoreSearchResults()
    {
        const query = searchText.trim();

        if (
            !nextPageToken ||
            !resolvedQuery ||
            loadingMore
        )
        {
            return;
        }

        try
        {
            setLoadingMore(true);
            setSearchError(null);

            const result =
                await searchCafes(
                    query,
                    nextPageToken,
                    resolvedQuery,
                    userLocation?.latitude,
                    userLocation?.longitude,
                );

            setSearchResults(
                (currentResults) =>
                    [
                        ...currentResults,
                        ...result.cafes,
                    ].sort((a, b) => {
                        if (
                            a.distanceKm === null
                        )
                        {
                            return 1;
                        }

                        if (
                            b.distanceKm === null
                        )
                        {
                            return -1;
                        }

                        return (
                            a.distanceKm -
                            b.distanceKm
                        );
                    })
            );

            setNextPageToken(
                result.nextPageToken
            );

            setResolvedQuery(
                result.resolvedQuery
            );
        }
        catch (error)
        {
            console.error(
                'Error al cargar más cafeterías',
                error
            );

            setSearchError(
                'No se pudieron cargar más cafeterías'
            );
        }
        finally
        {
            setLoadingMore(false);
        }
    }

    async function handleFavoritePress(
        cafe: CafeSummary
    )
    {
        if (!isAuthenticated)
        {
            navigation.navigate('Login');
            return;
        }

        await toggleFavorite(cafe);
    }

    return (
        <SafeAreaView
            style={styles.container}
            edges={['top', 'left', 'right']}
        >
            <View style={styles.searchHeader}>
                <TouchableOpacity
                    style={styles.backButton}
                    onPress={() =>
                        navigation.goBack()
                    }
                    activeOpacity={0.7}
                >
                    <Ionicons
                        name="arrow-back"
                        size={24}
                        color="#6B3A22"
                    />
                </TouchableOpacity>

                <View style={styles.inputContainer}>
                    <Ionicons
                        name="search"
                        size={20}
                        color="#8C7A6B"
                    />

                    <TextInput
                        style={styles.input}
                        placeholder="Buscar zona o cafetería"
                        placeholderTextColor="#8C7A6B"
                        value={searchText}
                        onChangeText={setSearchText}
                        autoFocus
                        returnKeyType="search"
                    />

                    {searchText.length > 0 ? (
                        <TouchableOpacity
                            onPress={() =>
                                setSearchText('')
                            }
                            activeOpacity={0.7}
                        >
                            <Ionicons
                                name="close-circle"
                                size={20}
                                color="#8C7A6B"
                            />
                        </TouchableOpacity>
                    ) : (
                        <Image
                            source={require(
                                '../../assets/buscafe-symbol-transparent.png'
                            )}
                            style={
                                styles.searchCoffeeIcon
                            }
                        />
                    )}
                </View>
            </View>

            <ScrollView
                ref={scrollViewRef}
                style={styles.results}
                contentContainerStyle={[
                    styles.resultsContent,
                    {
                        paddingBottom: insets.bottom + 40,
                    },
                ]}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
                onScroll={(event) => {
                    const offsetY =
                        event.nativeEvent.contentOffset.y;

                    setShowScrollTop(offsetY > 500);
                }}
                scrollEventThrottle={16}
            >
                {searchText.trim().length < 3 && (
                    <Text style={styles.hint}>
                        Escribí al menos 3 caracteres para buscar.
                    </Text>
                )}

                {searchText.trim().length >= 3 && (
                    <Text style={styles.title}>
                        {`Resultados para "${searchText.trim()}"`}
                    </Text>
                )}

                {searchText.trim().length >= 3 &&
                    searchLoading && (
                        <Text style={styles.message}>
                            Buscando cafeterías...
                        </Text>
                    )}

                {searchText.trim().length >= 3 &&
                    searchError && (
                        <Text style={styles.error}>
                            {searchError}
                        </Text>
                    )}

                {searchText.trim().length >= 3 &&
                    !searchLoading &&
                    !searchError && (
                        <View
                            style={
                                styles.cafesContainer
                            }
                        >
                            {searchResults.length ===
                                0 && (
                                <Text
                                    style={
                                        styles.message
                                    }
                                >
                                    No se encontraron cafeterías para esta búsqueda.
                                </Text>
                            )}

                            {searchResults.map(
                                (cafe) => (
                                    <NearbyCafeCard
                                        key={
                                            cafe.googlePlaceId
                                        }
                                        cafe={cafe}
                                        isFavorite={isFavorite(
                                            cafe.googlePlaceId
                                        )}
                                        onFavoritePress={() => {
                                            handleFavoritePress(
                                                cafe
                                            );
                                        }}
                                        onPress={() => {
                                            navigation.navigate(
                                                'CafeDetail',
                                                {
                                                    googlePlaceId:
                                                        cafe.googlePlaceId,
                                                }
                                            );
                                        }}
                                    />
                                )
                            )}

                            {searchResults.length >
                                0 &&
                                nextPageToken && (
                                    <TouchableOpacity
                                        style={
                                            styles.showAllButton
                                        }
                                        onPress={
                                            loadMoreSearchResults
                                        }
                                        disabled={
                                            loadingMore
                                        }
                                    >
                                        <Text
                                            style={
                                                styles.showAllButtonText
                                            }
                                        >
                                            {loadingMore
                                                ? 'Cargando...'
                                                : 'Ver más'}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                        </View>
                    )}
            </ScrollView>
            {showScrollTop && (
                <TouchableOpacity
                    style={styles.scrollTopButton}
                    onPress={() => {
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
    },

    searchHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        backgroundColor: '#FFFDFC',
        borderBottomWidth: 1,
        borderBottomColor: '#E8D9C7',
    },

    backButton: {
        width: 42,
        height: 42,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 4,
    },

    inputContainer: {
        flex: 1,
        minHeight: 44,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        backgroundColor: '#F8F1E7',
        borderWidth: 1,
        borderColor: '#E2D4C3',
        borderRadius: 14,
    },

    input: {
        flex: 1,
        marginLeft: 8,
        paddingVertical: 10,
        fontSize: 16,
        color: '#4A2416',
    },

    searchCoffeeIcon: {
        width: 26,
        height: 26,
        marginLeft: 6,
        resizeMode: 'contain',
    },

    results: {
        flex: 1,
    },

    resultsContent: {
        padding: 20,
    },

    title: {
        marginBottom: 18,
        fontSize: 20,
        fontWeight: '700',
        color: '#4A2416',
    },

    hint: {
        fontSize: 15,
        color: '#7A6254',
    },

    cafesContainer: {
        gap: 14,
    },

    message: {
        fontSize: 16,
        color: '#7A6254',
    },

    error: {
        fontSize: 16,
        color: '#A13D32',
    },

    showAllButton: {
        alignSelf: 'center',
        marginTop: 16,
        paddingHorizontal: 18,
        paddingVertical: 10,
        backgroundColor: '#6B3A22',
        borderRadius: 12,
    },

    showAllButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },

    scrollTopButton: {
        position: 'absolute',
        right: 20,
        bottom: 85,
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
});