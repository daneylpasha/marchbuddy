import { create } from 'zustand';
import type { UserProfile } from '../types';
import { getProfile, upsertProfile } from '../api/database';
import { MOCK_MODE } from '../mock';
import { offlineCache, CACHE_KEYS } from '../services/offlineCache';
import { offlineQueue } from '../services/offlineQueue';
import { useNetworkStore } from './networkStore';

interface ProfileState {
  profile: UserProfile | null;
  isLoading: boolean;
  onboardingCompleted: boolean;

  fetchProfile: (userId: string) => Promise<void>;
  updateProfile: (updates: Partial<UserProfile>) => Promise<void>;
  setOnboardingCompleted: (completed: boolean) => void;
}

export const useProfileStore = create<ProfileState>((set, get) => ({
  profile: null,
  isLoading: false,
  onboardingCompleted: false,

  fetchProfile: async (userId) => {
    if (MOCK_MODE) return;
    console.log('Fetching profile for user:', userId);
    set({ isLoading: true });
    try {
      const isConnected = useNetworkStore.getState().isConnected;

      if (isConnected) {
        const profile = await getProfile(userId);
        if (profile) {
          console.log(
            'Profile found. onboardingCompleted:',
            profile.onboardingCompleted,
            'name:',
            profile.name,
          );
          set({
            profile,
            onboardingCompleted: profile.onboardingCompleted,
          });
          // Cache for offline use
          offlineCache.set(CACHE_KEYS.PROFILE, profile, userId);
          return;
        }
      }

      // Offline or no profile from server — try cache
      const cached = await offlineCache.get<UserProfile>(CACHE_KEYS.PROFILE, userId);
      if (cached) {
        console.log('Profile loaded from offline cache');
        set({
          profile: cached,
          onboardingCompleted: cached.onboardingCompleted,
        });
      } else {
        console.log('Profile not found for user:', userId);
      }
    } catch (e) {
      console.error('fetchProfile error:', e);
      // Fallback to cache on error
      const cached = await offlineCache.get<UserProfile>(CACHE_KEYS.PROFILE, userId);
      if (cached) {
        set({ profile: cached, onboardingCompleted: cached.onboardingCompleted });
      }
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (updates) => {
    const current = get().profile;
    const userId = current?.userId ?? (updates as any).userId;
    if (!userId) {
      console.warn('updateProfile called but no userId available');
      return;
    }

    console.log('Saving profile...', Object.keys(updates));

    // Build full local profile (merge with current if it exists)
    const base = current ?? {
      userId,
      name: '',
      age: 0,
      gender: '',
      height: 0,
      currentWeight: 0,
      targetWeight: 0,
      fitnessHistory: '',
      pastSports: [],
      peakFitnessLevel: '',
      currentActivityLevel: '',
      injuries: [],
      dietaryPreferences: {
        type: 'non-veg' as const,
        allergies: [],
        dislikes: [],
        cuisineRegion: '',
      },
      goals: { primaryGoal: '', targetTimeline: '', targetWeight: 0 },
      onboardingCompleted: false,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };
    const updated = { ...base, ...updates, updatedAt: new Date().toISOString() };
    set({
      profile: updated,
      onboardingCompleted: updated.onboardingCompleted,
      isLoading: true,
    });

    // Cache locally
    offlineCache.set(CACHE_KEYS.PROFILE, updated, userId);

    // Persist to Supabase
    if (!MOCK_MODE) {
      const isConnected = useNetworkStore.getState().isConnected;
      if (isConnected) {
        try {
          await upsertProfile(userId, updates);
          console.log('Profile saved successfully');
        } catch (e) {
          console.error('Profile save failed:', e);
        }
      } else {
        offlineQueue.enqueue('upsertProfile', [userId, updates]);
      }
    }
    set({ isLoading: false });
  },

  setOnboardingCompleted: (completed) => {
    set({ onboardingCompleted: completed });
    const current = get().profile;
    if (current) {
      const updated = { ...current, onboardingCompleted: completed };
      set({ profile: updated });
      offlineCache.set(CACHE_KEYS.PROFILE, updated, current.userId);

      if (!MOCK_MODE) {
        const isConnected = useNetworkStore.getState().isConnected;
        if (isConnected) {
          upsertProfile(current.userId, { onboardingCompleted: completed }).catch((e) =>
            console.error('[profileStore] setOnboardingCompleted persist error:', e),
          );
        } else {
          offlineQueue.enqueue('upsertProfile', [
            current.userId,
            { onboardingCompleted: completed },
          ]);
        }
      }
    }
  },
}));
