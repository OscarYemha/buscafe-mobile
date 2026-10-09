import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { RootStackParamlist } from '../navigation/AppNavigator';
import { useAuth } from '../context/AuthContext';

type Props =
    NativeStackScreenProps<
        RootStackParamlist,
        'Register'
    >;

const isValidEmail = (email: string): boolean => {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
};

export default function RegisterScreen({
    navigation,
    route,
}: Props)
{
    const returnTo = route.params?.returnTo;
    const { register } = useAuth();

    const [name, setName] = useState('');
    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleRegister = async () => {
        if (
            name.trim() === '' ||
            email.trim() === '' ||
            password === ''
        )
        {
            setError(
                'Completá todos los campos'
            );

            return;
        }

        if (!isValidEmail(email.trim()))
        {
            setError(
                'Ingresá un email válido'
            );

            return;
        }

        if (password.trim().length < 8)
        {
            setError(
                'La contraseña debe tener al menos 8 caracteres'
            );

            return;
        }

        try
        {
            setError(null);
            setIsLoading(true);

            await register(
                name.trim(),
                email.trim(),
                password
            );

            navigation.replace(
                'VerifyEmail',
                {
                    email: email.trim().toLowerCase(),
                    returnTo,
                }
            );
        }
        catch (error)
        {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo crear la cuenta'
            );
        }
        finally
        {
            setIsLoading(false);
        }
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
                    contentContainerStyle={styles.content}
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.content}>
                        <Text style={styles.title}>
                            Crear cuenta
                        </Text>

                        <Text style={styles.description}>
                            Registrate para guardar tus cafés favoritos y compartir reseñas.
                        </Text>

                        <TextInput
                            style={styles.input}
                            placeholder="Nombre"
                            placeholderTextColor="#9A8578"
                            value={name}
                            onChangeText={setName}
                            editable={!isLoading}
                        />

                        <TextInput
                            style={styles.input}
                            placeholder="Email"
                            placeholderTextColor="#9A8578"
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            autoCorrect={false}
                            keyboardType="email-address"
                            editable={!isLoading}
                        />

                        <View style={styles.passwordContainer}>
                            <TextInput
                                style={styles.passwordInput}
                                placeholder="Contraseña"
                                placeholderTextColor="#9A8578"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry={!showPassword}
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />

                            <TouchableOpacity
                                style={styles.eyeButton}
                                onPress={() =>
                                    setShowPassword(
                                        (value) => !value
                                    )
                                }
                                disabled={isLoading}
                            >
                                <Ionicons
                                    name={
                                        showPassword
                                            ? 'eye-off-outline'
                                            : 'eye-outline'
                                    }
                                    size={22}
                                    color="#7A6254"
                                />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.passwordHint}>
                            Mínimo 8 caracteres. Para mayor seguridad, combiná letras, números y símbolos.
                        </Text>

                        {error && (
                            <Text style={styles.error}>
                                {error}
                            </Text>
                        )}

                        <TouchableOpacity
                            style={[
                                styles.registerButton,
                                isLoading &&
                                    styles.buttonDisabled,
                            ]}
                            onPress={handleRegister}
                            disabled={isLoading}
                        >
                            {isLoading ? (
                                <ActivityIndicator />
                            ) : (
                                <Text style={styles.registerButtonText}>
                                    Crear cuenta
                                </Text>
                            )}
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={styles.loginLink}
                            onPress={() =>
                                navigation.replace('Login', {
                                    returnTo,
                                })
                            }
                            disabled={isLoading}
                        >
                            <Text style={styles.loginLinkText}>
                                ¿Ya tenés cuenta? Iniciá sesión
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
    },

    content: {
        flex: 1,
        paddingHorizontal: 20,
        justifyContent: 'center',
        paddingBottom: 20,
    },

    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#4A2416',
    },

    description: {
        marginTop: 8,
        marginBottom: 28,
        fontSize: 15,
        color: '#7A6254',
    },

    input: {
        marginBottom: 14,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
        fontSize: 15,
        color: '#4A2416',
    },

    error: {
        marginBottom: 14,
        fontSize: 14,
        color: '#A33A2B',
    },

    registerButton: {
        marginTop: 8,
        backgroundColor: '#6B3A22',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },

    buttonDisabled: {
        opacity: 0.5,
    },

    registerButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    loginLink: {
        marginTop: 20,
        alignItems: 'center',
        paddingVertical: 8,
    },

    loginLinkText: {
        color: '#6B3A22',
        fontSize: 14,
        fontWeight: '600',
    },

    passwordHint: {
        marginTop: -6,
        marginBottom: 14,
        paddingHorizontal: 2,
        fontSize: 12,
        lineHeight: 17,
        color: '#7A6254',
    },

    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
        marginBottom: 14,
    },

    passwordInput: {
        flex: 1,
        paddingLeft: 14,
        paddingVertical: 13,
        fontSize: 15,
        color: '#4A2416',
    },

    eyeButton: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },
});