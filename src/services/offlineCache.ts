import AsyncStorage from '@react-native-async-storage/async-storage';

const CACHE_PREFIX = 'mb-cache:';
const CACHE_TTL_DAYS = 7;

interface CacheEntry<T> {
  data: T;
  timestamp: number;
}

function isExpired(timestamp: number): boolean {
  const now = Date.now();
  const ttl = CACHE_TTL_DAYS * 24 * 60 * 60 * 1000;
  return now - timestamp > ttl;
}

function cacheKey(key: string, userId?: string): string {
  return userId ? `${CACHE_PREFIX}${userId}:${key}` : `${CACHE_PREFIX}${key}`;
}

export const offlineCache = {
  async set<T>(key: string, data: T, userId?: string): Promise<void> {
    try {
      const entry: CacheEntry<T> = { data, timestamp: Date.now() };
      await AsyncStorage.setItem(cacheKey(key, userId), JSON.stringify(entry));
    } catch (e) {
      console.error('[offlineCache] set error:', e);
    }
  },

  async get<T>(key: string, userId?: string): Promise<T | null> {
    try {
      const raw = await AsyncStorage.getItem(cacheKey(key, userId));
      if (!raw) return null;

      const entry: CacheEntry<T> = JSON.parse(raw);
      if (isExpired(entry.timestamp)) {
        await AsyncStorage.removeItem(cacheKey(key, userId));
        return null;
      }
      return entry.data;
    } catch (e) {
      console.error('[offlineCache] get error:', e);
      return null;
    }
  },

  async remove(key: string, userId?: string): Promise<void> {
    try {
      await AsyncStorage.removeItem(cacheKey(key, userId));
    } catch (e) {
      console.error('[offlineCache] remove error:', e);
    }
  },

  async clearAll(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
      if (cacheKeys.length > 0) {
        await AsyncStorage.multiRemove(cacheKeys);
      }
    } catch (e) {
      console.error('[offlineCache] clearAll error:', e);
    }
  },

  async clearExpired(): Promise<void> {
    try {
      const allKeys = await AsyncStorage.getAllKeys();
      const cacheKeys = allKeys.filter((k) => k.startsWith(CACHE_PREFIX));
      const toRemove: string[] = [];

      for (const key of cacheKeys) {
        const raw = await AsyncStorage.getItem(key);
        if (raw) {
          try {
            const entry: CacheEntry<unknown> = JSON.parse(raw);
            if (isExpired(entry.timestamp)) {
              toRemove.push(key);
            }
          } catch {
            toRemove.push(key);
          }
        }
      }

      if (toRemove.length > 0) {
        await AsyncStorage.multiRemove(toRemove);
      }
    } catch (e) {
      console.error('[offlineCache] clearExpired error:', e);
    }
  },
};

// Cache key constants for stores
export const CACHE_KEYS = {
  PROFILE: 'profile',
  TODAY_WORKOUT: 'todayWorkout',
  TODAY_MEAL_PLAN: 'todayMealPlan',
  FOOD_SNAPS: 'foodSnaps',
  TODAY_WATER_LOG: 'todayWaterLog',
  WEIGHT_ENTRIES: 'weightEntries',
  MEASUREMENTS: 'measurements',
  WEEKLY_SUMMARIES: 'weeklySummaries',
  WORKOUT_HISTORY: 'workoutHistory',
  EXERCISE_HISTORY: 'exerciseHistory',
  PERSONAL_RECORDS: 'personalRecords',
} as const;
