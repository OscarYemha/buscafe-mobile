import {
    Image,
    Modal,
    Pressable,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { useCallback, useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
import { getMyReviews } from '../services/api';
import {
    AccountStackParamList,
    RootStackParamlist,
} from '../navigation/AppNavigator';
import { Ionicons } from '@expo/vector-icons';

type AccountNavigation =
    NativeStackNavigationProp<
        AccountStackParamList
    > &
    NativeStackNavigationProp<
        RootStackParamlist
    >;

export default function AccountScreen()
{
    const {
        user,
        logout,
    } = useAuth();

    // Ver la foto de perfil en grande.
    const [isAvatarOpen, setIsAvatarOpen] = useState(false);

    // Cantidad de reseñas escritas: se actualiza cada vez que se vuelve a la
    // pantalla (por ejemplo, después de publicar una reseña).
    const [reviewsCount, setReviewsCount] = useState<number | null>(null);

    useFocusEffect(
        useCallback(() => {
            if (!user)
            {
                setReviewsCount(null);
                return;
            }

            let active = true;

            getMyReviews()
                .then((reviews) => {
                    if (active)
                    {
                        setReviewsCount(reviews.length);
                    }
                })
                .catch(() => {
                    // Si falla, simplemente no se muestra la cantidad.
                });

            return () => {
                active = false;
            };
        }, [user])
    );

    const navigation =
        useNavigation<AccountNavigation>();

    if (!user)
    {
        return (
            <SafeAreaView
                style={styles.container}
                edges={['left', 'right']}
            >
                <ScrollView
                    contentContainerStyle={styles.scrollContent}
                    showsVerticalScrollIndicator={false}
                >
                    <View style={styles.content}>
                        <Text style={styles.title}>
                            Mi cuenta
                        </Text>

                        <Text style={styles.description}>
                            Iniciá sesión para guardar tus cafeterías
                            favoritas, publicar reseñas y acceder a tu
                            perfil.
                        </Text>

                        <TouchableOpacity
                            style={styles.primaryButton}
                            onPress={() =>
                                navigation.navigate('Login', {
                                    returnTo: 'Home',
                                })
                            }
                        >
                            <Text style={styles.primaryButtonText}>
                                Iniciar sesión
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.registerButton}
                            onPress={() =>
                                navigation.navigate('Register')
                            }
                        >
                            <Text style={styles.registerButtonText}>
                                Crear cuenta
                            </Text>
                        </TouchableOpacity>
                    </View>
                </ScrollView>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView
                style={styles.container}
                edges={['left', 'right']}
            >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.content}>
                    <Text style={styles.title}>
                        Mi cuenta
                    </Text>

                    <View style={styles.userCard}>
                        <View style={styles.userInfo}>
                            <Text style={styles.name} numberOfLines={1}>
                                {user.name}
                            </Text>

                            <Text style={styles.email} numberOfLines={1}>
                                {user.email}
                            </Text>

                            {reviewsCount !== null && reviewsCount > 0 && (
                                <Text style={styles.reviewsCount}>
                                    {reviewsCount === 1
                                        ? '1 reseña escrita'
                                        : `${reviewsCount} reseñas escritas`}
                                </Text>
                            )}
                        </View>

                        {user.avatarUrl ? (
                            <TouchableOpacity
                                onPress={() => setIsAvatarOpen(true)}
                                activeOpacity={0.8}
                                accessibilityRole="imagebutton"
                                accessibilityLabel="Ver tu foto de perfil en grande"
                            >
                                <Image
                                    source={{ uri: user.avatarUrl }}
                                    style={styles.avatar}
                                />
                            </TouchableOpacity>
                        ) : (
                            <View style={[styles.avatar, styles.avatarFallback]}>
                                <Text style={styles.avatarInitial}>
                                    {user.name.trim().charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}
                    </View>

                    {user.avatarUrl && (
                        <Modal
                            visible={isAvatarOpen}
                            transparent
                            animationType="fade"
                            statusBarTranslucent
                            onRequestClose={() => setIsAvatarOpen(false)}
                        >
                            <Pressable
                                style={styles.avatarViewer}
                                onPress={() => setIsAvatarOpen(false)}
                                accessibilityLabel="Cerrar la foto"
                            >
                                <Image
                                    source={{ uri: user.avatarUrl }}
                                    style={styles.avatarLarge}
                                    resizeMode="contain"
                                />

                                <View style={styles.avatarViewerClose}>
                                    <Ionicons name="close" size={28} color="#FFFFFF" />
                                </View>
                            </Pressable>
                        </Modal>
                    )}

                    <View style={styles.section}>
                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                navigation.navigate('EditProfile');
                            }}
                        >
                            <Ionicons
                                name="person-outline"
                                size={24}
                                color="#6B3A22"
                                style={styles.menuIcon}
                            />

                            <Text style={styles.menuText}>
                                Editar perfil
                            </Text>

                            <Text style={styles.chevron}>
                                ›
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                navigation.navigate('ChangePassword');
                            }}
                        >
                            <Ionicons
                                name="lock-closed-outline"
                                size={24}
                                color="#6B3A22"
                                style={styles.menuIcon}
                            />

                            <Text style={styles.menuText}>
                                Cambiar contraseña
                            </Text>

                            <Text style={styles.chevron}>
                                ›
                            </Text>
                        </TouchableOpacity>

                        <View style={styles.menuDivider} />

                        <TouchableOpacity
                            style={styles.menuItem}
                            onPress={() => {
                                navigation.navigate('MyReviews');
                            }}
                        >
                            <Ionicons
                                name="star-outline"
                                size={24}
                                color="#6B3A22"
                                style={styles.menuIcon}
                            />

                            <Text style={styles.menuText}>
                                Mis reseñas
                            </Text>

                            <Text style={styles.chevron}>
                                ›
                            </Text>
                        </TouchableOpacity>

                    </View>

                    <TouchableOpacity
                        style={styles.logoutButton}
                        onPress={logout}
                    >
                        <Text style={styles.logoutButtonText}>
                            Cerrar sesión
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.deleteAccountButton}
                        onPress={() => {
                            navigation.navigate('DeleteAccount');
                        }}
                    >
                        <Ionicons
                            name="trash-outline"
                            size={22}
                            color="#FFFFFF"
                        />

                        <Text style={styles.deleteAccountButtonText}>
                            Eliminar cuenta
                        </Text>
                    </TouchableOpacity>
                </View>
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
        flex: 1,
        paddingHorizontal: 20,
        paddingTop: 20,
    },

    scrollContent: {
        flexGrow: 1,
        paddingBottom: 24,
    },

    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#4A2416',
    },

    description: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 22,
        color: '#7A6254',
    },

    userCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
        marginTop: 28,
        paddingHorizontal: 18,
        // 4 menos que antes arriba y abajo: compensa la foto de 64 (era 56).
        paddingVertical: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
    },

    avatar: {
        width: 64,
        height: 64,
        borderRadius: 32,
    },

    avatarViewer: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: 'rgba(0, 0, 0, 0.92)',
        padding: 20,
    },

    avatarLarge: {
        width: '100%',
        aspectRatio: 1,
        borderRadius: 16,
    },

    avatarViewerClose: {
        position: 'absolute',
        top: 48,
        right: 20,
    },

    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3E4C8',
    },

    avatarInitial: {
        fontSize: 25,
        fontWeight: '700',
        color: '#6B3A22',
    },

    userInfo: {
        flex: 1,
    },

    name: {
        fontSize: 19,
        fontWeight: '700',
        color: '#4A2416',
    },

    email: {
        marginTop: 6,
        fontSize: 15,
        color: '#7A6254',
    },

    reviewsCount: {
        marginTop: 4,
        fontSize: 13,
        fontWeight: '600',
        color: '#6B3A22',
    },

    section: {
        marginTop: 20,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
        overflow: 'hidden',
    },

    menuItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },

    menuIcon: {
        width: 28,
        marginRight: 6,
    },

    menuText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '600',
        color: '#4A2416',
    },

    chevron: {
        fontSize: 26,
        color: '#9A8578',
    },

    primaryButton: {
        marginTop: 28,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: '#6B3A22',
    },

    primaryButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    registerButton: {
        marginTop: 12,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        borderWidth: 1,
        borderColor: '#6B3A22',
    },

    registerButtonText: {
        color: '#6B3A22',
        fontSize: 16,
        fontWeight: '600',
    },

    logoutButton: {
        marginTop: 28,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: '#6B3A22',
    },

    logoutButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    menuDivider: {
        height: 1,
        backgroundColor: '#E8D9C7',
    },

    deleteAccountButton: {
        marginTop: 14,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#B3261E',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
    },

    deleteAccountButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});