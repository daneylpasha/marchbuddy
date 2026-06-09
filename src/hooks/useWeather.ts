import { useEffect, useState, useCallback } from 'react';
import { weatherService, type WeatherSnapshot } from '../services/weatherService';

interface UseWeatherResult {
  weather: WeatherSnapshot | null;
  isLoading: boolean;
  refetch: () => Promise<void>;
}

/**
 * Fetches current weather for the device location.
 *
 * Returns null when location permission is denied or the network call fails —
 * callers must render gracefully without a snapshot. Weather is decorative
 * here, not gating, so silent fallback is the right behavior.
 */
export function useWeather(): UseWeatherResult {
  const [weather, setWeather] = useState<WeatherSnapshot | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const refetch = useCallback(async () => {
    setIsLoading(true);
    const snap = await weatherService.getCurrentWeather(true);
    setWeather(snap);
    setIsLoading(false);
  }, []);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const snap = await weatherService.getCurrentWeather();
      if (mounted) {
        setWeather(snap);
        setIsLoading(false);
      }
    })();
    return () => {
      mounted = false;
    };
  }, []);

  return { weather, isLoading, refetch };
}
