import {
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';

import { useAuth } from '../context/AuthContext';
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
                        {user.avatarUrl ? (
                            <Image
                                source={{ uri: user.avatarUrl }}
                                style={styles.avatar}
                                accessibilityLabel="Tu foto de perfil"
                            />
                        ) : (
                            <View style={[styles.avatar, styles.avatarFallback]}>
                                <Text style={styles.avatarInitial}>
                                    {user.name.trim().charAt(0).toUpperCase()}
                                </Text>
                            </View>
                        )}

                        <View style={styles.userInfo}>
                            <Text style={styles.name} numberOfLines={1}>
                                {user.name}
                            </Text>

                            <Text style={styles.email} numberOfLines={1}>
                                {user.email}
                            </Text>
                        </View>
                    </View>

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
        padding: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
    },

    avatar: {
        width: 56,
        height: 56,
        borderRadius: 28,
    },

    avatarFallback: {
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#F3E4C8',
    },

    avatarInitial: {
        fontSize: 22,
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