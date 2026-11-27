import { StyleSheet, Text, View } from 'react-native';

type Props = {
    /** Dato de Google: solo se muestra si es true (false o null no dicen nada útil). */
    servesVegetarianFood: boolean | null | undefined;
    /** Versión más chica, para la lista del mapa. */
    compact?: boolean;
};

export default function VegetarianBadge({ servesVegetarianFood, compact = false }: Props)
{
    // Con undefined (respuesta del server viejo o lista guardada de antes)
    // tampoco se muestra.
    if (servesVegetarianFood !== true)
    {
        return null;
    }

    return (
        <View
            style={[styles.badge, compact && styles.badgeCompact]}
            accessibilityLabel="Tiene opción vegetariana"
        >
            <Text style={[styles.text, compact && styles.textCompact]}>
                🌱 Opción vegetariana
            </Text>
        </View>
    );
}

const styles = StyleSheet.create({
    badge: {
        alignSelf: 'flex-start',
        paddingHorizontal: 9,
        paddingVertical: 3,
        borderRadius: 10,
        backgroundColor: '#EAF3E6',
    },

    badgeCompact: {
        paddingHorizontal: 7,
        paddingVertical: 2,
        borderRadius: 8,
    },

    text: {
        fontSize: 13,
        fontWeight: '600',
        color: '#39734A',
    },

    textCompact: {
        fontSize: 12,
    },
});
