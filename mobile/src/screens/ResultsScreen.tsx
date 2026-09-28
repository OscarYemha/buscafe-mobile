import { useEffect, useRef, useState } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity,View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { NativeStackScreenProps } from "@react-navigation/native-stack";
import { RootStackParamlist } from "../navigation/AppNavigator";
import { cafeIntents } from "../data/cafeIntents";
import { getNearbyCafes } from "../services/api";
import { CafeSummary } from "../types/CafeSummary";
import NearbyCafeCard from "../components/NearbyCafeCard";
import { useAuth } from "../context/AuthContext";
import { useFavorites } from "../context/FavoritesContext";

type Props = NativeStackScreenProps<RootStackParamlist, 'Results'>;

export default function ResultsScreen({ route, navigation }: Props) {
    const {
        intent,
        latitude,
        longitude,
    } = route.params;

    const scrollViewRef = useRef<ScrollView>(null);

    const { isAuthenticated } = useAuth();

    const { isFavorite, toggleFavorite } = useFavorites();

    const [cafes, setCafes] = useState<CafeSummary[]>([]);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);
    const [showScrollTop, setShowScrollTop] = useState(false);

    useEffect(() => {
        async function loadNearbyCafes() 
        {
            try
            {
                setLoading(true);
                setError(null);

                const nearbyCafes = await getNearbyCafes(
                    latitude,
                    longitude,
                    intent
                );

                setCafes(nearbyCafes);
            }
            catch (error)
            {
                console.error('Error al obtener las cafeterías cercanas: ', error);

                setError('No se pudieron cargar las cafeterías');
            }
            finally
            {
                setLoading(false);
            }
        }

        loadNearbyCafes();
    }, [latitude, longitude, intent]);

    const handleFavoritePress = async (
        cafe: CafeSummary
    ) => {
        if (!isAuthenticated)
        {
            navigation.navigate('Login');
            return;
        }

        try
        {
            await toggleFavorite(cafe);
        }
        catch (error)
        {
            console.error('Error al actualizar favorito', error);
        }
    };

    const intentOption = intent
        ? cafeIntents.find(
        (option) => option.id === intent
    )
    : undefined;

    const title = intentOption
        ? `Cafés para ${intentOption.description}`
        : 'Cafés cerca de vos';

    return (
        <SafeAreaView style={styles.container}>
            <View>
                <Text style={styles.title}>{title}</Text>
                <Text style={styles.subtitle}>
                    Encontrá la cafetería ideal para tu momento.
                </Text>
            </View>
            <ScrollView
                ref={scrollViewRef}
                contentContainerStyle={styles.list}
                showsVerticalScrollIndicator={false}
                onScroll={(event) => {
                    const offsetY =
                        event.nativeEvent.contentOffset.y;

                    setShowScrollTop(offsetY > 500);
                }}
                scrollEventThrottle={16}
                >
                {loading && (
                    <Text style={styles.message}>
                        Buscando cafeterías...
                    </Text>
                )}

                {error && (
                    <Text style={styles.error}>
                        {error}
                    </Text>
                )}

                {!loading && !error && cafes.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyTitle}>
                            Todavía no encontramos cafeterías
                        </Text>

                        <Text style={styles.emptyText}>
                            Aún no hay suficientes datos para recomendarte
                            cafeterías ideales para {intentOption?.description}.
                        </Text>
                    </View>
                )}

                {!loading && !error && cafes.map((cafe) => (
                    <NearbyCafeCard
                        key={cafe.googlePlaceId}
                        cafe={cafe}
                        isFavorite={isFavorite(cafe.googlePlaceId)}
                        onFavoritePress={() => {
                            handleFavoritePress(cafe);
                        }}
                        onPress={() => {
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
        paddingHorizontal: 20,
    },

    title: {
        marginTop: 20,
        fontSize: 28,
        fontWeight: '700',
        color: '#4A4216',
    },

    subtitle: {
        marginTop: 8,
        fontSize: 16,
        color: '#7A6254',
    },

    list: {
        gap: 14,
        paddingTop: 20,
        paddingBottom: 30,
    },

    message: {
        fontSize: 16,
        color: '#7A6254',
    },

    error: {
        fontSize: 16,
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
});