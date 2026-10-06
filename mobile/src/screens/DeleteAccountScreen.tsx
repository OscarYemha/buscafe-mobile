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

import {
    SafeAreaView,
} from 'react-native-safe-area-context';

import { useState } from 'react';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AccountStackParamList } from '../navigation/AppNavigator';

type DeleteAccountNavigation =
    NativeStackNavigationProp<
        AccountStackParamList,
        'DeleteAccount'
    >;

export default function DeleteAccountScreen()
{
    const {
        deleteProfileAccount,
    } = useAuth();

    const navigation =
        useNavigation<DeleteAccountNavigation>();

    const [password, setPassword] =
        useState('');

    const [showPassword, setShowPassword] =
        useState(false);

    const [isDeleting, setIsDeleting] =
        useState(false);

    const handleDelete = () => {
        if (!password)
        {
            Alert.alert(
                'Cuenta eliminada',
                'Tu cuenta fue eliminada correctamente.',
                [
                    {
                        text: 'Aceptar',
                        onPress: () => {
                            navigation.reset({
                                index: 0,
                                routes: [
                                    {
                                        name: 'AccountHome',
                                    },
                                ],
                            });
                        },
                    },
                ]
            );

            return;
        }

        Alert.alert(
            '¿Eliminar tu cuenta?',
            'Esta acción es permanente y no se puede deshacer.',
            [
                {
                    text: 'Cancelar',
                    style: 'cancel',
                },
                {
                    text: 'Eliminar cuenta',
                    style: 'destructive',
                    onPress: confirmDelete,
                },
            ]
        );
    };

    const confirmDelete = async () => {
        try
        {
            setIsDeleting(true);

            await deleteProfileAccount(
                password
            );

            Alert.alert(
                'Cuenta eliminada',
                'Tu cuenta fue eliminada correctamente.'
            );
        }
        catch (error)
        {
            Alert.alert(
                'No se pudo eliminar la cuenta',
                error instanceof Error
                    ? error.message
                    : 'Ocurrió un error inesperado'
            );
        }
        finally
        {
            setIsDeleting(false);
        }
    };

    return (
        <SafeAreaView
            style={styles.container}
            edges={['left', 'right', 'bottom']}
        >
            <KeyboardAvoidingView
                style={styles.keyboardView}
                behavior={
                    Platform.OS === 'ios'
                        ? 'padding'
                        : undefined
                }
            >
                <ScrollView
                    contentContainerStyle={
                        styles.scrollContent
                    }
                    keyboardShouldPersistTaps="handled"
                >
                    <View style={styles.warningCard}>
                        <Ionicons
                            name="warning-outline"
                            size={32}
                            color="#B3261E"
                        />

                        <Text style={styles.warningTitle}>
                            Eliminar cuenta
                        </Text>

                        <Text style={styles.warningText}>
                            Esta acción es permanente. Tus favoritos
                            se eliminarán y tu cuenta dejará de estar
                            disponible.
                        </Text>

                        <Text style={styles.warningText}>
                            Tus reseñas publicadas podrán conservarse
                            de forma anónima como “Usuario eliminado”.
                        </Text>
                    </View>

                    <Text style={styles.label}>
                        Contraseña actual
                    </Text>

                    <View style={styles.passwordContainer}>
                        <TextInput
                            style={styles.passwordInput}
                            value={password}
                            onChangeText={setPassword}
                            placeholder="Ingresá tu contraseña"
                            secureTextEntry={!showPassword}
                            autoCapitalize="none"
                            editable={!isDeleting}
                        />

                        <TouchableOpacity
                            style={styles.eyeButton}
                            onPress={() =>
                                setShowPassword(
                                    current => !current
                                )
                            }
                            disabled={isDeleting}
                        >
                            <Ionicons
                                name={
                                    showPassword
                                        ? 'eye-off-outline'
                                        : 'eye-outline'
                                }
                                size={22}
                                color="#6B3A22"
                            />
                        </TouchableOpacity>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.deleteButton,
                            isDeleting &&
                                styles.disabledButton,
                        ]}
                        onPress={handleDelete}
                        disabled={isDeleting}
                    >
                        {isDeleting ? (
                            <ActivityIndicator
                                color="#FFFFFF"
                            />
                        ) : (
                            <Text
                                style={
                                    styles.deleteButtonText
                                }
                            >
                                Eliminar mi cuenta
                            </Text>
                        )}
                    </TouchableOpacity>
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

    keyboardView: {
        flex: 1,
    },

    scrollContent: {
        padding: 20,
        paddingBottom: 32,
    },

    warningCard: {
        padding: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
    },

    warningTitle: {
        marginTop: 10,
        fontSize: 20,
        fontWeight: '700',
        color: '#B3261E',
    },

    warningText: {
        marginTop: 10,
        fontSize: 15,
        lineHeight: 22,
        color: '#7A6254',
    },

    label: {
        marginTop: 28,
        marginBottom: 8,
        fontSize: 15,
        fontWeight: '600',
        color: '#4A2416',
    },

    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
    },

    passwordInput: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 14,
        fontSize: 16,
        color: '#4A2416',
    },

    eyeButton: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },

    deleteButton: {
        marginTop: 24,
        paddingVertical: 14,
        borderRadius: 14,
        alignItems: 'center',
        backgroundColor: '#B3261E',
    },

    disabledButton: {
        opacity: 0.6,
    },

    deleteButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});