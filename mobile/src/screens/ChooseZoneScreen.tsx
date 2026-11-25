import { useEffect, useRef, useState } from 'react';
import {
    ActivityIndicator,
    FlatList,
    StyleSheet,
    Text,
    TextInput,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as Crypto from 'expo-crypto';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { RootStackParamlist } from '../navigation/AppNavigator';
import { getZone, searchZones } from '../services/api';
import { useNearbyCafes } from '../context/NearbyCafesContext';
import { useSearchArea } from '../context/SearchAreaContext';
import { ZoneSuggestion } from '../types/Zone';

type Props = NativeStackScreenProps<RootStackParamlist, 'ChooseZone'>;

type Tab = 'nearby' | 'zone';

const MIN_QUERY_LENGTH = 2;
// Espera entre teclas: no consultar a Google por cada letra.
const SEARCH_DEBOUNCE_MS = 400;

/*
 * "Cerca de mí / Elegir zona". Al confirmar, guarda la zona en
 * SearchAreaContext y vuelve atrás: la pantalla anterior (Resultados)
 * se actualiza sola con la zona nueva.
 */
export default function ChooseZoneScreen({ navigation }: Props)
{
    const { searchArea, chooseNearby, chooseZone } = useSearchArea();
    const { userLocation } = useNearbyCafes();

    const [tab, setTab] = useState<Tab>(searchArea.mode === 'zone' ? 'zone' : 'nearby');
    const [query, setQuery] = useState('');
    const [suggestions, setSuggestions] = useState<ZoneSuggestion[]>([]);
    const [searching, setSearching] = useState(false);
    const [selectingId, setSelectingId] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);

    // Un token por búsqueda: Google agrupa las sugerencias con la zona elegida.
    const sessionTokenRef = useRef(Crypto.randomUUID());
    const requestIdRef = useRef(0);

    const trimmedQuery = query.trim();

    useEffect(() =>
    {
        const requestId = ++requestIdRef.current;

        if (trimmedQuery.length < MIN_QUERY_LENGTH)
        {
            setSuggestions([]);
            setSearching(false);
            setError(null);
            return;
        }

        setSearching(true);

        const timer = setTimeout(async () =>
        {
            try
            {
                const results = await searchZones(
                    trimmedQuery,
                    sessionTokenRef.current,
                    userLocation ?? undefined
                );

                if (requestId === requestIdRef.current)
                {
                    setSuggestions(results);
                    setError(null);
                }
            }
            catch (searchError)
            {
                console.error('Error al buscar zonas:', searchError);

                if (requestId === requestIdRef.current)
                {
                    setSuggestions([]);
                    setError('No pudimos buscar zonas. Revisá tu conexión e intentá de nuevo.');
                }
            }
            finally
            {
                if (requestId === requestIdRef.current)
                {
                    setSearching(false);
                }
            }
        }, SEARCH_DEBOUNCE_MS);

        return () => clearTimeout(timer);
        // userLocation queda afuera a propósito: que se actualice la
        // ubicación no tiene que relanzar la búsqueda.
    }, [trimmedQuery]);

    const selectNearby = () =>
    {
        chooseNearby();
        navigation.goBack();
    };

    const selectZone = async (suggestion: ZoneSuggestion) =>
    {
        if (selectingId)
        {
            return;
        }

        setSelectingId(suggestion.placeId);
        setError(null);

        try
        {
            const zone = await getZone(suggestion.placeId, sessionTokenRef.current);

            chooseZone(zone);
            navigation.goBack();
        }
        catch (selectError)
        {
            console.error('Error al elegir la zona:', selectError);
            setError('No pudimos cargar esa zona. Probá de nuevo o elegí otra.');
        }
        finally
        {
            // La sesión de Google termina al pedir el detalle: la próxima búsqueda usa otra.
            sessionTokenRef.current = Crypto.randomUUID();
            setSelectingId(null);
        }
    };

    return (
        <View style={styles.container}>
            <Text style={styles.question}>
                ¿Dónde querés buscar cafeterías?
            </Text>

            <View style={styles.segmented} accessibilityRole="tablist">
                {(['nearby', 'zone'] as const).map((option) => (
                    <TouchableOpacity
                        key={option}
                        style={[styles.segment, tab === option && styles.segmentActive]}
                        onPress={() => setTab(option)}
                        accessibilityRole="tab"
                        accessibilityState={{ selected: tab === option }}
                    >
                        <Text style={[styles.segmentText, tab === option && styles.segmentTextActive]}>
                            {option === 'nearby' ? 'Cerca de mí' : 'Elegir zona'}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {tab === 'nearby' ? (
                <View style={styles.card}>
                    <View style={styles.cardRow}>
                        <Ionicons name="locate" size={22} color="#6B3A22" />

                        <View style={styles.cardTextContainer}>
                            <Text style={styles.cardTitle}>Tu ubicación actual</Text>
                            <Text style={styles.cardText}>
                                {userLocation
                                    ? 'Buscamos cafeterías cerca de donde estás.'
                                    : 'Se usa el GPS del teléfono si le diste permiso a BusCafé.'}
                            </Text>
                        </View>
                    </View>

                    <TouchableOpacity style={styles.primaryButton} onPress={selectNearby}>
                        <Text style={styles.primaryButtonText}>Buscar cerca de mí</Text>
                    </TouchableOpacity>
                </View>
            ) : (
                <View style={styles.zoneContainer}>
                    <View style={styles.searchBox}>
                        <Ionicons name="search" size={18} color="#7A6254" />

                        <TextInput
                            style={styles.searchInput}
                            value={query}
                            onChangeText={setQuery}
                            placeholder="Buscá un barrio o una ciudad"
                            placeholderTextColor="#A8968A"
                            autoFocus
                            autoCorrect={false}
                            returnKeyType="search"
                            maxLength={100}
                        />

                        {searching && <ActivityIndicator size="small" color="#6B3A22" />}

                        {!searching && query.length > 0 && (
                            <TouchableOpacity
                                onPress={() => setQuery('')}
                                accessibilityLabel="Borrar búsqueda"
                                hitSlop={8}
                            >
                                <Ionicons name="close-circle" size={18} color="#A8968A" />
                            </TouchableOpacity>
                        )}
                    </View>

                    {searchArea.mode === 'zone' && trimmedQuery.length < MIN_QUERY_LENGTH && (
                        <Text style={styles.hint}>
                            Zona actual: {searchArea.zone.name}
                        </Text>
                    )}

                    {error && (
                        <View style={styles.errorContainer}>
                            <Text style={styles.error}>{error}</Text>
                        </View>
                    )}

                    <FlatList
                        data={suggestions}
                        keyExtractor={(item) => item.placeId}
                        keyboardShouldPersistTaps="handled"
                        contentContainerStyle={styles.list}
                        renderItem={({ item }) => (
                            <TouchableOpacity
                                style={styles.suggestion}
                                onPress={() => void selectZone(item)}
                                disabled={selectingId !== null}
                                accessibilityLabel={
                                    item.description ? `${item.name}, ${item.description}` : item.name
                                }
                            >
                                <Ionicons name="location" size={18} color="#6B3A22" />

                                <View style={styles.suggestionTextContainer}>
                                    <Text style={styles.suggestionName}>{item.name}</Text>
                                    {item.description !== '' && (
                                        <Text style={styles.suggestionDescription} numberOfLines={1}>
                                            {item.description}
                                        </Text>
                                    )}
                                </View>

                                {selectingId === item.placeId && (
                                    <ActivityIndicator size="small" color="#6B3A22" />
                                )}
                            </TouchableOpacity>
                        )}
                        ListEmptyComponent={
                            !searching && !error && trimmedQuery.length >= MIN_QUERY_LENGTH ? (
                                <Text style={styles.hint}>
                                    No encontramos zonas con ese nombre.
                                </Text>
                            ) : null
                        }
                    />
                </View>
            )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F8F1E7',
        paddingHorizontal: 20,
        paddingTop: 20,
    },

    question: {
        fontSize: 16,
        color: '#7A6254',
    },

    segmented: {
        flexDirection: 'row',
        marginTop: 14,
        padding: 4,
        borderRadius: 14,
        backgroundColor: '#EFE3D3',
    },

    segment: {
        flex: 1,
        alignItems: 'center',
        paddingVertical: 10,
        borderRadius: 11,
    },

    segmentActive: {
        backgroundColor: '#FFFFFF',
        elevation: 2,
    },

    segmentText: {
        fontSize: 15,
        fontWeight: '600',
        color: '#9A8578',
    },

    segmentTextActive: {
        color: '#6B3A22',
    },

    card: {
        marginTop: 20,
        padding: 16,
        borderRadius: 16,
        borderWidth: 1,
        borderColor: '#E8D9C7',
        backgroundColor: '#FFFFFF',
        gap: 16,
    },

    cardRow: {
        flexDirection: 'row',
        gap: 12,
    },

    cardTextContainer: {
        flex: 1,
    },

    cardTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#4A2416',
    },

    cardText: {
        marginTop: 4,
        fontSize: 14,
        lineHeight: 20,
        color: '#7A6254',
    },

    primaryButton: {
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 12,
        backgroundColor: '#6B3A22',
    },

    primaryButtonText: {
        fontSize: 15,
        fontWeight: '700',
        color: '#FFFFFF',
    },

    zoneContainer: {
        flex: 1,
        marginTop: 20,
    },

    searchBox: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingHorizontal: 14,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D8C6B3',
        backgroundColor: '#FFFFFF',
    },

    searchInput: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 15,
        color: '#4A2416',
    },

    hint: {
        marginTop: 14,
        fontSize: 14,
        color: '#7A6254',
    },

    errorContainer: {
        marginTop: 14,
        padding: 12,
        borderRadius: 10,
        backgroundColor: '#FCE8E6',
    },

    error: {
        fontSize: 14,
        color: '#A13D32',
    },

    list: {
        paddingTop: 10,
        paddingBottom: 30,
    },

    suggestion: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 14,
        borderBottomWidth: 1,
        borderBottomColor: '#E8D9C7',
    },

    suggestionTextContainer: {
        flex: 1,
    },

    suggestionName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#4A2416',
    },

    suggestionDescription: {
        marginTop: 2,
        fontSize: 13,
        color: '#7A6254',
    },
});
