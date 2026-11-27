import { StyleSheet, Text, View } from 'react-native';

type Props = {
    /** Dato de Google: solo se muestra si es true (false o null no dicen nada útil). */
    servesVegetarianFood: boolean | null | undefined;
    /** Versión más chica, para la tarjeta del mapa. */
    compact?: boolean;
    /** Solo texto, sin fondo y más chico: para la lista del mapa. */
    plain?: boolean;
};

export default function VegetarianBadge({ servesVegetarianFood, compact = false, plain = false }: Props)
{
    // Con undefined (respuesta del server viejo o lista guardada de antes)
    // tampoco se muestra.
    if (servesVegetarianFood !== true)
    {
        return null;
    }

    return (
        <View
            style={[styles.badge, compact && styles.badgeCompact, plain && styles.badgePlain]}
            accessibilityLabel="Tiene opción vegetariana"
        >
            <Text style={[styles.text, compact && styles.textCompact, plain && styles.textPlain]}>
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

    badgePlain: {
        paddingHorizontal: 0,
        paddingVertical: 0,
        backgroundColor: 'transparent',
    },

    text: {
        fontSize: 13,
        fontWeight: '600',
        color: '#39734A',
    },

    textCompact: {
        fontSize: 12,
    },

    textPlain: {
        fontSize: 11,
    },
});
