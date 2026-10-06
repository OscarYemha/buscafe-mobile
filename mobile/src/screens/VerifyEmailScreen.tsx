import {
    ActivityIndicator,
    KeyboardAvoidingView,
    Platform,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { useState } from 'react';
import { SafeAreaView } from 'react-native-safe-area-context';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { resendVerificationEmail } from '../services/api';
import { RootStackParamlist } from '../navigation/AppNavigator';

type Props =
    NativeStackScreenProps<
        RootStackParamlist,
        'VerifyEmail'
    >;

export default function VerifyEmailScreen({
    navigation,
    route,
}: Props)
{
    const { email } = route.params;
    const { verify } = useAuth();

    const [code, setCode] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [message, setMessage] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleVerify = async () => {
        if (!/^\d{6}$/.test(code))
        {
            setError(
                'Ingresá el código de 6 dígitos'
            );

            return;
        }

        try
        {
            setError(null);
            setMessage(null);
            setIsLoading(true);

            await verify(
                email,
                code
            );

            navigation.popToTop();
        }
        catch (error)
        {
            setCode('');

            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo verificar el email'
            );
        }
        finally
        {
            setIsLoading(false);
        }
    };

    const handleResend = async () => {
        try
        {
            setError(null);
            setMessage(null);
            setIsLoading(true);

            await resendVerificationEmail(
                email
            );

            setMessage(
                'Te enviamos un nuevo código de verificación'
            );
        }
        catch (error)
        {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo reenviar el código'
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
                <View style={styles.content}>
                    <Text style={styles.title}>
                        Verificá tu email
                    </Text>

                    <Text style={styles.description}>
                        Enviamos un código de 6 dígitos a {email}.
                    </Text>

                    <TextInput
                        style={styles.input}
                        placeholder="Código de 6 dígitos"
                        placeholderTextColor="#9A8578"
                        value={code}
                        onChangeText={setCode}
                        keyboardType="number-pad"
                        maxLength={6}
                    />

                    {error && (
                        <Text style={styles.error}>
                            {error}
                        </Text>
                    )}
                    {message && (
                        <Text style={styles.message}>
                            {message}
                        </Text>
                    )}

                    <TouchableOpacity
                        style={[
                            styles.verifyButton,
                            isLoading &&
                                styles.buttonDisabled,
                        ]}
                        onPress={handleVerify}
                        disabled={isLoading}
                    >
                        {isLoading ? (
                            <ActivityIndicator />
                        ) : (
                            <Text style={styles.verifyButtonText}>
                                Verificar email
                            </Text>
                        )}
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={styles.resendButton}
                        onPress={handleResend}
                        disabled={isLoading}
                    >
                        <Text style={styles.resendButtonText}>
                            Reenviar código
                        </Text>
                    </TouchableOpacity>
                </View>
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
        fontSize: 15,
        color: '#7A6254',
    },

    input: {
        marginTop: 24,
        paddingHorizontal: 14,
        paddingVertical: 13,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
        fontSize: 18,
        color: '#4A2416',
        textAlign: 'center',
        letterSpacing: 4,
    },

    error: {
        marginTop: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#FDECEA',
        borderWidth: 1,
        borderColor: '#E7B8B1',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: '600',
        color: '#A33A2B',
    },

    verifyButton: {
        marginTop: 18,
        backgroundColor: '#6B3A22',
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
    },

    buttonDisabled: {
        opacity: 0.5,
    },

    verifyButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    resendButton: {
        marginTop: 14,
        alignItems: 'center',
        paddingVertical: 8,
    },

    resendButtonText: {
        color: '#6B3A22',
        fontSize: 14,
        fontWeight: '600',
    },

    message: {
        marginTop: 14,
        paddingHorizontal: 14,
        paddingVertical: 12,
        backgroundColor: '#EDF5E8',
        borderWidth: 1,
        borderColor: '#BDD1B0',
        borderRadius: 10,
        fontSize: 14,
        fontWeight: '600',
        color: '#3F5D2F',
    },
});