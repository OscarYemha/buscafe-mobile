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
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamlist } from '../navigation/AppNavigator';
import { confirmPasswordReset } from '../services/api';

type Props =
    NativeStackScreenProps<
        RootStackParamlist,
        'ResetPassword'
    >;

export default function ResetPasswordScreen(
    { navigation, route }: Props
) {
    const { email } = route.params;

    const [code, setCode] = useState('');
    const [newPassword, setNewPassword] =
        useState('');
    const [confirmPassword, setConfirmPassword] =
        useState('');

    const [showNewPassword, setShowNewPassword] =
        useState(false);
    const [
        showConfirmPassword,
        setShowConfirmPassword,
    ] = useState(false);

    const [error, setError] =
        useState<string | null>(null);
    const [isLoading, setIsLoading] =
        useState(false);

    const handleResetPassword = async () => {
        const normalizedCode = code.trim();

        if (
            normalizedCode === '' ||
            newPassword === '' ||
            confirmPassword === ''
        )
        {
            setError(
                'Completá todos los campos'
            );
            return;
        }

        if (!/^\d{6}$/.test(normalizedCode))
        {
            setError(
                'El código debe tener 6 dígitos'
            );
            return;
        }

        if (newPassword.length < 8)
        {
            setError(
                'La contraseña debe tener al menos 8 caracteres'
            );
            return;
        }

        if (newPassword !== confirmPassword)
        {
            setError(
                'Las contraseñas no coinciden'
            );
            return;
        }

        try
        {
            setError(null);
            setIsLoading(true);

            await confirmPasswordReset(
                email,
                normalizedCode,
                newPassword
            );

            Alert.alert(
                'Contraseña restablecida',
                'Ya podés iniciar sesión con tu nueva contraseña.',
                [
                    {
                        text: 'Aceptar',
                        onPress: () => {
                            navigation.reset({
                                index: 0,
                                routes: [
                                    {
                                        name: 'Login',
                                    },
                                ],
                            });
                        },
                    },
                ]
            );
        }
        catch (error)
        {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo restablecer la contraseña'
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
                behavior={
                    Platform.OS === 'ios'
                        ? 'padding'
                        : 'height'
                }
            >
                <ScrollView
                    contentContainerStyle={
                        styles.content
                    }
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.content}>
                        <Text style={styles.title}>
                            Nueva contraseña
                        </Text>

                        <Text style={styles.description}>
                            Ingresá el código que
                            enviamos a {email} y elegí
                            una nueva contraseña.
                        </Text>

                        <View style={styles.form}>
                            <TextInput
                                style={styles.input}
                                placeholder="Código de 6 dígitos"
                                placeholderTextColor="#9A8578"
                                value={code}
                                onChangeText={setCode}
                                keyboardType="number-pad"
                                maxLength={6}
                                editable={!isLoading}
                            />

                            <View
                                style={
                                    styles.passwordContainer
                                }
                            >
                                <TextInput
                                    style={
                                        styles.passwordInput
                                    }
                                    placeholder="Nueva contraseña"
                                    placeholderTextColor="#9A8578"
                                    value={newPassword}
                                    onChangeText={
                                        setNewPassword
                                    }
                                    secureTextEntry={
                                        !showNewPassword
                                    }
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!isLoading}
                                />

                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() =>
                                        setShowNewPassword(
                                            (value) =>
                                                !value
                                        )
                                    }
                                    disabled={isLoading}
                                >
                                    <Ionicons
                                        name={
                                            showNewPassword
                                                ? 'eye-off-outline'
                                                : 'eye-outline'
                                        }
                                        size={22}
                                        color="#7A6254"
                                    />
                                </TouchableOpacity>
                            </View>

                            <View
                                style={
                                    styles.passwordContainer
                                }
                            >
                                <TextInput
                                    style={
                                        styles.passwordInput
                                    }
                                    placeholder="Repetir contraseña"
                                    placeholderTextColor="#9A8578"
                                    value={confirmPassword}
                                    onChangeText={
                                        setConfirmPassword
                                    }
                                    secureTextEntry={
                                        !showConfirmPassword
                                    }
                                    autoCapitalize="none"
                                    autoCorrect={false}
                                    editable={!isLoading}
                                />

                                <TouchableOpacity
                                    style={styles.eyeButton}
                                    onPress={() =>
                                        setShowConfirmPassword(
                                            (value) =>
                                                !value
                                        )
                                    }
                                    disabled={isLoading}
                                >
                                    <Ionicons
                                        name={
                                            showConfirmPassword
                                                ? 'eye-off-outline'
                                                : 'eye-outline'
                                        }
                                        size={22}
                                        color="#7A6254"
                                    />
                                </TouchableOpacity>
                            </View>

                            {error && (
                                <Text style={styles.error}>
                                    {error}
                                </Text>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.button,
                                    isLoading &&
                                        styles.buttonDisabled,
                                ]}
                                onPress={
                                    handleResetPassword
                                }
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator
                                        color="#FFFFFF"
                                    />
                                ) : (
                                    <Text
                                        style={
                                            styles.buttonText
                                        }
                                    >
                                        Restablecer contraseña
                                    </Text>
                                )}
                            </TouchableOpacity>
                        </View>
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
        paddingBottom: 100,
    },

    title: {
        fontSize: 28,
        fontWeight: '700',
        color: '#4A2416',
    },

    description: {
        marginTop: 8,
        fontSize: 15,
        lineHeight: 21,
        color: '#7A6254',
    },

    form: {
        marginTop: 28,
    },

    input: {
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 15,
        color: '#4A2416',
        marginBottom: 14,
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

    error: {
        marginBottom: 14,
        fontSize: 14,
        color: '#A33A2B',
    },

    button: {
        marginTop: 4,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: '#6B3A22',
    },

    buttonDisabled: {
        opacity: 0.4,
    },

    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});