import {
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
import { createReview } from '../services/api';
import { useReviews } from '../context/ReviewsContext';

type Props = NativeStackScreenProps<
    RootStackParamlist,
    'AddReview'
>;

export default function AddReviewScreen({ route, navigation }: Props) {

    const {
        googlePlaceId,
        cafeName,
        cafeAddress,
        cafeLatitude,
        cafeLongitude,
    } = route.params;

    const {draft, setDraft, clearDraft} = useReviewDraft();
    const {user, isAuthenticated} = useAuth();
    const { notifyReviewsChanged } = useReviews();

    const isCurrentCafeDraft = draft.cafeId === googlePlaceId;

    const rating = isCurrentCafeDraft
        ? draft.rating
        : 0;

    const comment = isCurrentCafeDraft
        ? draft.comment
        : '';

    const coffeeRating = isCurrentCafeDraft
        ? draft.coffeeRating
        : null;

    const foodRating = isCurrentCafeDraft
        ? draft.foodRating
        : null;

    const serviceRating = isCurrentCafeDraft
        ? draft.serviceRating
        : null;

    const comfortRating = isCurrentCafeDraft
        ? draft.comfortRating
        : null;

    const quietRating = isCurrentCafeDraft
        ? draft.quietRating
        : null;

    const goodForWork = isCurrentCafeDraft
        ? draft.goodForWork
        : null;

    const goodForStudy = isCurrentCafeDraft
        ? draft.goodForStudy
        : null;

    const goodForDate = isCurrentCafeDraft
        ? draft.goodForDate
        : null;

    const canSubmit =
        rating > 0 && comment.trim().length > 0;

    const updateSpecificRating = (
        field:
            | 'coffeeRating'
            | 'foodRating'
            | 'serviceRating'
            | 'comfortRating'
            | 'quietRating',
        value: number | null
        ) => {
            setDraft({
                cafeId: googlePlaceId,

                rating: isCurrentCafeDraft
                    ? draft.rating
                    : 0,

                comment: isCurrentCafeDraft
                    ? draft.comment
                    : '',

                coffeeRating: isCurrentCafeDraft
                    ? draft.coffeeRating
                    : null,

                foodRating: isCurrentCafeDraft
                    ? draft.foodRating
                    : null,

                serviceRating: isCurrentCafeDraft
                    ? draft.serviceRating
                    : null,

                comfortRating: isCurrentCafeDraft
                    ? draft.comfortRating
                    : null,

                quietRating: isCurrentCafeDraft
                    ? draft.quietRating
                    : null,

                [field]: value,

                goodForWork: isCurrentCafeDraft
                    ? draft.goodForWork
                    : null,

                goodForStudy: isCurrentCafeDraft
                    ? draft.goodForStudy
                    : null,

                goodForDate: isCurrentCafeDraft
                    ? draft.goodForDate
                    : null,
        });
    };

    const updateRecommendation = (
        field:
            | 'goodForWork'
            | 'goodForStudy'
            | 'goodForDate',
        value: boolean | null
    ) => {
        setDraft({
            ...draft,

            cafeId: googlePlaceId,

            rating: isCurrentCafeDraft
                ? draft.rating
                : 0,

            comment: isCurrentCafeDraft
                ? draft.comment
                : '',

            coffeeRating: isCurrentCafeDraft
                ? draft.coffeeRating
                : null,

            foodRating: isCurrentCafeDraft
                ? draft.foodRating
                : null,

            serviceRating: isCurrentCafeDraft
                ? draft.serviceRating
                : null,

            comfortRating: isCurrentCafeDraft
                ? draft.comfortRating
                : null,

            quietRating: isCurrentCafeDraft
                ? draft.quietRating
                : null,

            goodForWork: isCurrentCafeDraft
                ? draft.goodForWork
                : null,

            goodForStudy: isCurrentCafeDraft
                ? draft.goodForStudy
                : null,

            goodForDate: isCurrentCafeDraft
                ? draft.goodForDate
                : null,

            [field]: value,
        });
    };

    const renderRecommendation = (
        label: string,
        field:
            | 'goodForWork'
            | 'goodForStudy'
            | 'goodForDate',
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

    const handleSubmit = async () => {
        if (!canSubmit)
        {
            return;
        }

        if (!isAuthenticated || !user)
        {
            navigation.navigate('Login');
            return;
        }

        try
        {
            await createReview({
                googlePlaceId,
                cafeName,
                cafeAddress,
                cafeLatitude,
                cafeLongitude,

                rating,
                comment: comment.trim(),

                coffeeRating:
                    coffeeRating ?? undefined,

                foodRating:
                    foodRating ?? undefined,

                serviceRating:
                    serviceRating ?? undefined,

                comfortRating:
                    comfortRating ?? undefined,

                quietRating:
                    quietRating ?? undefined,

                goodForWork:
                    goodForWork ?? undefined,

                goodForStudy:
                    goodForStudy ?? undefined,

                goodForDate:
                    goodForDate ?? undefined,
            });

            clearDraft();
            notifyReviewsChanged();
            navigation.goBack();
        }
        catch (error)
        {
            console.error(
                'Error al publicar la reseña:',
                error
            );
        }
    };

    return (
        <SafeAreaView style={styles.container}>
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
                        Reseñar {cafeName}
                    </Text>

                    <Text style={styles.description}>
                        Contanos cómo fue tu experiencia.
                    </Text>
                    <View style={styles.ratingSection}>
                        <Text style={styles.label}>
                            Tu valoración
                        </Text>

                        <View style={styles.starsContainer}>
                            {[1, 2, 3, 4, 5].map((star) => (
                                <TouchableOpacity
                                    key={star}
                                    onPress={() => 
                                        setDraft({
                                            cafeId: googlePlaceId,
                                            rating: star,
                                            comment: isCurrentCafeDraft
                                                ? draft.comment
                                                : '',

                                            coffeeRating: isCurrentCafeDraft
                                                ? draft.coffeeRating
                                                : null,

                                            foodRating: isCurrentCafeDraft
                                                ? draft.foodRating
                                                : null,

                                            serviceRating: isCurrentCafeDraft
                                                ? draft.serviceRating
                                                : null,

                                            comfortRating: isCurrentCafeDraft
                                                ? draft.comfortRating
                                                : null,

                                            quietRating: isCurrentCafeDraft
                                                ? draft.quietRating
                                                : null,

                                            goodForWork: isCurrentCafeDraft
                                                ? draft.goodForWork
                                                : null,

                                            goodForStudy: isCurrentCafeDraft
                                                ? draft.goodForStudy
                                                : null,

                                            goodForDate: isCurrentCafeDraft
                                                ? draft.goodForDate
                                                : null,
                                        })
                                    }
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
                    <View
                        style={styles.commentSection}
                    >
                        <Text style={styles.label}>
                            Tu comentario
                        </Text>

                        <TextInput
                            style={styles.commentInput}
                            value={comment}
                            onChangeText={(text) =>
                                setDraft({
                                    cafeId: googlePlaceId,
                                    rating: isCurrentCafeDraft
                                        ? draft.rating
                                        : 0,
                                    comment: text,

                                    coffeeRating: isCurrentCafeDraft
                                        ? draft.coffeeRating
                                        : null,

                                    foodRating: isCurrentCafeDraft
                                        ? draft.foodRating
                                        : null,

                                    serviceRating: isCurrentCafeDraft
                                        ? draft.serviceRating
                                        : null,

                                    comfortRating: isCurrentCafeDraft
                                        ? draft.comfortRating
                                        : null,

                                    quietRating: isCurrentCafeDraft
                                        ? draft.quietRating
                                        : null,

                                    goodForWork: isCurrentCafeDraft
                                        ? draft.goodForWork
                                        : null,

                                    goodForStudy: isCurrentCafeDraft
                                        ? draft.goodForStudy
                                        : null,

                                    goodForDate: isCurrentCafeDraft
                                        ? draft.goodForDate
                                        : null,
                                })
                            }
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
                                !canSubmit && styles.submitButtonDisabled,
                            ]}
                            disabled={!canSubmit}
                            onPress={handleSubmit}
                        >
                            <Text style={styles.submitButtonText}>
                                Publicar reseña
                            </Text>
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
});