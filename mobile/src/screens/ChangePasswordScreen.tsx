import {
    ActivityIndicator,
    Alert,
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

import { useAuth } from '../context/AuthContext';

export default function ChangePasswordScreen()
{
    const {
        changeProfilePassword,
    } = useAuth();

    const [currentPassword, setCurrentPassword] =
        useState('');

    const [newPassword, setNewPassword] =
        useState('');

    const [confirmPassword, setConfirmPassword] =
        useState('');

    const [showCurrentPassword, setShowCurrentPassword] =
        useState(false);

    const [showNewPassword, setShowNewPassword] =
        useState(false);

    const [showConfirmPassword, setShowConfirmPassword] =
        useState(false);

    const [saving, setSaving] =
        useState(false);

    async function handleChangePassword()
    {
        if (
            !currentPassword ||
            !newPassword ||
            !confirmPassword
        )
        {
            Alert.alert(
                'Datos incompletos',
                'Completá todos los campos.'
            );

            return;
        }

        if (newPassword.length < 8)
        {
            Alert.alert(
                'Contraseña inválida',
                'La nueva contraseña debe tener al menos 8 caracteres.'
            );

            return;
        }

        if (newPassword !== confirmPassword)
        {
            Alert.alert(
                'Las contraseñas no coinciden',
                'Repetí correctamente la nueva contraseña.'
            );

            return;
        }

        if (currentPassword === newPassword)
        {
            Alert.alert(
                'Contraseña inválida',
                'La nueva contraseña debe ser diferente a la actual.'
            );

            return;
        }

        try
        {
            setSaving(true);

            await changeProfilePassword(
                currentPassword,
                newPassword
            );

            setCurrentPassword('');
            setNewPassword('');
            setConfirmPassword('');

            Alert.alert(
                'Contraseña actualizada',
                'Tu contraseña se actualizó correctamente.'
            );
        }
        catch (error)
        {
            Alert.alert(
                'No se pudo cambiar la contraseña',
                error instanceof Error
                    ? error.message
                    : 'Ocurrió un error inesperado.'
            );
        }
        finally
        {
            setSaving(false);
        }
    }

    return (
        <SafeAreaView
            style={styles.container}
            edges={['left', 'right']}
        >
            <ScrollView
                contentContainerStyle={styles.content}
                keyboardShouldPersistTaps="handled"
            >
                <Text style={styles.description}>
                    Ingresá tu contraseña actual y elegí una nueva
                    contraseña de al menos 8 caracteres.
                </Text>

                <Text style={styles.label}>
                    Contraseña actual
                </Text>

                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.input}
                        value={currentPassword}
                        onChangeText={setCurrentPassword}
                        secureTextEntry={!showCurrentPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() =>
                            setShowCurrentPassword(
                                (value) => !value
                            )
                        }
                    >
                        <Ionicons
                            name={
                                showCurrentPassword
                                    ? 'eye-off-outline'
                                    : 'eye-outline'
                            }
                            size={22}
                            color="#7A6254"
                        />
                    </TouchableOpacity>
                </View>

                <Text style={styles.label}>
                    Nueva contraseña
                </Text>

                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.input}
                        value={newPassword}
                        onChangeText={setNewPassword}
                        secureTextEntry={!showNewPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() =>
                            setShowNewPassword(
                                (value) => !value
                            )
                        }
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

                <Text style={styles.label}>
                    Repetir nueva contraseña
                </Text>

                <View style={styles.passwordContainer}>
                    <TextInput
                        style={styles.input}
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        autoCorrect={false}
                    />

                    <TouchableOpacity
                        style={styles.eyeButton}
                        onPress={() =>
                            setShowConfirmPassword(
                                (value) => !value
                            )
                        }
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

                <TouchableOpacity
                    style={[
                        styles.button,
                        saving && styles.buttonDisabled,
                    ]}
                    disabled={saving}
                    onPress={handleChangePassword}
                >
                    {saving
                        ? (
                            <ActivityIndicator
                                color="#FFFFFF"
                            />
                        )
                        : (
                            <Text style={styles.buttonText}>
                                Cambiar contraseña
                            </Text>
                        )
                    }
                </TouchableOpacity>
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
        paddingHorizontal: 20,
        paddingTop: 20,
        paddingBottom: 30,
    },

    description: {
        marginBottom: 24,
        fontSize: 15,
        lineHeight: 22,
        color: '#7A6254',
    },

    label: {
        marginBottom: 7,
        fontSize: 14,
        fontWeight: '600',
        color: '#4A2416',
    },

    passwordContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 18,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 12,
    },

    input: {
        flex: 1,
        paddingHorizontal: 14,
        paddingVertical: 13,
        fontSize: 16,
        color: '#4A2416',
    },

    eyeButton: {
        paddingHorizontal: 14,
        paddingVertical: 12,
    },

    button: {
        marginTop: 10,
        minHeight: 50,
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#6B3A22',
        borderRadius: 14,
    },

    buttonDisabled: {
        opacity: 0.6,
    },

    buttonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '600',
    },
});