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
import { useAuth } from '../context/AuthContext';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamlist } from '../navigation/AppNavigator';

type Props = NativeStackScreenProps<RootStackParamlist, 'Login'>;

export default function LoginScreen( {navigation}: Props) {
    const { login } = useAuth();

    const [email, setEmail] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState<string | null>(null);
    const [isLoading, setIsLoading] = useState(false);

    const handleLogin = async () => {
        if (
            email.trim() === '' ||
            password === ''
        )
        {
            setError('Ingresá tu email y la contraseña');
            return;
        }

        try
        {
            setError(null);
            setIsLoading(true);

            await login(
                email.trim(),
                password
            );

            navigation.goBack();
        }
        catch (error)
        {
            setError(
                error instanceof Error
                    ? error.message
                    : 'No se pudo iniciar sesión'
            );
        }
        finally
        {
            setIsLoading(false);
        }
    };
    
        return (
        <SafeAreaView style={styles.container}>
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
                            Iniciar sesión
                        </Text>

                        <Text style={styles.description}>
                            Iniciá sesión para continuar en BusCafé.
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

                            <TextInput
                                style={styles.input}
                                placeholder="Contraseña"
                                placeholderTextColor="#9A8578"
                                value={password}
                                onChangeText={setPassword}
                                secureTextEntry
                                autoCapitalize="none"
                                autoCorrect={false}
                                editable={!isLoading}
                            />

                            {error && (
                                <Text style={styles.error}>
                                    {error}
                                </Text>
                            )}

                            <TouchableOpacity
                                style={[
                                    styles.loginButton,
                                    isLoading &&
                                        styles.loginButtonDisabled,
                                ]}
                                onPress={handleLogin}
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <ActivityIndicator
                                        color="#FFFFFF"
                                    />
                                ) : (
                                    <Text style={styles.loginButtonText}>
                                        Iniciar sesión
                                    </Text>
                                )}
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={styles.registerLink}
                                onPress={() =>
                                    navigation.replace('Register')
                                }
                                disabled={isLoading}
                            >
                                <Text style={styles.registerLinkText}>
                                    ¿No tenés cuenta? Registrate
                                </Text>
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

    loginButton: {
        marginTop: 4,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: '#6B3A22',
    },

    loginButtonDisabled: {
        opacity: 0.4,
    },

    loginButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },

    registerLink: {
        marginTop: 20,
        alignItems: 'center',
        paddingVertical: 8,
    },

    registerLinkText: {
        color: '#6B3A22',
        fontSize: 14,
        fontWeight: '600',
    },
});