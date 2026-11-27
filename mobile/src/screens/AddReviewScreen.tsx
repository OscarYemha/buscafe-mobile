import {
    ActivityIndicator,
    Alert,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamlist } from '../navigation/AppNavigator';
import { useReviewDraft } from '../context/ReviewDraftContext';
import { useAuth } from '../context/AuthContext';
import { createReview, isInvalidSessionError, updateReview } from '../services/api';
import { useReviews } from '../context/ReviewsContext';
import { getErrorMessage } from '../utils/errorMessages';
import { formatWaitTime, isApiError } from '../services/apiError';
import { useState } from 'react';

type Props = NativeStackScreenProps<
    RootStackParamlist,
    'AddReview' | 'EditReview'
>;

/** El contenido del formulario: lo mismo para una reseña nueva y una editada. */
type ReviewValues = {
    rating: number;
    comment: string;

    coffeeRating: number | null;
    foodRating: number | null;
    serviceRating: number | null;
    comfortRating: number | null;
    quietRating: number | null;

    goodForWork: boolean | null;
    goodForStudy: boolean | null;
    goodForDate: boolean | null;

    hasWifi: boolean | null;
    hasPowerOutlets: boolean | null;
};

const EMPTY_VALUES: ReviewValues = {
    rating: 0,
    comment: '',

    coffeeRating: null,
    foodRating: null,
    serviceRating: null,
    comfortRating: null,
    quietRating: null,

    goodForWork: null,
    goodForStudy: null,
    goodForDate: null,

    hasWifi: null,
    hasPowerOutlets: null,
};

const pickValues = (source: ReviewValues): ReviewValues => ({
    rating: source.rating,
    comment: source.comment,

    coffeeRating: source.coffeeRating,
    foodRating: source.foodRating,
    serviceRating: source.serviceRating,
    comfortRating: source.comfortRating,
    quietRating: source.quietRating,

    goodForWork: source.goodForWork,
    goodForStudy: source.goodForStudy,
    goodForDate: source.goodForDate,

    hasWifi: source.hasWifi,
    hasPowerOutlets: source.hasPowerOutlets,
});

export default function AddReviewScreen({ route, navigation }: Props) {

    /*
     * Dos modos con el mismo formulario:
     * - Nueva (AddReview): los valores viven en el borrador, que se guarda
     *   en el teléfono y sobrevive a cerrar la app.
     * - Edición (EditReview): estado local precargado con la reseña. No toca
     *   el borrador, para no pisar una reseña nueva a medio escribir.
     */
    const editingReview =
        'review' in route.params ? route.params.review : null;
    const isEditing = editingReview !== null;

    const newReviewParams =
        'review' in route.params ? null : route.params;

    const googlePlaceId =
        editingReview?.cafe.googlePlaceId ?? newReviewParams!.googlePlaceId;
    const cafeName =
        editingReview?.cafe.name ?? newReviewParams!.cafeName;

    const {
        draft,
        setDraft,
        clearDraft,
        isDraftReady,
        preparePublication,
    } = useReviewDraft();

    const {user, isAuthenticated, logout} = useAuth();
    const { notifyReviewsChanged } = useReviews();

    const [isSubmitting, setIsSubmitting] = useState(false);

    const [editValues, setEditValues] = useState<ReviewValues>(() =>
        editingReview ? pickValues(editingReview) : EMPTY_VALUES
    );

    const isCurrentCafeDraft = draft.cafeId === googlePlaceId;

    const draftValues = isCurrentCafeDraft
        ? pickValues(draft)
        : EMPTY_VALUES;

    const values = isEditing ? editValues : draftValues;

    const {
        rating,
        comment,
        coffeeRating,
        foodRating,
        serviceRating,
        comfortRating,
        quietRating,
        goodForWork,
        goodForStudy,
        goodForDate,
        hasWifi,
        hasPowerOutlets,
    } = values;

    const canSubmit =
        (isEditing || isDraftReady) &&
        rating > 0 &&
        comment.trim().length > 0;

    const updateField = <K extends keyof ReviewValues>(
        field: K,
        value: ReviewValues[K]
    ) => {
        if (isEditing)
        {
            setEditValues((previous) => ({ ...previous, [field]: value }));
            return;
        }

        setDraft({
            cafeId: googlePlaceId,
            ...draftValues,
            [field]: value,
        });
    };

    const updateSpecificRating = (
        field:
            | 'coffeeRating'
            | 'foodRating'
            | 'serviceRating'
            | 'comfortRating'
            | 'quietRating',
        value: number | null
    ) => updateField(field, value);

    const updateRecommendation = (
        field:
            | 'goodForWork'
            | 'goodForStudy'
            | 'goodForDate'
            | 'hasWifi'
            | 'hasPowerOutlets',
        value: boolean | null
    ) => updateField(field, value);

    const renderRecommendation = (
        label: string,
        field:
            | 'goodForWork'
            | 'goodForStudy'
            | 'goodForDate'
            | 'hasWifi'
            | 'hasPowerOutlets',
        value: boolean | null
    ) => {
        return (
            <View style={styles.recommendationRow}>
                <Text style={styles.recommendationLabel}>
                    {label}
                </Text>

                <View style={styles.recommendationOptions}>
                    <TouchableOpacity
                        style={[
                            styles.recommendationButton,
                            value === true &&
                                styles.recommendationButtonSelected,
                        ]}
                        onPress={() =>
                            updateRecommendation(
                                field,
                                value === true? null : true
                            )
                        }
                    >
                        <Text
                            style={[
                                styles.recommendationButtonText,
                                value === true &&
                                    styles.recommendationButtonTextSelected,
                            ]}
                        >
                            Sí
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.recommendationButton,
                            value === false &&
                                styles.recommendationButtonSelected,
                        ]}
                        onPress={() =>
                            updateRecommendation(
                                field,
                                value === false ? null: false
                            )
                        }
                    >
                        <Text
                            style={[
                                styles.recommendationButtonText,
                                value === false &&
                                    styles.recommendationButtonTextSelected,
                            ]}
                        >
                            No
                        </Text>
                    </TouchableOpacity>
                </View>
            </View>
        );
    };

    const specificRatingOptions = [
        { value: 1, label: 'Muy malo' },
        { value: 2, label: 'Malo' },
        { value: 3, label: 'Regular' },
        { value: 4, label: 'Bueno' },
        { value: 5, label: 'Excelente' },
    ];

    const renderSpecificRating = (
        label: string,
        field:
            | 'coffeeRating'
            | 'foodRating'
            | 'serviceRating'
            | 'comfortRating'
            | 'quietRating',
        value: number | null
    ) => {
        return (
            <View style={styles.specificRatingBlock}>
                <Text style={styles.specificRatingLabel}>
                    {label}
                </Text>

                <View style={styles.specificRatingOptions}>
                    {specificRatingOptions.map((option) => (
                        <TouchableOpacity
                            key={option.value}
                            style={[
                                styles.specificRatingButton,
                                value === option.value &&
                                    styles.specificRatingButtonSelected,
                            ]}
                            onPress={() =>
                                updateSpecificRating(
                                    field,
                                    value === option.value
                                        ? null
                                        : option.value
                                )
                            }
                        >
                            <Text
                                style={[
                                    styles.specificRatingButtonText,
                                    value === option.value &&
                                        styles.specificRatingButtonTextSelected,
                                ]}
                            >
                                {option.label}
                            </Text>
                        </TouchableOpacity>
                    ))}
                </View>
            </View>
        );
    };

    // Mismo envío de contenido para el alta y la edición.
    const reviewContent = {
        rating,
        comment: comment.trim(),

        coffeeRating: coffeeRating ?? undefined,
        foodRating: foodRating ?? undefined,
        serviceRating: serviceRating ?? undefined,
        comfortRating: comfortRating ?? undefined,
        quietRating: quietRating ?? undefined,

        goodForWork: goodForWork ?? undefined,
        goodForStudy: goodForStudy ?? undefined,
        goodForDate: goodForDate ?? undefined,

        hasWifi: hasWifi ?? undefined,
        hasPowerOutlets: hasPowerOutlets ?? undefined,
    };

    const handleSessionExpired = async (message: string, extra: string) =>
    {
        try
        {
            await logout();
        }
        catch (logoutError)
        {
            console.error('Error al cerrar la sesión vencida:', logoutError);
        }

        Alert.alert(
            'Sesión vencida',
            `${message}${extra}`,
            [
                {
                    text: 'Iniciar sesión',
                    onPress: () =>
                    {
                        navigation.navigate('Login', {
                            returnTo: 'previous',
                        });
                    },
                },
            ]
        );
    };

    const saveEdit = async (reviewId: number) =>
    {
        setIsSubmitting(true);

        try
        {
            await updateReview(reviewId, reviewContent);

            notifyReviewsChanged();
            navigation.goBack();
        }
        catch (error)
        {
            console.error('Error al guardar la reseña:', error);

            if (isInvalidSessionError(error))
            {
                await handleSessionExpired(error.message, '');
                return;
            }

            if (isApiError(error) && error.status === 404)
            {
                Alert.alert(
                    'Reseña no disponible',
                    'Esta reseña ya no existe: quizás la borraste desde otro dispositivo.',
                    [{ text: 'Aceptar', onPress: () => navigation.goBack() }]
                );
                return;
            }

            if (
                isApiError(error) &&
                error.status === 429 &&
                error.retryAfterSeconds !== null
            )
            {
                Alert.alert(
                    'Límite de cambios alcanzado',
                    `Hiciste muchos cambios en poco tiempo. Podés volver a intentar en ${formatWaitTime(error.retryAfterSeconds)}.`
                );
                return;
            }

            Alert.alert(
                'No se pudo guardar la reseña',
                getErrorMessage(
                    error,
                    'No pudimos guardar los cambios. Intentá nuevamente.'
                )
            );
        }
        finally
        {
            setIsSubmitting(false);
        }
    };

    const handleSubmit = () =>
    {
        if (!canSubmit || isSubmitting)
        {
            return;
        }

        if (!isAuthenticated || !user)
        {
            navigation.navigate('Login', {
                returnTo: 'previous',
            });

            return;
        }

        if (editingReview)
        {
            Alert.alert(
                '¿Guardar cambios?',
                `¿Querés guardar los cambios en tu reseña de ${cafeName}?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Guardar',
                        onPress: () => void saveEdit(editingReview.id),
                    },
                ]
            );

            return;
        }

        const {
            cafeAddress,
            cafeLatitude,
            cafeLongitude,
        } = newReviewParams!;

        Alert.alert(
            '¿Publicar reseña?',
            `¿Querés publicar tu reseña de ${cafeName}?`,
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Publicar',
                    onPress: async () =>
                    {
                        if (isSubmitting)
                        {
                            return;
                        }

                        setIsSubmitting(true);

                        try
                        {
                            const reviewData = {
                                googlePlaceId,
                                cafeName,
                                cafeAddress,
                                cafeLatitude,
                                cafeLongitude,

                                ...reviewContent,
                            };

                            const idempotencyKey = await preparePublication(
                                user.id,
                                JSON.stringify(reviewData)
                            );

                            await createReview({
                                ...reviewData,
                                idempotencyKey,
                            });

                            await clearDraft();
                            notifyReviewsChanged();

                            Alert.alert(
                                'Reseña publicada',
                                'Tu reseña se publicó correctamente.',
                                [
                                    {
                                        text: 'Aceptar',
                                        onPress: () =>
                                        {
                                            navigation.goBack();
                                        },
                                    },
                                ]
                            );
                        }
                        catch (error)
                        {
                            console.error(
                                'Error al publicar la reseña:',
                                error
                            );

                            // Sesión vencida: mismo flujo que al restaurar la
                            // sesión. El borrador queda guardado para después.
                            if (isInvalidSessionError(error))
                            {
                                await handleSessionExpired(
                                    error.message,
                                    ' Tu borrador queda guardado.'
                                );

                                return;
                            }

                            if (
                                isApiError(error) &&
                                error.status === 429 &&
                                error.retryAfterSeconds !== null
                            )
                            {
                                Alert.alert(
                                    'Límite de reseñas alcanzado',
                                    `Publicaste muchas reseñas en poco tiempo. Podés volver a intentar en ${formatWaitTime(error.retryAfterSeconds)}. Tu borrador queda guardado.`
                                );

                                return;
                            }

                            if (
                                isApiError(error) &&
                                error.status === 404
                            )
                            {
                                Alert.alert(
                                    'Cafetería no disponible',
                                    `${error.message}. No es posible publicar reseñas de este lugar. ¿Querés descartar el borrador?`,
                                    [
                                        {
                                            text: 'Conservar',
                                            style: 'cancel',
                                        },
                                        {
                                            text: 'Descartar borrador',
                                            style: 'destructive',
                                            onPress: () =>
                                            {
                                                void clearDraft()
                                                    .catch(clearError =>
                                                    {
                                                        console.error(
                                                            'No se pudo descartar el borrador:',
                                                            clearError
                                                        );
                                                    })
                                                    .finally(() =>
                                                    {
                                                        navigation.goBack();
                                                    });
                                            },
                                        },
                                    ]
                                );

                                return;
                            }

                            Alert.alert(
                                'No se pudo publicar la reseña',
                                getErrorMessage(
                                    error,
                                    'No pudimos publicar tu reseña. Intentá nuevamente.'
                                )
                            );
                        }
                        finally
                        {
                            setIsSubmitting(false);
                        }
                    },
                },
            ]
        );
    };

    return (
        <SafeAreaView
            style={styles.container}
            edges={['left', 'right', 'bottom']}
        >
            <KeyboardAvoidingView
                style={{ flex: 1 }}
                behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                    keyboardShouldPersistTaps="handled"
                >
                    <Text style={styles.title}>
                        {isEditing ? `Editar reseña de ${cafeName}` : `Reseñar ${cafeName}`}
                    </Text>

                    <Text style={styles.description}>
                        {isEditing
                            ? 'Actualizá lo que cambió desde tu visita.'
                            : 'Contanos cómo fue tu experiencia.'}
                    </Text>
                    <View style={styles.ratingSection}>
                        <Text style={styles.label}>
                            Tu valoración
                        </Text>

                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => updateField('rating', star)}
                                >
                                    <Text style={styles.star}>
                                        {star <= rating ? '★' : '☆'}
                                    </Text>
                                </TouchableOpacity>
                            ))}
                        </View>
                    </View>
                    <View style={styles.specificRatingsSection}>
                        <Text style={styles.label}>
                            Contanos un poco más
                        </Text>

                        <Text style={styles.optionalText}>
                            Estas valoraciones son opcionales.
                        </Text>

                        {renderSpecificRating(
                            '☕ Café',
                            'coffeeRating',
                            coffeeRating
                        )}

                        {renderSpecificRating(
                            '🍰 Comida',
                            'foodRating',
                            foodRating
                        )}

                        {renderSpecificRating(
                            '🤝 Servicio',
                            'serviceRating',
                            serviceRating
                        )}

                        {renderSpecificRating(
                            '🪑 Comodidad',
                            'comfortRating',
                            comfortRating
                        )}

                        {renderSpecificRating(
                            '🔇 Tranquilidad',
                            'quietRating',
                            quietRating
                        )}
                    </View>
                    <View style={styles.recommendationsSection}>
                        <Text style={styles.label}>
                            ¿Para qué lo recomendarías?
                        </Text>

                        <Text style={styles.optionalText}>
                            Estas respuestas son opcionales.
                        </Text>

                        {renderRecommendation(
                            '💻 Trabajar',
                            'goodForWork',
                            goodForWork
                        )}

                        {renderRecommendation(
                            '📚 Estudiar',
                            'goodForStudy',
                            goodForStudy
                        )}

                        {renderRecommendation(
                            '❤️ Cita',
                            'goodForDate',
                            goodForDate
                        )}
                    </View>
                    <View style={styles.recommendationsSection}>
                        <Text style={styles.label}>
                            Para trabajar
                        </Text>

                        <Text style={styles.optionalText}>
                            Google no tiene estos datos: los arma la comunidad.
                        </Text>

                        {renderRecommendation(
                            '📶 ¿Tiene Wi-Fi?',
                            'hasWifi',
                            hasWifi
                        )}

                        {renderRecommendation(
                            '🔌 ¿Hay enchufes disponibles?',
                            'hasPowerOutlets',
                            hasPowerOutlets
                        )}
                    </View>
                    <View
                        style={styles.commentSection}
                    >
                        <Text style={styles.label}>
                            Tu comentario
                        </Text>

                        <TextInput
                            style={styles.commentInput}
                            value={comment}
                            onChangeText={(text) => updateField('comment', text)}
                            placeholder="Contanos qué te gustó o qué podría mejorar..."
                            placeholderTextColor="#9A8578"
                            multiline
                            maxLength={500}
                            textAlignVertical="top"
                        />

                        <Text style={styles.characterCount}>
                            {comment.length}/500
                        </Text>

                        <TouchableOpacity
                            style={[
                                styles.submitButton,
                                (!canSubmit || isSubmitting) &&
                                    styles.submitButtonDisabled,
                            ]}
                            disabled={!canSubmit || isSubmitting}
                            onPress={handleSubmit}
                        >
                            {isSubmitting ? (
                                <View style={styles.submittingContent}>
                                    <ActivityIndicator
                                        size="small"
                                        color="#FFFFFF"
                                    />

                                    <Text style={styles.submitButtonText}>
                                        {isEditing ? 'Guardando...' : 'Publicando...'}
                                    </Text>
                                </View>
                            ) : (
                                <Text style={styles.submitButtonText}>
                                    {isEditing ? 'Guardar cambios' : 'Publicar reseña'}
                                </Text>
                            )}
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </KeyboardAvoidingView>
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
        fontSize: 26,
        fontWeight: '700',
        color: '#4A2416',
    },

    description: {
        marginTop: 8,
        fontSize: 15,
        color: '#7A6254',
    },

    ratingSection: {
        marginTop: 28,
    },

    label: {
        fontSize: 16,
        fontWeight: '600',
        color: '#4A2416',
    },

    starsContainer: {
        flexDirection: 'row',
        gap: 8,
        marginTop: 10,
    },

    star: {
        fontSize: 36,
        color: '#6B3A22',
    },

    commentSection: {
        marginTop: 28,
    },

    commentInput: {
        minHeight: 130,
        marginTop: 10,
        padding: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
        fontSize: 15,
        color: '#4A2416',
    },

    characterCount: {
        marginTop: 6,
        textAlign: 'right',
        fontSize: 12,
        color: '#9A8578',
    },

    submitButton: {
        marginTop: 28,
        backgroundColor: '#6B3A22',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },

    submitButtonDisabled: {
        opacity: 0.4,
    },

    submitButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    specificRatingsSection: {
        marginTop: 28,
    },

    optionalText: {
        marginTop: 4,
        fontSize: 13,
        color: '#9A8578',
    },

    specificRatingBlock: {
        marginTop: 18,
    },

    specificRatingLabel: {
        fontSize: 15,
        color: '#4A2416',
        marginBottom: 8,
    },

    specificRatingOptions: {
        flexDirection: 'row',
        gap: 5,
    },

    specificRatingButton: {
        flex: 1,
        paddingVertical: 8,
        paddingHorizontal: 2,
        borderWidth: 1,
        borderColor: '#D8C4B4',
        borderRadius: 10,
        alignItems: 'center',
    },

    specificRatingButtonSelected: {
        backgroundColor: '#6B3A22',
        borderColor: '#6B3A22',
    },

    specificRatingButtonText: {
        fontSize: 12,
        color: '#6B3A22',
        textAlign: 'center',
    },

    specificRatingButtonTextSelected: {
        color: '#FFFFFF',
        fontWeight: '600',
    },

    scrollContent: {
        paddingBottom: 40,
    },

    recommendationRow: {
        marginTop: 16,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },

    recommendationLabel: {
        flex: 1,
        fontSize: 15,
        color: '#4A2416',
    },

    recommendationOptions: {
        flexDirection: 'row',
        gap: 8,
    },

    recommendationButton: {
        minWidth: 48,
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderWidth: 1,
        borderColor: '#D8C4B4',
        borderRadius: 10,
        alignItems: 'center',
    },

    recommendationButtonSelected: {
        backgroundColor: '#6B3A22',
        borderColor: '#6B3A22',
    },

    recommendationButtonText: {
        color: '#6B3A22',
        fontWeight: '600',
    },

    recommendationButtonTextSelected: {
        color: '#FFFFFF',
    },

    recommendationsSection: {
        marginTop: 28,
    },

    submittingContent: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
});