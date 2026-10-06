import {
    Image,
    StyleSheet,
    Text,
    TouchableOpacity,
    View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

type Props = {
    onHomePress: () => void;
    onAccountPress: () => void;
    onSearchPress: () => void;
};

export default function AppHeader(
    {
        onHomePress,
        onAccountPress,
        onSearchPress
    }: Props
)
{
    const { user } = useAuth();
    const insets = useSafeAreaInsets();

    const initial =
        user?.name
            ?.trim()
            .charAt(0)
            .toUpperCase();

    return (
        <View
            style={[
                styles.header,
                {
                    paddingTop: insets.top + 8,
                },
            ]}
        >
            <TouchableOpacity
                onPress={onHomePress}
                activeOpacity={0.7}
            >
                <Text style={styles.brand}>
                    BusCafé
                </Text>
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.searchButton}
                onPress={onSearchPress}
                activeOpacity={0.8}
            >
                <Ionicons
                    name="search"
                    size={18}
                    color="#8C7A6B"
                />

                <Text
                    style={styles.searchPlaceholder}
                    numberOfLines={1}
                >
                    Buscar zona o cafetería
                </Text>
                <Image
                    source={require('../../assets/buscafe-symbol-transparent.png')}
                    style={styles.searchCoffeeIcon}
                />
            </TouchableOpacity>

            <TouchableOpacity
                style={styles.accountButton}
                onPress={onAccountPress}
                activeOpacity={0.75}
            >
                {user?.avatarUrl ? (
                    <Image
                        source={{ uri: user.avatarUrl }}
                        style={styles.avatarImage}
                    />
                ) : initial ? (
                    <Text style={styles.initial}>
                        {initial}
                    </Text>
                ) : (
                    <Ionicons
                        name="person-outline"
                        size={22}
                        color="#6B3A22"
                    />
                )}
            </TouchableOpacity>
        </View>
    );
}

const styles = StyleSheet.create({
    header: {
        minHeight: 58,
        paddingHorizontal: 14,
        paddingBottom: 10,
        backgroundColor: '#6B3A22',
        borderBottomWidth: 1,
        borderBottomColor: '#4A2416',
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
    },

    brand: {
        fontSize: 21,
        fontWeight: '700',
        color: '#FFFDFC',
    },

    accountButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        borderWidth: 1,
        borderColor: '#E8D9C7',
        backgroundColor: '#FFFDFC',
        alignItems: 'center',
        justifyContent: 'center',
    },

    avatarImage: {
        width: '100%',
        height: '100%',
        borderRadius: 20,
    },

    initial: {
        fontSize: 18,
        fontWeight: '700',
        color: '#6B3A22',
    },

    searchButton: {
        flex: 1,
        height: 40,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 11,
        backgroundColor: '#FFFDFC',
        borderWidth: 1,
        borderColor: '#E8D9C7',
        borderRadius: 14,
    },

    searchPlaceholder: {
        flex: 1,
        marginLeft: 7,
        fontSize: 14,
        color: '#8C7A6B',
    },

    searchCoffeeIcon: {
        width: 24,
        height: 24,
        marginLeft: 6,
        resizeMode: 'contain',
    },
});
