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
import { useReviews } from '../context/ReviewsContext';
import { useAuth } from '../context/AuthContext';
import { useFavorites } from '../context/FavoritesContext';
import { useNearbyCafes } from '../context/NearbyCafesContext';

type Props = CompositeScreenProps<
    BottomTabScreenProps<
        MainTabParamList,
        'Home'
    >,
    NativeStackScreenProps<RootStackParamlist>
>;

export default function HomeScreen({navigation}: Props) {
  const scrollViewRef = useRef<ScrollView>(null);

  const { reviewsVersion } = useReviews();
  const lastReviewsVersion = useRef(reviewsVersion);

  const { isAuthenticated } = useAuth();

  const {
    userLocation,
    cafes,
    loading,
    error,
    canAskLocationAgain,
    refreshNearbyCafes,
    markWaitingForLocationSettings,
  } = useNearbyCafes();

  const {
    isFavorite,
    toggleFavorite,
  } = useFavorites();

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

  useFocusEffect(
    useCallback(() => {
      if (
        reviewsVersion ===
        lastReviewsVersion.current
      )
      {
        return;
      }

      lastReviewsVersion.current =
        reviewsVersion;

      void refreshNearbyCafes();
    }, [
      reviewsVersion,
      refreshNearbyCafes,
    ])
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
                    void refreshNearbyCafes();
                  }
                  else
                  {
                    markWaitingForLocationSettings();
                    void Linking.openSettings();
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
