import {
    Alert,
    Image,
    ScrollView,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useState } from 'react';
import { useAuth } from '../context/AuthContext';
import * as ImagePicker from 'expo-image-picker';
import { useNavigation } from '@react-navigation/native';
import { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { AccountStackParamList } from '../navigation/AppNavigator';

type EditProfileNavigation =
    NativeStackNavigationProp<
        AccountStackParamList,
        'EditProfile'
    >;

export default function EditProfileScreen()
{
    const navigation =
    useNavigation<EditProfileNavigation>();

    const {
        user,
        requestProfileEmailChange,
        verifyProfileEmailChange,
        updateAvatar,
        updateProfileName,
    } = useAuth();

    const [name, setName] =
        useState(user?.name ?? '');

    const [email, setEmail] =
        useState(user?.email ?? '');

    const [selectedImageUri, setSelectedImageUri] =
        useState<string | null>(null);

    const [isSaving, setIsSaving] =
        useState(false);

    const [saveSuccess, setSaveSuccess] =
        useState(false);

    const [isRequestingEmailChange, setIsRequestingEmailChange] =
        useState(false);

    const [emailChangeRequested, setEmailChangeRequested] =
        useState(false);

    const [emailCodeSent, setEmailCodeSent] =
        useState(false);

    const [emailChangeSuccess, setEmailChangeSuccess] =
        useState(false);

    const [verificationCode, setVerificationCode] =
        useState('');

    if (!user)
    {
        return null;
    }

    const initial =
        user.name
            .trim()
            .charAt(0)
            .toUpperCase();

    const pickImage = async () =>
    {
        const permissionResult =
            await ImagePicker.requestMediaLibraryPermissionsAsync();

        if (!permissionResult.granted)
        {
            return;
        }

        const result =
            await ImagePicker.launchImageLibraryAsync({
                mediaTypes: ['images'],
                allowsEditing: true,
                aspect: [1, 1],
                quality: 0.8,
            });

        if (!result.canceled)
        {
            setSelectedImageUri(
                result.assets[0].uri
            );
        }
    };

    const handleRequestEmailChange = async () =>
    {
        if (!user)
        {
            return;
        }

        const normalizedEmail =
            email.trim().toLowerCase();

        if (
            !normalizedEmail ||
            normalizedEmail ===
                user.email.toLowerCase()
        )
        {
            return;
        }

        try
        {
            setIsRequestingEmailChange(true);

            await requestProfileEmailChange(
                normalizedEmail
            );

            setEmailChangeRequested(true);
            setVerificationCode('');

            setEmailCodeSent(true);

            setTimeout(() => {
                setEmailCodeSent(false);
            }, 3000);
        }
        catch (error)
        {
            console.error(
                'ERROR SOLICITANDO CAMBIO DE EMAIL:',
                error
            );

            Alert.alert(
                'No se pudo solicitar el cambio de email',
                error instanceof Error
                    ? error.message
                    : 'Ocurrió un error inesperado. Intentá nuevamente.'
            );
        }
        finally
        {
            setIsRequestingEmailChange(false);
        }
    };

    const handleVerifyEmailChange = async () =>
    {
        const normalizedCode =
            verificationCode.trim();

        if (!/^\d{6}$/.test(normalizedCode))
        {
            return;
        }

        try
        {
            setIsSaving(true);

            await verifyProfileEmailChange(
                normalizedCode
            );

            setEmailChangeRequested(false);
            setVerificationCode('');

            setEmailChangeSuccess(true);

            setTimeout(() => {
                setEmailChangeSuccess(false);
                navigation.popToTop();
            }, 2000);
        }
        catch (error)
        {
            console.error(
                'ERROR VERIFICANDO CAMBIO DE EMAIL:',
                error
            );

            Alert.alert(
                'No se pudo verificar el nuevo email',
                error instanceof Error
                    ? error.message
                    : 'Ocurrió un error inesperado. Intentá nuevamente.'
            );
        }
        finally
        {
            setIsSaving(false);
        }
    };

    const handleSave = async () =>
    {
        if (!user)
        {
            return;
        }

        const normalizedName =
            name.trim();

        const nameChanged =
            normalizedName !== user.name;

        const avatarChanged =
            selectedImageUri !== null;

        if (!nameChanged && !avatarChanged)
        {
            return;
        }

        try
        {
            setIsSaving(true);

            if (nameChanged)
            {
                await updateProfileName(
                    normalizedName
                );
            }

            if (avatarChanged)
            {
                await updateAvatar(
                    selectedImageUri
                );

                setSelectedImageUri(null);
            }

            setSaveSuccess(true);

            setTimeout(() => {
                setSaveSuccess(false);
                navigation.popToTop();
            }, 2000);
        }
        catch (error)
        {
            console.error(
                'ERROR ACTUALIZANDO PERFIL:',
                error
            );

            Alert.alert(
                'No se pudieron guardar todos los cambios',
                error instanceof Error
                    ? error.message
                    : 'Ocurrió un error inesperado. Intentá nuevamente.'
            );
        }
        finally
        {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView
            style={styles.container}
            edges={['left', 'right', 'bottom']}
        >
            <ScrollView
                contentContainerStyle={styles.scrollContent}
                keyboardShouldPersistTaps="handled"
                showsVerticalScrollIndicator={false}
            >
                <View style={styles.content}>
                    <View style={styles.avatarContainer}>
                        {selectedImageUri || user.avatarUrl ? (
                            <Image
                                source={{
                                    uri:
                                        selectedImageUri ??
                                        user.avatarUrl!,
                                }}
                                style={styles.avatar}
                            />
                        ) : (
                            <View style={styles.avatarFallback}>
                                <Text style={styles.avatarInitial}>
                                    {initial}
                                </Text>
                            </View>
                        )}

                        <TouchableOpacity
                            style={styles.changePhotoButton}
                            onPress={pickImage}
                            activeOpacity={0.7}
                        >
                            <Text style={styles.changePhotoText}>
                            {selectedImageUri || user.avatarUrl
                                ? 'Cambiar foto'
                                : 'Agregar foto'}
                            </Text>
                        </TouchableOpacity>
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>
                            Nombre
                        </Text>

                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            autoCapitalize="words"
                        />
                    </View>

                    <View style={styles.field}>
                        <Text style={styles.label}>
                            Email
                        </Text>

                        <TextInput
                            style={styles.input}
                            value={email}
                            onChangeText={setEmail}
                            autoCapitalize="none"
                            keyboardType="email-address"
                        />

                        {user &&
                            email.trim().toLowerCase() !==
                                user.email.toLowerCase() &&
                            !emailChangeRequested && (
                                <TouchableOpacity
                                    style={styles.verifyEmailButton}
                                    onPress={handleRequestEmailChange}
                                    disabled={isRequestingEmailChange}
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.verifyEmailButtonText}>
                                        {isRequestingEmailChange
                                            ? 'Enviando código...'
                                            : 'Verificar nuevo email'}
                                    </Text>
                                </TouchableOpacity>
                            )}

                        {emailCodeSent && (
                            <Text style={styles.successText}>
                                ✓ Código enviado al nuevo email
                            </Text>
                        )}

                        {emailChangeRequested && (
                            <View style={styles.emailVerificationContainer}>
                                <Text style={styles.emailVerificationText}>
                                    Ingresá el código de 6 dígitos que enviamos a:
                                </Text>

                                <Text style={styles.pendingEmailText}>
                                    {email.trim().toLowerCase()}
                                </Text>

                                <TextInput
                                    style={styles.input}
                                    value={verificationCode}
                                    onChangeText={setVerificationCode}
                                    placeholder="Código de 6 dígitos"
                                    keyboardType="number-pad"
                                    maxLength={6}
                                />

                                <TouchableOpacity
                                    style={styles.confirmEmailButton}
                                    onPress={handleVerifyEmailChange}
                                    disabled={
                                        isSaving ||
                                        verificationCode.trim().length !== 6
                                    }
                                    activeOpacity={0.7}
                                >
                                    <Text style={styles.confirmEmailButtonText}>
                                        {isSaving
                                            ? 'Verificando...'
                                            : 'Confirmar email'}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}

                        {emailChangeSuccess && (
                            <Text style={styles.successText}>
                                ✓ Email actualizado correctamente
                                {'\n'}Redirigiendo a Mi cuenta...
                            </Text>
                        )}
                    </View>

                    {!emailChangeRequested && (
                        <TouchableOpacity
                            style={styles.saveButton}
                            onPress={handleSave}
                            disabled={isSaving}
                        >
                            <Text style={styles.saveButtonText}>
                                {isSaving
                                    ? 'Guardando...'
                                    : 'Guardar cambios'}
                            </Text>
                        </TouchableOpacity>
                    )}
                    {saveSuccess && (
                        <Text style={styles.successText}>
                            ✓ Cambios guardados correctamente
                            {'\n'}Redirigiendo a Mi cuenta...
                        </Text>
                    )}
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
        paddingTop: 24,
    },

    scrollContent: {
        flexGrow: 1,
        paddingBottom: 24,
    },

    avatarContainer: {
        alignItems: 'center',
        marginBottom: 30,
    },

    avatar: {
        width: 110,
        height: 110,
        borderRadius: 55,
    },

    avatarFallback: {
        width: 110,
        height: 110,
        borderRadius: 55,
        backgroundColor: '#F8EFE7',
        borderWidth: 1,
        borderColor: '#D8C2B0',
        alignItems: 'center',
        justifyContent: 'center',
    },

    avatarInitial: {
        fontSize: 42,
        fontWeight: '700',
        color: '#6B3A22',
    },

    changePhotoButton: {
        marginTop: 12,
        paddingVertical: 6,
        paddingHorizontal: 12,
    },

    changePhotoText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#6B3A22',
    },

    field: {
        marginBottom: 18,
    },

    label: {
        marginBottom: 7,
        fontSize: 14,
        fontWeight: '600',
        color: '#4A2416',
    },

    input: {
        height: 48,
        paddingHorizontal: 14,
        backgroundColor: '#FFFFFF',
        borderWidth: 1,
        borderColor: '#E2D4C3',
        borderRadius: 12,
        fontSize: 16,
        color: '#4A2416',
    },

    saveButton: {
        marginTop: 8,
        paddingVertical: 14,
        borderRadius: 14,
        backgroundColor: '#6B3A22',
        alignItems: 'center',
    },

    saveButtonText: {
        fontSize: 16,
        fontWeight: '600',
        color: '#FFFFFF',
    },

    successText: {
        marginTop: 12,
        textAlign: 'center',
        fontSize: 14,
        fontWeight: '600',
        color: '#2E7D32',
    },

    verifyEmailButton: {
        marginTop: 10,
        alignSelf: 'center',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 18,
        borderRadius: 8,
        backgroundColor: '#6B3A22',
    },

    verifyEmailButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },

    emailVerificationContainer: {
        marginTop: 12,
        padding: 14,
        borderRadius: 10,
        backgroundColor: '#F8F1E9',
        borderWidth: 1,
        borderColor: '#E8D9C7',
    },

    emailVerificationText: {
        fontSize: 13,
        color: '#7A6254',
    },

    pendingEmailText: {
        marginTop: 4,
        marginBottom: 10,
        fontSize: 14,
        fontWeight: '600',
        color: '#4A2416',
    },

    confirmEmailButton: {
        marginTop: 10,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 8,
        backgroundColor: '#6B3A22',
        alignSelf: 'center',
        paddingHorizontal: 18,
    },

    confirmEmailButtonText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#FFFFFF',
    },
});