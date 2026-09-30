import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Ionicons } from '@expo/vector-icons';
import HomeScreen from '../screens/HomeScreen';
import ResultsScreen from '../screens/ResultsScreen';
import CafeDetailScreen from '../screens/CafeDetailScreen';
import AddReviewScreen from '../screens/AddReviewScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import MapScreen from '../screens/MapScreen';
import AccountScreen from '../screens/AccountScreen';
import FavoritesScreen from '../screens/FavoritesScreen';
import { CafeIntent } from '../types/CafeIntent';
import VerifyEmailScreen from '../screens/VerifyEmailScreen';

export type RootStackParamlist = {
    Main: undefined;
    Results: {
        intent?: CafeIntent;
        latitude: number;
        longitude: number;
    };
    CafeDetail: {
        googlePlaceId: string;
    };
    AddReview: {
        googlePlaceId: string;
        cafeName: string;
        cafeAddress: string;
        cafeLatitude: number;
        cafeLongitude: number;
    };
    Login: undefined;
    Register: undefined;
    VerifyEmail: {
        email: string;
    }
};

export type MainTabParamList = {
    Home: undefined;
    Map: undefined;
    Account: undefined;
};

export type AccountStackParamList = {
    AccountHome: undefined;
    Favorites: undefined;
};

const Stack =
    createNativeStackNavigator<RootStackParamlist>();

const Tab =
    createBottomTabNavigator<MainTabParamList>();

const AccountStack =
    createNativeStackNavigator<AccountStackParamList>();


function AccountNavigator()
{
    return (
        <AccountStack.Navigator>
            <AccountStack.Screen
                name="AccountHome"
                component={AccountScreen}
                options={{
                    headerShown: false,
                }}
            />

            <AccountStack.Screen
                name="Favorites"
                component={FavoritesScreen}
                options={{
                    title: 'Cafés favoritos',
                }}
            />
        </AccountStack.Navigator>
    );
}

function MainTabs()
{
    return (
        <Tab.Navigator
            screenOptions={({ route }) => ({
            headerShown: false,

            tabBarActiveTintColor: '#6B3A22',
            tabBarInactiveTintColor: '#9A8578',

            tabBarStyle: {
                backgroundColor: '#FFFDFC',
                borderTopColor: '#E8D9C7',
                borderTopWidth: 1,
                elevation: 8,
            },

            tabBarLabelStyle: {
                fontSize: 12,
                fontWeight: '600',
            },

            tabBarIcon: ({
                focused,
                color,
                size,
            }) => {
                let iconName:
                    | 'home'
                    | 'home-outline'
                    | 'map'
                    | 'map-outline'
                    | 'person'
                    | 'person-outline';

                if (route.name === 'Home')
                {
                    iconName =
                        focused
                            ? 'home'
                            : 'home-outline';
                }
                else if (route.name === 'Map')
                {
                    iconName =
                        focused
                            ? 'map'
                            : 'map-outline';
                }
                else
                {
                    iconName =
                        focused
                            ? 'person'
                            : 'person-outline';
                }

                return (
                    <Ionicons
                        name={iconName}
                        size={size}
                        color={color}
                    />
                );
            },
        })}
        >
            <Tab.Screen
                name="Home"
                component={HomeScreen}
                options={{
                    title: 'Inicio',
                }}
            />

            <Tab.Screen
                name="Map"
                component={MapScreen}
                options={{
                    title: 'Mapa',
                }}
            />

            <Tab.Screen
                name="Account"
                component={AccountNavigator}
                options={{
                    title: 'Mi cuenta',
                }}
            />
        </Tab.Navigator>
    );
}

export default function AppNavigator()
{
    return (
        <Stack.Navigator>
            <Stack.Screen
                name="Main"
                component={MainTabs}
                options={{
                    headerShown: false,
                }}
            />

            <Stack.Screen
                name="Results"
                component={ResultsScreen}
                options={{
                    title: 'Resultados',
                }}
            />

            <Stack.Screen
                name="CafeDetail"
                component={CafeDetailScreen}
                options={{
                    title: 'Cafetería',
                }}
            />

            <Stack.Screen
                name="AddReview"
                component={AddReviewScreen}
                options={{
                    title: 'Escribir reseña',
                }}
            />

            <Stack.Screen
                name="Login"
                component={LoginScreen}
                options={{
                    title: 'Iniciar sesión',
                }}
            />

            <Stack.Screen
                name="Register"
                component={RegisterScreen}
                options={{
                    title: 'Crear cuenta',
                }}
            />
            <Stack.Screen
                name="VerifyEmail"
                component={VerifyEmailScreen}
                options={{
                    title: 'Verificar email',
                }}
            />
        </Stack.Navigator>
    );
}