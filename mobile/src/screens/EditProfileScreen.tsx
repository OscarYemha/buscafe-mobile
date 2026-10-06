import {
    Image,
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

export default function EditProfileScreen()
{
    const {
        user,
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
            }, 3000);
        }
        catch (error)
        {
            console.error(
                'ERROR ACTUALIZANDO PERFIL:',
                error
            );
        }
        finally
        {
            setIsSaving(false);
        }
    };

    return (
        <SafeAreaView style={styles.container}>
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
                </View>

                <TouchableOpacity
                    style={styles.saveButton}
                    onPress={handleSave}
                    disabled={isSaving}
                    activeOpacity={0.8}
                >
                    <Text style={styles.saveButtonText}>
                        {isSaving
                            ? 'Guardando...'
                            : 'Guardar cambios'}
                    </Text>
                </TouchableOpacity>
                {saveSuccess && (
                    <Text style={styles.successText}>
                        ✓ Cambios guardados correctamente
                    </Text>
                )}
            </View>
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
});