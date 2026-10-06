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
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamlist } from '../navigation/AppNavigator';
import { requestPasswordReset } from '../services/api';

type Props =
    NativeStackScreenProps<
        RootStackParamlist,
        'ForgotPassword'
    >;

export default function ForgotPasswordScreen(
    { navigation, route }: Props
) {
    const [email, setEmail] =
        useState(route.params?.email ?? '');

    const [error, setError] =
        useState<string | null>(null);

    const [isLoading, setIsLoading] =
        useState(false);

    const handleContinue = async () => {
        const normalizedEmail =
            email.trim().toLowerCase();

        if (normalizedEmail === '')
        {
            setError('Ingresá tu email');
            return;
        }

        try
        {
            setError(null);
            setIsLoading(true);

            await requestPasswordReset(
                normalizedEmail
            );

            navigation.navigate(
                'ResetPassword',
                {
                    email: normalizedEmail,
                }
            );
        }
        catch (error)
        {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo iniciar la recuperación de contraseña'
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
                            Recuperar contraseña
                        </Text>

                        <Text style={styles.description}>
                            Ingresá el email de tu cuenta.
                            Te enviaremos un código para
                            restablecer tu contraseña.
                        </Text>

                        <View style={styles.form}>
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
                                onPress={handleContinue}
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
                                        Enviar código
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