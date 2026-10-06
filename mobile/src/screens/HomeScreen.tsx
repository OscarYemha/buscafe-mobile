import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from 'react';
import { CompositeScreenProps, useFocusEffect } from '@react-navigation/native';
import { BottomTabScreenProps } from '@react-navigation/bottom-tabs';
import { NativeStackScreenProps } from '@react-navigation/native-stack';
import { MainTabParamList, RootStackParamlist } from '../navigation/AppNavigator';
import { StatusBar } from 'expo-status-bar';
import {
  AppState,
  Image,
  KeyboardAvoidingView,
  Linking,
  Platform,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { cafeIntents } from '../data/cafeIntents';
import NearbyCafeCard from '../components/NearbyCafeCard';
import { CafeSummary } from '../types/CafeSummary';
import { getNearbyCafes } from '../services/api';
import { getCurrentLocation, watchUserLocation, UserLocation } from '../services/location';
import { useReviews } from '../context/ReviewsContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';

type Props = CompositeScreenProps<
    BottomTabScreenProps<
        MainTabParamList,
        'Home'
    >,
    NativeStackScreenProps<RootStackParamlist>
>;

const MOVEMENT_THRESHOLD_METERS = 50;
const SIGNIFICANT_ACCURACY_IMPROVEMENT_METERS = 10;
const AUTO_REFRESH_COOLDOWN_MS = 10000;

function calculateLocationDistanceMeters(
  location1: UserLocation,
  location2: UserLocation
): number
{
  const earthRadiusMeters = 6371000;

  const latitudeDifference =
    degreesToRadians(
      location2.latitude - location1.latitude
    );

  const longitudeDifference =
    degreesToRadians(
      location2.longitude - location1.longitude
    );

  const latitude1 =
    degreesToRadians(location1.latitude);

  const latitude2 =
    degreesToRadians(location2.latitude);

  const a =
    Math.sin(latitudeDifference / 2) ** 2 +
    Math.cos(latitude1) *
      Math.cos(latitude2) *
      Math.sin(longitudeDifference / 2) ** 2;

  const c =
    2 * Math.atan2(
      Math.sqrt(a),
      Math.sqrt(1 - a)
    );

  return earthRadiusMeters * c;
}

function degreesToRadians(degrees: number): number
{
  return degrees * (Math.PI / 180);
}

export default function HomeScreen({navigation}: Props) {
  const scrollViewRef = useRef<ScrollView>(null);
  const waitingForLocationSettings = useRef(false);
  const selectedLocationRef = useRef<UserLocation | null>(null);
  const movementCandidateRef = useRef<UserLocation | null>(null);
  const lastAutoRefreshRef = useRef<number>(0);
  const autoRefreshInProgressRef = useRef(false);

  const { reviewsVersion } = useReviews();
  const lastReviewsVersion = useRef(reviewsVersion);

  const { isAuthenticated } = useAuth();

  const {
    isFavorite,
    toggleFavorite,
  } = useFavorites();


  const [cafes, setCafes] = useState<CafeSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [userLocation, setUserLocation] = useState<UserLocation | null>(null);
  const [canAskLocationAgain, setCanAskLocationAgain] = useState(true);
  const [showScrollTop, setShowScrollTop] = useState(false);

  const handleFavoritePress = async (
    cafe: CafeSummary
  ) => {
    if (!isAuthenticated)
    {
      navigation.navigate('Login');
      return;
    }

    try
    {
      await toggleFavorite(cafe);
    }
    catch (error)
    {
      console.error(
        'Error al actualizar favorito:',
        error
      );
    }
  };

  async function loadNearbyCafes() {
    try
    {
      setLoading(true);
      setError(null);

      const result = await getCurrentLocation();

      if (result.status === 'denied')
      {
        setUserLocation(null);
        setCanAskLocationAgain(result.canAskAgain);

        setError(
          result.canAskAgain
          ? 'Necesitamos tu ubicación para mostrar cafeterías cercanas.'
          : 'El acceso a tu ubicación está desactivado. Habilitalo desde los ajustes del teléfono para ver las cafeterías cercanas.'
        );

        return;
      }

      const location = result.location;

      setCanAskLocationAgain(true);
      selectedLocationRef.current = location;
      setUserLocation(location);

      const nearbyCafes = await getNearbyCafes(
        location.latitude,
        location.longitude
      );

      setCafes(nearbyCafes);
    }
    catch (error)
    {
      console.error(
        'Error al obtener las cafeterías cercanas:',
        error
      );

      setError(
        'No se pudieron cargar las cafeterías cercanas.'
      );
    }
    finally
    {
      setLoading(false);
    }
  }

  async function updateNearbyCafesFromLocation(
    location: UserLocation
  )
  {
    setUserLocation(location);

    const nearbyCafes =
      await getNearbyCafes(
        location.latitude,
        location.longitude
      );

    setCafes(nearbyCafes);
  }

  async function autoRefreshNearbyCafes(
    location: UserLocation
  )
  {
    const now = Date.now();

    if (autoRefreshInProgressRef.current)
    {
      return;
    }

    if (
      now - lastAutoRefreshRef.current <
      AUTO_REFRESH_COOLDOWN_MS
    )
    {
      return;
    }

    try
    {
      autoRefreshInProgressRef.current = true;
      lastAutoRefreshRef.current = now;

      await updateNearbyCafesFromLocation(
        location
      );
    }
    catch (error)
    {
      console.error(
        'Error al actualizar cafés automáticamente:',
        error
      );
    }
    finally
    {
      autoRefreshInProgressRef.current = false;
    }
  }

  useEffect(() => {
    const subscription =
      AppState.addEventListener(
        'change',
        (nextAppState) => {
          if (
            nextAppState === 'active' &&
            waitingForLocationSettings.current
          )
          {
            waitingForLocationSettings.current = false;
            loadNearbyCafes();
          }
        }
      );

      return () => {
        subscription.remove();
      }
  }, []);

  useEffect(() => {
    loadNearbyCafes();
  }, [])

  useFocusEffect(
    useCallback(() => {
      let subscription:
        { remove: () => void } | null = null;

      let cancelled = false;

      const startLocationWatch = async () => {
        try
        {
          subscription =
            await watchUserLocation((location) => {
              if (cancelled)
              {
                return;
              }

              const selectedLocation =
                selectedLocationRef.current;

              if (!selectedLocation)
              {
                selectedLocationRef.current = location;

                return;
              }

              const distanceMeters =
                calculateLocationDistanceMeters(
                  selectedLocation,
                  location
                );

              const currentAccuracy =
                selectedLocation.accuracy ??
                Number.POSITIVE_INFINITY;

              const newAccuracy =
                location.accuracy ??
                Number.POSITIVE_INFINITY;

              if (distanceMeters >= MOVEMENT_THRESHOLD_METERS)
              {
                const movementCandidate =
                  movementCandidateRef.current;

                if (!movementCandidate)
                {
                  movementCandidateRef.current = location;

                  return;
                }

                const candidateDistanceMeters =
                  calculateLocationDistanceMeters(
                    movementCandidate,
                    location
                  );

                if (candidateDistanceMeters <= MOVEMENT_THRESHOLD_METERS)
                {
                  selectedLocationRef.current = location;
                  movementCandidateRef.current = null;

                  void autoRefreshNearbyCafes(
                    location
                  );

                  return;
                }

                movementCandidateRef.current = location;

                return;
              }

              movementCandidateRef.current = null;

              if (newAccuracy < currentAccuracy)
              {
                const accuracyImprovement =
                  currentAccuracy - newAccuracy;

                selectedLocationRef.current = location;

                if (
                  accuracyImprovement >=
                  SIGNIFICANT_ACCURACY_IMPROVEMENT_METERS
                )
                {
                  void autoRefreshNearbyCafes(
                    location
                  );
                }
              }
            });

          if (cancelled)
          {
            subscription.remove();
          }
        }
        catch (error)
        {
          console.error(
            'Error al seguir la ubicación:',
            error
          );
        }
      };

      startLocationWatch();

      return () => {
        cancelled = true;
        subscription?.remove();
      };
    }, [])
  );

  useFocusEffect(
    useCallback(() => {
      if (reviewsVersion === lastReviewsVersion.current)
      {
        return;
      }

      lastReviewsVersion.current = reviewsVersion;
      loadNearbyCafes();
    }, [reviewsVersion])
  );

  return (
    <SafeAreaView style={styles.container} edges={['left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
      >
        <ScrollView
          ref={scrollViewRef}
          showsVerticalScrollIndicator={false}
          contentContainerStyle={styles.content}
          onScroll={(event) => {
            const offsetY =
              event.nativeEvent.contentOffset.y;

            setShowScrollTop(offsetY > 500);
          }}
          scrollEventThrottle={16}
        >
          <StatusBar style="dark" />

          <View style={styles.header}>
            <View style={styles.brandRow}>
              <Text style={styles.logo}>
                BusCafé
              </Text>

              <Image
                source={require('../../assets/buscafe-symbol-transparent.png')}
                style={styles.logoImage}
                resizeMode="cover"
              />
            </View>

            <Text style={styles.subtitle}>
              Encontrá el café ideal para tu momento
            </Text>
          </View>

          <Text style={styles.sectionTitle}>
            ¿Qué estás buscando?
          </Text>

          <View style={styles.optionsContainer}>
            {cafeIntents.map((option) => (
                <TouchableOpacity
                    key={option.id}
                    style={styles.optionCard}
                    onPress={() => {
                        if (!userLocation) {
                            return;
                        }

                        navigation.navigate('Results', {
                            intent: option.id,
                            latitude: userLocation.latitude,
                            longitude: userLocation.longitude,
                        });
                    }}
                >
                    <Text style={styles.optionIcon}>{option.icon}</Text>
                    <Text style={styles.optionText}>{option.label}</Text>
                </TouchableOpacity>
            ))}
          </View>
          <Text style={styles.sectionTitle}>
            Cafés cerca de vos
          </Text>
          {loading && (
            <Text style={styles.message}>
              Buscando cafeterías cercanas...
            </Text>
          )}

          {error && (
            <View style={styles.locationCard}>
              <Text style={styles.error}>
                {error}
              </Text>

              <TouchableOpacity
                style={styles.locationButton}
                onPress={() => {
                  if (canAskLocationAgain)
                  {
                    loadNearbyCafes();
                  }
                  else
                  {
                    waitingForLocationSettings.current = true;
                    Linking.openSettings();
                  }
                }}
              >
                <Text style={styles.locationButtonText}>
                  {canAskLocationAgain
                    ? '📍 Usar mi ubicación'
                    : '⚙️ Abrir ajustes'}
                </Text>
              </TouchableOpacity>
            </View>
          )}

          {!loading && !error && (
            <View style={styles.cafesContainer}>
              {cafes.slice(0, 5).map((cafe) => (
                <NearbyCafeCard
                  key={cafe.googlePlaceId}
                  cafe={cafe}
                  isFavorite={isFavorite(cafe.googlePlaceId)}
                  onFavoritePress={() => {
                    handleFavoritePress(cafe);
                  }}
                  onPress={() => {
                      navigation.navigate('CafeDetail', {
                          googlePlaceId: cafe.googlePlaceId,
                      });
                  }}
                />
              ))}
            </View>
          )}
          {!loading &&
            !error && 
            cafes.length > 5 && 
            userLocation && (
            <TouchableOpacity
              style={styles.showAllButton}
              onPress={() => {
                navigation.navigate('Results', {
                  latitude: userLocation.latitude,
                  longitude: userLocation.longitude,
                });
              }}
            >
              <Text style={styles.showAllButtonText}>
                Ver todos
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
      {showScrollTop && (
        <TouchableOpacity
          style={styles.scrollTopButton}
          onPress={() => {
            scrollViewRef.current?.scrollTo({
              y: 0,
              animated: true,
            });
          }}
        >
          <Text style={styles.scrollTopButtonText}>
            ↑ Ir arriba
          </Text>
        </TouchableOpacity>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F8F1E7',
  },

  header: {
    marginTop: 20,
    marginBottom: 24,
  },

  brandRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },

  logoImage: {
    width: 40,
    height: 40,
  },

  logo: {
    fontSize: 32,
    fontWeight: '700',
    color: '#4A2416',
  },

  subtitle: {
    marginTop: 6,
    fontSize: 16,
    color: '#7A6254',
  },

  searchInput: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingHorizontal: 16,
    paddingVertical: 14,
    fontSize: 16,
    borderWidth: 1,
    borderColor: '#E2D4C3',
  },

  locationButton: {
    marginTop: 14,
    backgroundColor: '#6B3A22',
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },

  locationButtonText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '600',
  },

  sectionTitle: {
    marginTop: 28,
    marginBottom: 14,
    fontSize: 20,
    fontWeight: '700',
    color: '#4A2416',
  },

  optionsContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 12,
  },

  optionCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    paddingVertical: 18,
    paddingHorizontal: 14,
    borderWidth: 1,
    borderColor: '#E8D9C7',
  },

  optionIcon: {
    fontSize: 24,
    marginBottom: 8,
  },

  optionText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#4A2416',
  },

  content: {
    paddingHorizontal: 20,
    paddingBottom: 30,
  },

  cafesContainer: {
    gap: 14,
  },

  message: {
    fontSize: 16,
    color: '#7A6254',
  },

  error: {
    fontSize: 16,
    color: '#A13D32',
  },

  locationCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 14,
    padding: 16,
    borderWidth: 1,
    borderColor: '#E8D9C7',
  },

  showAllButton: {
    alignSelf: 'center',
    marginTop: 16,
    paddingHorizontal: 18,
    paddingVertical: 10,
    backgroundColor: '#6B3A22',
    borderRadius: 12,
  },

  showAllButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#FFFFFF',
  },

  scrollTopButton: {
    position: 'absolute',
    right: 20,
    bottom: 70,
    backgroundColor: '#6B3A22',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderRadius: 24,
    elevation: 4,
  },

  scrollTopButtonText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '600',
  },
});
