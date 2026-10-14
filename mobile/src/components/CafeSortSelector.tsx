import { useState } from 'react';
import {
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { CafeSortOption } from '../utils/sortCafes';

type Props = {
    value: CafeSortOption;
    onChange: (value: CafeSortOption) => void;
};

const options: { value: CafeSortOption; label: string }[] = [
    { value: 'distance', label: 'Distancia' },
    { value: 'google', label: '★ Puntuación de Google' },
    { value: 'buscafe', label: '★ Puntuación de BusCafé' },
];

export default function CafeSortSelector({ value, onChange }: Props)
{
    const [expanded, setExpanded] = useState(false);

    const selectedOption = options.find(
        (option) => option.value === value
    );

    return (
        <View style={styles.container}>
            <View style={styles.row}>
                <Text style={styles.label}>Ordenar por</Text>

                    <TouchableOpacity
                        style={styles.trigger}
                        onPress={() => setExpanded(!expanded)}
                        accessibilityRole="button"
                        accessibilityLabel="Seleccionar ordenamiento"
                        accessibilityState={{ expanded }}
                    >
                        <Text style={styles.triggerText}>
                            {selectedOption?.label}
                        </Text>

                        <Ionicons
                            name={expanded ? 'chevron-up' : 'chevron-down'}
                            size={18}
                            color="#6B3A22"
                        />
                    </TouchableOpacity>
                </View>

                {expanded && (
                    <View style={styles.menu}>
                        {options.map((option) => (
                            <TouchableOpacity
                                key={option.value}
                                style={styles.option}
                                onPress={() =>
                                {
                                    onChange(option.value);
                                    setExpanded(false);
                                }}
                            >
                                <Text
                                    style={[
                                        styles.optionText,
                                        value === option.value &&
                                            styles.selectedText,
                                    ]}
                                >
                                    {option.label}
                                </Text>

                                {value === option.value && (
                                    <Ionicons
                                        name="checkmark"
                                        size={18}
                                        color="#6B3A22"
                                    />
                                )}
                            </TouchableOpacity>
                        ))}
                    </View>
                )}
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        position: 'relative',
        zIndex: 10,
    },

    label: {
        fontSize: 14,
        fontWeight: '600',
        color: '#7A6254',
    },

    trigger: {
        minWidth: 155,
        maxWidth: '65%',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
        paddingHorizontal: 14,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D8C6B3',
        backgroundColor: '#FFFFFF',
    },

    triggerText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#6B3A22',
    },

    menu: {
        position: 'absolute',
        top: '100%',
        right: 0,
        width: 180,
        marginTop: 4,
        borderRadius: 12,
        borderWidth: 1,
        borderColor: '#D8C6B3',
        backgroundColor: '#FFFFFF',
        elevation: 6,
        zIndex: 20,
        overflow: 'hidden',
    },

    option: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 14,
        paddingVertical: 13,
    },

    optionText: {
        fontSize: 14,
        color: '#6B3A22',
    },

    selectedText: {
        fontWeight: '700',
    },

    row: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 12,
    },
});