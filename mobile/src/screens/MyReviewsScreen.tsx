import { useCallback, useState } from 'react';
import {
    ActivityIndicator,
    Alert,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { RootStackParamlist } from '../navigation/AppNavigator';
import { deleteReview, getMyReviews, isInvalidSessionError, MyReview } from '../services/api';
import { isApiError } from '../services/apiError';
import { useReviews } from '../context/ReviewsContext';
import { getErrorMessage } from '../utils/errorMessages';

type RootNavigation = NativeStackNavigationProp<RootStackParamlist>;

/** "27/11/2026": sin depender del soporte de Intl del motor de JS. */
function formatDate(isoDate: string): string
{
    const date = new Date(isoDate);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');

    return `${day}/${month}/${date.getFullYear()}`;
}

export default function MyReviewsScreen()
{
    const navigation = useNavigation<RootNavigation>();

    const { notifyReviewsChanged } = useReviews();

    const [reviews, setReviews] = useState<MyReview[] | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [deletingId, setDeletingId] = useState<number | null>(null);

    const removeFromList = (reviewId: number) =>
        setReviews((current) =>
            current?.filter((review) => review.id !== reviewId) ?? current
        );

    const confirmDelete = (review: MyReview) =>
    {
        Alert.alert(
            '¿Borrar tu reseña?',
            `Se va a borrar tu reseña de ${review.cafe.name}. No se puede deshacer.`,
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Borrar',
                    style: 'destructive',
                    onPress: async () =>
                    {
                        setDeletingId(review.id);

                        try
                        {
                            await deleteReview(review.id);

                            removeFromList(review.id);
                            notifyReviewsChanged();
                        }
                        catch (deleteError)
                        {
                            // Con la sesión vencida, AuthContext ya cierra la sesión.
                            if (isInvalidSessionError(deleteError))
                            {
                                return;
                            }

                            // Ya no existe (borrada desde otro dispositivo): sacarla igual.
                            if (isApiError(deleteError) && deleteError.status === 404)
                            {
                                removeFromList(review.id);
                                notifyReviewsChanged();
                                return;
                            }

                            console.error('Error al borrar la reseña:', deleteError);
                            Alert.alert(
                                'No se pudo borrar la reseña',
                                getErrorMessage(
                                    deleteError,
                                    'No pudimos borrar tu reseña. Intentá nuevamente.'
                                )
                            );
                        }
                        finally
                        {
                            setDeletingId(null);
                        }
                    },
                },
            ]
        );
    };

    // Al volver a la pantalla (por ejemplo, después de escribir una reseña)
    // se recarga la lista.
    useFocusEffect(
        useCallback(() => {
            let active = true;

            getMyReviews()
                .then((result) => {
                    if (active)
                    {
                        setReviews(result);
                        setError(null);
                    }
                })
                .catch((loadError) => {
                    // Con la sesión vencida, AuthContext ya cierra la sesión.
                    if (active && !isInvalidSessionError(loadError))
                    {
                        console.error('Error al cargar mis reseñas:', loadError);
                        setError('No se pudieron cargar tus reseñas. Probá de nuevo más tarde.');
                    }
                });

            return () => {
                active = false;
            };
        }, [])
    );

    return (
        <SafeAreaView style={styles.container} edges={['left', 'right']}>
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                {reviews === null && !error && (
                    <ActivityIndicator style={styles.loading} size="large" color="#6B3A22" />
                )}

                {error && (
                    <Text style={styles.message}>{error}</Text>
                )}

                {reviews?.length === 0 && (
                    <View style={styles.emptyContainer}>
                        <Text style={styles.emptyIcon}>☆</Text>
                        <Text style={styles.emptyTitle}>
                            Todavía no escribiste reseñas
                        </Text>
                        <Text style={styles.emptyText}>
                            Entrá a una cafetería y contá cómo te fue: ayuda a
                            que otras personas encuentren su lugar ideal.
                        </Text>
                    </View>
                )}

                {reviews?.map((review) => (
                    <View key={review.id} style={styles.reviewCard}>
                        <TouchableOpacity
                            style={styles.cardBody}
                            activeOpacity={0.8}
                            onPress={() =>
                                navigation.navigate('CafeDetail', {
                                    googlePlaceId: review.cafe.googlePlaceId,
                                })
                            }
                            accessibilityLabel={`Tu reseña de ${review.cafe.name}`}
                        >
                            <View style={styles.cardHeader}>
                                <Text style={styles.cafeName} numberOfLines={2}>
                                    {review.cafe.name}
                                </Text>
                                <Text style={styles.chevron}>›</Text>
                            </View>

                            <View style={styles.metaRow}>
                                <Text style={styles.stars}>
                                    {'★'.repeat(review.rating)}
                                    <Text style={styles.starsEmpty}>
                                        {'★'.repeat(5 - review.rating)}
                                    </Text>
                                </Text>
                                <Text style={styles.date}>
                                    {formatDate(review.createdAt)}
                                    {review.editedAt ? ' · editada' : ''}
                                </Text>
                            </View>

                            <Text style={styles.comment} numberOfLines={4}>
                                {review.comment}
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.actions}>
                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() =>
                                    navigation.navigate('EditReview', { review })
                                }
                                disabled={deletingId === review.id}
                                accessibilityLabel={`Editar tu reseña de ${review.cafe.name}`}
                            >
                                <Text style={styles.actionText}>Editar</Text>
                            </TouchableOpacity>

                            <View style={styles.actionDivider} />

                            <TouchableOpacity
                                style={styles.actionButton}
                                onPress={() => confirmDelete(review)}
                                disabled={deletingId === review.id}
                                accessibilityLabel={`Borrar tu reseña de ${review.cafe.name}`}
                            >
                                {deletingId === review.id ? (
                                    <ActivityIndicator size="small" color="#A33A2B" />
                                ) : (
                                    <Text style={[styles.actionText, styles.deleteText]}>
                                        Borrar
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
                    </View>
                ))}
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F1E7',
    },

    content: {
        flexGrow: 1,
        paddingHorizontal: 20,
        paddingTop: 6,
        paddingBottom: 32,
    },

    loading: {
        marginTop: 40,
    },

    message: {
        marginTop: 24,
        fontSize: 15,
        color: '#7A6254',
    },

    emptyContainer: {
        marginTop: 48,
        alignItems: 'center',
        paddingHorizontal: 24,
    },

    emptyIcon: {
        fontSize: 42,
        color: '#6B3A22',
    },

    emptyTitle: {
        marginTop: 14,
        fontSize: 18,
        fontWeight: '700',
        color: '#4A2416',
        textAlign: 'center',
    },

    emptyText: {
        marginTop: 8,
        fontSize: 15,
        lineHeight: 21,
        color: '#7A6254',
        textAlign: 'center',
    },

    reviewCard: {
        marginTop: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
        overflow: 'hidden',
    },

    cardBody: {
        padding: 16,
        paddingBottom: 14,
    },

    actions: {
        flexDirection: 'row',
        borderTopWidth: 1,
        borderTopColor: '#F0E5D8',
    },

    actionButton: {
        flex: 1,
        minHeight: 44,
        alignItems: 'center',
        justifyContent: 'center',
    },

    actionDivider: {
        width: 1,
        backgroundColor: '#F0E5D8',
    },

    actionText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B3A22',
    },

    deleteText: {
        color: '#A33A2B',
    },

    cardHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },

    cafeName: {
        flex: 1,
        fontSize: 17,
        fontWeight: '700',
        color: '#4A2416',
    },

    chevron: {
        fontSize: 24,
        color: '#B9A391',
    },

    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginTop: 6,
    },

    stars: {
        fontSize: 16,
        color: '#C98A2E',
        letterSpacing: 1,
    },

    starsEmpty: {
        color: '#E3D5C4',
    },

    date: {
        fontSize: 13,
        color: '#9A8578',
    },

    comment: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 21,
        color: '#5C4536',
    },
});
