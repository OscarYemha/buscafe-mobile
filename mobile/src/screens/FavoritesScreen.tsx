import {
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useFavorites } from '../context/FavoritesContext';
import { RootStackParamlist } from '../navigation/AppNavigator';

type RootNavigation = NativeStackNavigationProp<RootStackParamlist>;

export default function FavoritesScreen()
{
    const navigation = useNavigation<RootNavigation>();

    const { favorites, isLoadingFavorites, removeFavorite } = useFavorites();
    
    return (
        <SafeAreaView
            style={styles.container}
            edges={['left', 'right']}
        >
            <ScrollView
                contentContainerStyle={styles.content}
                showsVerticalScrollIndicator={false}
            >
                <Text style={styles.title}>
                    Mis cafés favoritos
                </Text>

                {isLoadingFavorites && (
                    <Text style={styles.message}>
                        Cargando favoritos...
                    </Text>
                )}

                {!isLoadingFavorites &&
                    favorites.length === 0 && (
                        <View style={styles.emptyContainer}>
                            <Text style={styles.emptyIcon}>
                                ♡
                            </Text>

                            <Text style={styles.emptyTitle}>
                                Todavía no guardaste cafés
                            </Text>

                            <Text style={styles.emptyText}>
                                Tocá el corazón de una cafetería
                                para agregarla a tus favoritos.
                            </Text>
                        </View>
                    )}

                {!isLoadingFavorites &&
                    favorites.map((favorite) => (
                        <TouchableOpacity
                            key={favorite.id}
                            style={styles.favoriteCard}
                            activeOpacity={0.8}
                            onPress={() =>
                                navigation.navigate(
                                    'CafeDetail',
                                    {
                                        googlePlaceId:
                                            favorite.cafe.googlePlaceId,
                                    }
                                )
                            }
                        >
                            <View style={styles.cardContent}>
                                <Text
                                    style={styles.cafeName}
                                    numberOfLines={2}
                                >
                                    {favorite.cafe.name}
                                </Text>

                                <Text
                                    style={styles.address}
                                    numberOfLines={2}
                                >
                                    {favorite.cafe.address}
                                </Text>
                            </View>

                            <TouchableOpacity
                                style={styles.favoriteButton}
                                activeOpacity={0.7}
                                onPress={async (event) => {
                                    event.stopPropagation();

                                    try
                                    {
                                        await removeFavorite(
                                            favorite.cafe.googlePlaceId
                                        );
                                    }
                                    catch (error)
                                    {
                                        console.error(
                                            'Error al eliminar favorito:',
                                            error
                                        );
                                    }
                                }}
                            >
                                <Text style={styles.favoriteIcon}>
                                    ♥
                                </Text>
                            </TouchableOpacity>
                        </TouchableOpacity>
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
        paddingTop: 20,
        paddingBottom: 32,
    },

    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#4A2416',
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

    favoriteCard: {
        marginTop: 14,
        padding: 16,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
        flexDirection: 'row',
        alignItems: 'center',
    },

    cardContent: {
        flex: 1,
    },

    cafeName: {
        fontSize: 17,
        fontWeight: '700',
        color: '#4A2416',
    },

    address: {
        marginTop: 6,
        fontSize: 14,
        lineHeight: 19,
        color: '#7A6254',
    },

    favoriteButton: {
        width: 40,
        height: 40,
        marginLeft: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },

    favoriteIcon: {
        fontSize: 28,
        lineHeight: 30,
        color: '#6B3A22',
    },
});