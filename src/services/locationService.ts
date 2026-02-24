import * as Location from 'expo-location';
import { GeoPoint } from '../types/session';

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
          accuracy: Location.Accuracy.High,
          timeInterval: 3000,    // Every 3 seconds
          distanceInterval: 5,   // Or every 5 meters
        },
        (location) => {
          onLocation({
            latitude: location.coords.latitude,
            longitude: location.coords.longitude,
            timestamp: location.timestamp,
            accuracy: location.coords.accuracy ?? undefined,
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
