import {
    Linking,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import {
    useCallback,
    useState,
} from 'react';
import { useFocusEffect } from '@react-navigation/native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamlist } from '../navigation/AppNavigator';
import { getCafeDetails } from '../services/api';
import { CafeDetail } from '../types/CafeDetail';
import { priceLabels } from '../utils/price';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';

type Props = NativeStackScreenProps<RootStackParamlist, 'CafeDetail'>;

export default function CafeDetailScreen({ route, navigation }: Props) 
{
    const { googlePlaceId } = route.params;

    const { isAuthenticated } = useAuth();

    const { isFavorite, toggleFavorite } = useFavorites();

    const [cafe, setCafe] = useState<CafeDetail | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    useFocusEffect(
        useCallback(() => {
            async function loadCafe()
            {
                try
                {
                    setLoading(true);
                    setError(null);

                    const cafeDetails =
                        await getCafeDetails(
                            googlePlaceId
                        );

                    setCafe(cafeDetails);
                }
                catch (error)
                {
                    console.error(error);

                    setError(
                        'No se pudo cargar la cafetería'
                    );
                }
                finally
                {
                    setLoading(false);
                }
            }

            loadCafe();
        }, [googlePlaceId])
    );

    if (loading)
    {
        return (
            <SafeAreaView
                style={styles.container}
                edges={['left', 'right', 'bottom']}
            >
                <Text style={styles.title}>
                    Cargando cafetería...
                </Text>
            </SafeAreaView>
        );
    }

    if (error || !cafe)
    {
        return (
            <SafeAreaView
                style={styles.container}
                edges={['left', 'right', 'bottom']}
            >
                <Text style={styles.title}>
                    {error ?? 'Cafetería no encontrada'}
                </Text>
            </SafeAreaView>
        );
    }

    const priceLabel =
        cafe.priceLevel !== null &&
        cafe.priceLevel >= 1 &&
        cafe.priceLevel <= 4
            ? priceLabels[
                cafe.priceLevel as keyof typeof priceLabels
            ]
            : null;

    const addressLabel =
        [
            cafe.shortAddress,
            cafe.neighborhood,
            cafe.city,
        ]
            .filter(Boolean)
            .join(' · ');

    const openDirections = () => {
        const address = encodeURIComponent(cafe.address);

        Linking.openURL(
            `https://www.google.com/maps/search/?api=1&query=${address}`
        );
    };

    const handleFavoritePress = async () => {
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

    return (
        <SafeAreaView
            style={styles.container}
            edges={['left', 'right', 'bottom']}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.titleRow}>
                    <Text style={styles.title}>
                        {cafe.name}
                    </Text>

                    <TouchableOpacity
                        style={styles.favoriteIconButton}
                        onPress={handleFavoritePress}
                        activeOpacity={0.7}
                    >
                        <Text style={styles.favoriteIcon}>
                            {isFavorite(cafe.googlePlaceId)
                                ? '♥'
                                : '♡'}
                        </Text>
                    </TouchableOpacity>
                </View>

                <View style={styles.ratingsContainer}>
                    <View>
                        <Text style={styles.ratingLabel}>
                            Google
                        </Text>

                        <Text style={styles.ratingValue}>
                            {cafe.googleRating !== null
                                ? `★ ${cafe.googleRating} (${cafe.googleReviewsCount})`
                                : 'Sin valoraciones'}
                        </Text>
                    </View>

                    <View>
                        <Text style={styles.ratingLabel}>
                            Comunidad BusCafé
                        </Text>

                        <Text style={styles.ratingValue}>
                            {cafe.buscafeRating !== null
                                ? `★ ${cafe.buscafeRating.toFixed(1)} (${cafe.buscafeReviewsCount})`
                                : 'Sin valoraciones'}
                        </Text>
                    </View>
                </View>

                <Text style={styles.summary}>
                    {cafe.priceLevel !== null
                        ? `Precios: ${'$'.repeat(cafe.priceLevel)}${priceLabel ? ` · ${priceLabel}` : ''}`
                        : 'Precio no disponible'}
                </Text>

                <View style={styles.section}>
                    <Text
                        style={[
                            styles.status,
                            cafe.isOpen === true
                                ? styles.open
                                : cafe.isOpen === false
                                    ? styles.closed
                                    : undefined,
                        ]}
                    >
                        {cafe.isOpen === true
                            ? '● Abierto'
                            : cafe.isOpen === false
                                ? '● Cerrado'
                                : 'Horario no disponible'}
                    </Text>

                    {cafe.currentOpeningHours.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>
                                Horarios
                            </Text>

                            {cafe.currentOpeningHours.map(
                                (hours) => (
                                    <Text
                                        key={hours}
                                        style={styles.info}
                                    >
                                        🕐 {hours.charAt(0).toUpperCase() + hours.slice(1)}
                                    </Text>
                                )
                            )}
                        </>
                    )}

                    {cafe.distanceKm !== null && (
                        <Text style={styles.info}>
                            📏 {cafe.distanceKm.toFixed(2)} km
                        </Text>
                    )}

                    <Text style={styles.infoAddress}>
                        📍 {addressLabel}
                    </Text>
                    <Text style={styles.infoPets}>
                        {cafe.allowsDogs === true
                            ? '🐕 Acepta mascotas'
                            : cafe.allowsDogs === false
                                ? '🚫🐕 No acepta mascotas'
                                : '🐕 Mascotas: información no disponible'}
                    </Text>
                </View>
                {(
                    cafe.coffeeRating !== null ||
                    cafe.foodRating !== null ||
                    cafe.serviceRating !== null ||
                    cafe.comfortRating !== null ||
                    cafe.quietRating !== null
                ) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Valoraciones de la comunidad
                        </Text>

                        {cafe.coffeeRating !== null && (
                            <Text style={styles.communityRating}>
                                ☕ Café: {cafe.coffeeRating.toFixed(1)} / 5
                            </Text>
                        )}

                        {cafe.foodRating !== null && (
                            <Text style={styles.communityRating}>
                                🍰 Comida: {cafe.foodRating.toFixed(1)} / 5
                            </Text>
                        )}

                        {cafe.serviceRating !== null && (
                            <Text style={styles.communityRating}>
                                🤝 Servicio: {cafe.serviceRating.toFixed(1)} / 5
                            </Text>
                        )}

                        {cafe.comfortRating !== null && (
                            <Text style={styles.communityRating}>
                                🪑 Comodidad: {cafe.comfortRating.toFixed(1)} / 5
                            </Text>
                        )}

                        {cafe.quietRating !== null && (
                            <Text style={styles.communityRating}>
                                🔇 Tranquilidad: {cafe.quietRating.toFixed(1)} / 5
                            </Text>
                        )}

                        {(
                            (cafe.goodForWorkPercentage !== null &&
                                cafe.goodForWorkPercentage > 50) ||
                            (cafe.goodForStudyPercentage !== null &&
                                cafe.goodForStudyPercentage > 50) ||
                            (cafe.goodForDatePercentage !== null &&
                                cafe.goodForDatePercentage > 50)
                        ) && (
                            <View style={styles.communityRecommendations}>
                                <Text style={styles.communityRecommendationsTitle}>
                                    Ideal para
                                </Text>

                                <View style={styles.communityRecommendationTags}>
                                    {cafe.goodForWorkPercentage !== null &&
                                        cafe.goodForWorkPercentage > 50 && (
                                            <Text style={styles.communityRecommendationTag}>
                                                💻 Trabajar   👤👤 {cafe.goodForWorkCount}
                                            </Text>
                                        )}

                                    {cafe.goodForStudyPercentage !== null &&
                                        cafe.goodForStudyPercentage > 50 && (
                                            <Text style={styles.communityRecommendationTag}>
                                                📚 Estudiar   👤👤 {cafe.goodForStudyCount}
                                            </Text>
                                        )}

                                    {cafe.goodForDatePercentage !== null &&
                                        cafe.goodForDatePercentage > 50 && (
                                            <Text style={styles.communityRecommendationTag}>
                                                ❤️ Cita   👤👤 {cafe.goodForDateCount}
                                            </Text>
                                        )}
                                </View>
                            </View>
                        )}
                    </View>
                )}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>
                        Reseñas de BusCafé
                    </Text>

                    {cafe.buscafeReviews.length > 0 ? (
                        cafe.buscafeReviews.map((review) => (
                            <View
                                key={review.id}
                                style={styles.reviewCard}
                            >
                                <View style={styles.reviewHeader}>
                                    <Text style={styles.reviewUser}>
                                        {review.user?.name ?? 'Usuario eliminado'}
                                    </Text>

                                    <Text style={styles.reviewRating}>
                                        ★ {review.rating}
                                    </Text>
                                </View>

                                <Text style={styles.reviewComment}>
                                    {review.comment}
                                </Text>
                                <View style={styles.reviewDetails}>
                                    {review.coffeeRating !== null && (
                                        <Text style={styles.reviewDetail}>
                                            ☕ Café: {'★'.repeat(review.coffeeRating)}
                                        </Text>
                                    )}

                                    {review.foodRating !== null && (
                                        <Text style={styles.reviewDetail}>
                                            🍰 Comida: {'★'.repeat(review.foodRating)}
                                        </Text>
                                    )}

                                    {review.serviceRating !== null && (
                                        <Text style={styles.reviewDetail}>
                                            🤝 Servicio: {'★'.repeat(review.serviceRating)}
                                        </Text>
                                    )}

                                    {review.comfortRating !== null && (
                                        <Text style={styles.reviewDetail}>
                                            🪑 Comodidad: {'★'.repeat(review.comfortRating)}
                                        </Text>
                                    )}

                                    {review.quietRating !== null && (
                                        <Text style={styles.reviewDetail}>
                                            🔇 Tranquilidad: {'★'.repeat(review.quietRating)}
                                        </Text>
                                    )}

                                    {(
                                        review.goodForWork === true ||
                                        review.goodForStudy === true ||
                                        review.goodForDate === true
                                    ) && (
                                        <View style={styles.reviewRecommendations}>
                                            <Text style={styles.reviewRecommendationsTitle}>
                                                Ideal para
                                            </Text>

                                            <View style={styles.reviewRecommendationTags}>
                                                {review.goodForWork === true && (
                                                    <Text style={styles.reviewRecommendationTag}>
                                                        💻 Trabajar
                                                    </Text>
                                                )}

                                                {review.goodForStudy === true && (
                                                    <Text style={styles.reviewRecommendationTag}>
                                                        📚 Estudiar
                                                    </Text>
                                                )}

                                                {review.goodForDate === true && (
                                                    <Text style={styles.reviewRecommendationTag}>
                                                        ❤️ Cita
                                                    </Text>
                                                )}
                                            </View>
                                        </View>
                                    )}
                                </View>
                                <Text style={styles.reviewDate}>
                                    {new Date(
                                        review.createdAt
                                    ).toLocaleDateString('es-AR')}
                                </Text>
                            </View>
                        ))
                    ) : (
                        <Text style={styles.emptyReviews}>
                            Todavía no hay reseñas en BusCafé.
                        </Text>
                    )}
                </View>
                <TouchableOpacity
                    style={styles.addReviewButton}
                    onPress={() =>
                        navigation.navigate('AddReview', {
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
                        })
                    }
                >
                    <Text style={styles.addReviewButtonText}>
                        ✍️ Escribir una reseña
                    </Text>
                </TouchableOpacity>
                {(cafe.website ||
                    cafe.phone ||
                    cafe.googleMapsUrl) && (
                    <View style={styles.section}>
                        <Text style={styles.sectionTitle}>
                            Contacto
                        </Text>

                        <View style={styles.contactContainer}>
                            {cafe.website && (
                                <TouchableOpacity
                                    style={styles.contactButton}
                                    onPress={() =>
                                        Linking.openURL(cafe.website!)
                                    }
                                >
                                    <Text style={styles.contactButtonText}>
                                        🌐 Sitio web
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {cafe.phone && (
                                <TouchableOpacity
                                    style={styles.contactButton}
                                    onPress={() =>
                                        Linking.openURL(
                                            `tel:${cafe.phone}`
                                        )
                                    }
                                >
                                    <Text style={styles.contactButtonText}>
                                        📞 Llamar
                                    </Text>
                                </TouchableOpacity>
                            )}

                            {cafe.googleMapsUrl && (
                                <TouchableOpacity
                                    style={styles.contactButton}
                                    onPress={() =>
                                        Linking.openURL(
                                            cafe.googleMapsUrl!
                                        )
                                    }
                                >
                                    <Text style={styles.contactButtonText}>
                                        🗺️ Google Maps
                                    </Text>
                                </TouchableOpacity>
                            )}
                        </View>
                    </View>
                )}
                <TouchableOpacity 
                style={styles.directionsButton}
                onPress={openDirections}
                >
                    <Text style={styles.directionsButtonText}>
                        📍 Cómo llegar
                    </Text>
                </TouchableOpacity>
            </ScrollView>
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
        flex: 1,
        marginTop: 20,
        fontSize: 28,
        fontWeight: '700',
        color: '#4A2416',
    },

    summary: {
        marginTop: 8,
        fontSize: 16,
        color: '#7A6254',
    },

    section: {
        marginTop: 24,
    },

    sectionTitle: {
        marginBottom: 4,
        fontSize: 18,
        fontWeight: '700',
        color: '#4A2416',
    },

    status: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 8,
    },

    open: {
        color: '#39734A',
    },

    closed: {
        color: '#A13D32',
    },

    info: {
        marginTop: 4,
        fontSize: 15,
        color: '#7A6254',
    },

    infoAddress: {
        marginTop: 15,
        fontSize: 15,
        color: '#7A6254',
    },

    infoPets: {
        marginTop: 6,
        fontSize: 15,
        color: '#7A6254',
    },

    directionsButton: {
        marginTop: 24,
        backgroundColor: '#6B3A22',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },

    directionsButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    tagsContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },

    tag: {
        backgroundColor: '#F3E4C8',
        borderRadius: 12,
        paddingHorizontal: 10,
        paddingVertical: 6,
    },

    tagText: {
        fontSize: 13,
        color: '#6B3A22',
    },

    ratingsContainer: {
        flexDirection: 'row',
        gap: 28,
        marginTop: 16,
    },

    ratingLabel: {
        fontSize: 13,
        color: '#7A6254',
    },

    ratingValue: {
        marginTop: 4,
        fontSize: 16,
        fontWeight: '600',
        color: '#4A2416',
    },

    contactContainer: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },

    contactButton: {
        backgroundColor: '#F3E4C8',
        borderRadius: 12,
        paddingHorizontal: 12,
        paddingVertical: 9,
    },

    contactButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B3A22',
    },

    reviewCard: {
        marginBottom: 12,
        padding: 14,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E8D9C7',
    },

    reviewHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
    },

    reviewUser: {
        fontSize: 15,
        fontWeight: '700',
        color: '#4A2416',
    },

    reviewRating: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B3A22',
    },

    reviewComment: {
        marginTop: 8,
        fontSize: 14,
        lineHeight: 20,
        color: '#7A6254',
    },

    reviewDate: {
        marginTop: 8,
        fontSize: 12,
        color: '#9A8578',
    },

    emptyReviews: {
        marginBottom: 12,
        fontSize: 14,
        color: '#7A6254',
    },

    scrollContent: {
        paddingBottom: 32,
    },

    addReviewButton: {
        alignSelf: 'flex-start',
        marginBottom: 14,
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 12,
        backgroundColor: '#F3E4C8',
    },

    addReviewButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B3A22',
    },

    reviewDetails: {
        marginTop: 10,
        gap: 4,
    },

    reviewDetail: {
        fontSize: 13,
        color: '#6B3A22',
    },

    reviewRecommendations: {
        marginTop: 10,
    },

    reviewRecommendationsTitle: {
        marginBottom: 6,
        fontSize: 13,
        fontWeight: '600',
        color: '#7A6254',
    },

    reviewRecommendationTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 6,
    },

    reviewRecommendationTag: {
        paddingHorizontal: 8,
        paddingVertical: 5,
        borderRadius: 10,
        backgroundColor: '#F3E4C8',
        fontSize: 12,
        color: '#6B3A22',
    },

    communityRating: {
        marginTop: 6,
        fontSize: 15,
        color: '#6B3A22',
    },

    communityRecommendations: {
        marginTop: 18,
    },

    communityRecommendationsTitle: {
        fontSize: 16,
        fontWeight: '600',
        color: '#6B3A22',
        marginBottom: 8,
    },

    communityRecommendationTags: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        gap: 8,
    },

    communityRecommendationTag: {
        backgroundColor: '#F3E4C5',
        color: '#6B3A22',
        paddingHorizontal: 12,
        paddingVertical: 7,
        borderRadius: 16,
        fontSize: 14,
    },

    titleRow: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        justifyContent: 'space-between',
        gap: 12,
    },

    favoriteIconButton: {
        width: 40,
        height: 40,
        marginTop: 20,
        alignItems: 'center',
        justifyContent: 'center',
    },

    favoriteIcon: {
        fontSize: 30,
        lineHeight: 32,
        color: '#6B3A22',
    },
});