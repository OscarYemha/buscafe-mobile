import * as Location from 'expo-location';

export type UserLocation = {
  latitude: number;
  longitude: number;
  accuracy: number | null;
};

export type LocationResult =
  | {
      status: 'granted';
      location: UserLocation;
    }
  | {
      status: 'denied';
      canAskAgain: boolean;
    };

export async function getCurrentLocation():
  Promise<LocationResult>
{
  let permission =
    await Location.getForegroundPermissionsAsync();

  if (permission.status !== 'granted')
  {
    permission =
      await Location.requestForegroundPermissionsAsync();
  }

  if (permission.status !== 'granted')
  {
    return {
      status: 'denied',
      canAskAgain: permission.canAskAgain,
    };
  }

  const location =
    await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High,
    });

  return {
    status: 'granted',
    location: {
      latitude: location.coords.latitude,
      longitude: location.coords.longitude,
      accuracy: location.coords.accuracy,
    },
  };
}

export async function watchUserLocation(
  onLocationChange: (location: UserLocation) => void
): Promise<Location.LocationSubscription>
{
  const permission =
    await Location.getForegroundPermissionsAsync();

  if (permission.status !== 'granted') {
    throw new Error(
      `Seguimiento GPS sin permiso. Estado: ${permission.status}`
    );
  }

  const servicesEnabled =
    await Location.hasServicesEnabledAsync();

  if (!servicesEnabled) {
    throw new Error(
      'Los servicios de ubicación de Android están desactivados'
    );
  }

  return Location.watchPositionAsync(
    {
      accuracy: Location.Accuracy.High,
      timeInterval: 2000,
      distanceInterval: 5,
    },
    (location) => {
      onLocationChange({
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        accuracy: location.coords.accuracy,
      });
    }
  );
}