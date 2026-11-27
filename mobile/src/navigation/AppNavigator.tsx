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
import AppHeader from '../components/AppHeader';
import { View } from 'react-native';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { NavigatorScreenParams } from '@react-navigation/native';
import SearchScreen from '../screens/SearchScreen';
import EditProfileScreen from '../screens/EditProfileScreen';
import ChangePasswordScreen from '../screens/ChangePasswordScreen';
import MyReviewsScreen from '../screens/MyReviewsScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import ResetPasswordScreen from '../screens/ResetPasswordScreen';
import DeleteAccountScreen from '../screens/DeleteAccountScreen';
import ChooseZoneScreen from '../screens/ChooseZoneScreen';
import type { MyReview } from '../services/api';
import { NearbyCafesProvider } from '../context/NearbyCafesContext';
import { SearchAreaProvider } from '../context/SearchAreaContext';

export type RootStackParamlist = {
    Main: NavigatorScreenParams<MainTabParamList>;
    Search: undefined;
    Results: {
        intent?: CafeIntent;
        latitude?: number;
        longitude?: number;
    };
    ChooseZone: undefined;
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
    EditReview: {
        review: MyReview;
    };
    Login: {
        returnTo?: 'previous' | 'Home' | 'Account';
    } | undefined;
    Register: {
        returnTo?: 'previous' | 'Home' | 'Account';
    } | undefined;
    VerifyEmail: {
        email: string;
        returnTo?: 'previous' | 'Home' | 'Account';
    }
    ForgotPassword: {
        email?: string;
    };
    ResetPassword: {
        email: string;
    };
};

export type MainTabParamList = {
    Home: undefined;
    Map: undefined;
    Favorites: undefined;
    Account: NavigatorScreenParams<AccountStackParamList> | undefined;
};

export type AccountStackParamList = {
    AccountHome: undefined;
    EditProfile: undefined;
    ChangePassword: undefined;
    MyReviews: undefined;
    DeleteAccount: undefined;
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
        <AccountStack.Navigator
            screenOptions={{
                unstable_headerInsets: {
                    top: false,
                },
                headerTintColor: '#6B3A22',
            }}
        >
            <AccountStack.Screen
                name="AccountHome"
                component={AccountScreen}
                options={{
                    headerShown: false,
                }}
            />

            <AccountStack.Screen
                name="EditProfile"
                component={EditProfileScreen}
                options={{
                    title: 'Editar perfil',
                }}
            />

            <AccountStack.Screen
                name="ChangePassword"
                component={ChangePasswordScreen}
                options={{
                    title: 'Cambiar contraseña',
                }}
            />

            <AccountStack.Screen
                name="MyReviews"
                component={MyReviewsScreen}
                options={{
                    title: 'Mis reseñas',
                }}
            />

            <AccountStack.Screen
                name="DeleteAccount"
                component={DeleteAccountScreen}
                options={{
                    title: 'Eliminar cuenta',
                }}
            />
        </AccountStack.Navigator>
    );
}

type MainTabsProps = NativeStackScreenProps<RootStackParamlist, 'Main'>;

function MainTabs({ navigation }: MainTabsProps)
{
    return (
        <View style={{ flex: 1 }}>
            <Tab.Navigator
                screenOptions={({ route }) => ({
                    /*
                     * El header vive dentro de las pestañas (no arriba de
                     * ellas) para navegar con la navegación de pestañas: desde
                     * afuera, "ir a Main con screen Account" solo funcionaba
                     * si el parámetro cambiaba, o sea, a veces.
                     */
                    header: ({ navigation: tabNavigation }) => (
                        <AppHeader
                            onHomePress={() => {
                                tabNavigation.navigate('Home');
                            }}
                            onAccountPress={() => {
                                tabNavigation.navigate('Account', {
                                    screen: 'AccountHome',
                                });
                            }}
                            onSearchPress={() => {
                                navigation.navigate('Search');
                            }}
                        />
                    ),

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
                            | 'heart'
                            | 'heart-outline'
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
                        else if (route.name === 'Favorites')
                        {
                            iconName =
                                focused
                                    ? 'heart'
                                    : 'heart-outline';
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
                    name="Favorites"
                    component={FavoritesScreen}
                    options={{
                        title: 'Favoritos',
                    }}
                />

                <Tab.Screen
                    name="Account"
                    component={AccountNavigator}
                    options={{
                        title: 'Mi cuenta',
                        popToTopOnBlur: true,
                    }}
                />
            </Tab.Navigator>
        </View>
    );
}

export default function AppNavigator()
{
    /*
     * Los providers de ubicación y zona envuelven toda la navegación (no
     * solo las pestañas) porque Resultados y Elegir zona también los usan.
     */
    return (
        <NearbyCafesProvider>
        <SearchAreaProvider>
        <Stack.Navigator
            screenOptions={{
                headerTintColor: '#6B3A22',
            }}
        >
            <Stack.Screen
                name="Main"
                component={MainTabs}
                options={{
                    headerShown: false,
                }}
            />

            <Stack.Screen
                name="Search"
                component={SearchScreen}
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
                name="ChooseZone"
                component={ChooseZoneScreen}
                options={{
                    title: 'Elegir zona',
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
                name="EditReview"
                component={AddReviewScreen}
                options={{
                    title: 'Editar reseña',
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
            <Stack.Screen
                name="ForgotPassword"
                component={ForgotPasswordScreen}
                options={{
                    title: 'Recuperar contraseña',
                }}
            />

            <Stack.Screen
                name="ResetPassword"
                component={ResetPasswordScreen}
                options={{
                    title: 'Nueva contraseña',
                }}
            />
        </Stack.Navigator>
        </SearchAreaProvider>
        </NearbyCafesProvider>
    );
}