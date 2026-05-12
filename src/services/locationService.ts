import * as Location from 'expo-location';
import { GeoPoint } from '../types/session';

// GPS fixes with accuracy worse than this are dropped. Sitting still
// indoors or near tall buildings, accuracy is often 30–100m and the
// reported coordinates drift several meters between fixes — accepting
// them produces the "spider web" route on otherwise-stationary sessions.
const MIN_ACCURACY_METERS = 20;

class LocationService {
  private subscription: Location.LocationSubscription | null = null;
  private isTracking = false;

  async requestPermissions(): Promise<boolean> {
    try {
      const { status: foregroundStatus } = await Location.requestForegroundPermissionsAsync();

      if (foregroundStatus !== 'granted') {
        console.log('Foreground location permission denied');
        return false;
      }

      // Background permission for tracking when app is backgrounded on iOS.
      // Failing this is non-fatal — foreground tracking still works.
      try {
        const { status: backgroundStatus } = await Location.requestBackgroundPermissionsAsync();
        if (backgroundStatus !== 'granted') {
          console.log('Background location permission denied — tracking foreground only');
        }
      } catch {
        // Background permission API may not be available on all platforms
      }

      return true;
    } catch (error) {
      console.error('Error requesting location permissions:', error);
      return false;
    }
  }

  async checkPermissions(): Promise<boolean> {
    try {
      const { status } = await Location.getForegroundPermissionsAsync();
      return status === 'granted';
    } catch (error) {
      console.error('Error checking location permissions:', error);
      return false;
    }
  }

  async getCurrentLocation(): Promise<GeoPoint | null> {
    try {
      const hasPermission = await this.checkPermissions();
      if (!hasPermission) return null;

      const location = await Location.getCurrentPositionAsync({
        accuracy: Location.Accuracy.High,
      });

      return {
        latitude: location.coords.latitude,
        longitude: location.coords.longitude,
        timestamp: location.timestamp,
        accuracy: location.coords.accuracy ?? undefined,
      };
    } catch (error) {
      console.error('Error getting current location:', error);
      return null;
    }
  }

  async startTracking(onLocation: (point: GeoPoint) => void): Promise<boolean> {
    try {
      if (this.isTracking) return true;

      const hasPermission = await this.checkPermissions();
      if (!hasPermission) {
        const granted = await this.requestPermissions();
        if (!granted) return false;
      }

      this.subscription = await Location.watchPositionAsync(
        {
          accuracy: Location.Accuracy.BestForNavigation,
          timeInterval: 3000,
          distanceInterval: 5,
        },
        (location) => {
          const accuracy = location.coords.accuracy ?? undefined;

          // Drop low-confidence fixes before they reach the store.
          // accuracy === undefined means the platform didn't report it
          // (some emulators) — pass it through so dev/test still works.
          if (accuracy !== undefined && accuracy > MIN_ACCURACY_METERS) {
            return;
          }

          onLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
            accuracy,
          });
        },
      );

      this.isTracking = true;
      return true;
    } catch (error) {
      console.error('Error starting location tracking:', error);
      return false;
    }
  }

  stopTracking(): void {
    if (this.subscription) {
      this.subscription.remove();
      this.subscription = null;
    }
    this.isTracking = false;
  }

  getIsTracking(): boolean {
    return this.isTracking;
  }
}

export const locationService = new LocationService();
