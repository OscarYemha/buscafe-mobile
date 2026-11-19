import * as Location from 'expo-location';

const LOCATION_TIMEOUT_MS = 10000;
const LAST_KNOWN_MAX_AGE_MS = 10 * 60 * 1000;

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T>
{
  return new Promise((resolve, reject) => {
    const timer = setTimeout(
      () => reject(new Error('Tiempo de espera agotado al obtener la ubicación')),
      ms
    );

    promise.then(
      (value) => { clearTimeout(timer); resolve(value); },
      (error) => { clearTimeout(timer); reject(error); }
    );
  });
}

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
    }
  | {
      status: 'services-disabled';
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

  const servicesEnabled =
    await Location.hasServicesEnabledAsync();

  if (!servicesEnabled)
  {
    return { status: 'services-disabled' };
  }

  let location: Location.LocationObject | null;

  try
  {
    location = await withTimeout(
      Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      }),
      LOCATION_TIMEOUT_MS
    );
  }
  catch (error)
  {
    location = await Location.getLastKnownPositionAsync({
      maxAge: LAST_KNOWN_MAX_AGE_MS,
    });

    if (!location)
    {
      throw error;
    }
  }

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