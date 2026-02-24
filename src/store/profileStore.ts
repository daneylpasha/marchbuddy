import { create } from 'zustand';
import type { UserProfile } from '../types';
import { getProfile, upsertProfile } from '../api/database';
import { MOCK_MODE } from '../mock';

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
    console.log('📥 Fetching profile from Supabase for user:', userId);
    set({ isLoading: true });
    try {
      const profile = await getProfile(userId);
      if (profile) {
        console.log('📥 Profile found. onboardingCompleted:', profile.onboardingCompleted, 'name:', profile.name);
        set({
          profile,
          onboardingCompleted: profile.onboardingCompleted,
        });
      } else {
        console.log('📥 Profile not found for user:', userId);
      }
    } catch (e) {
      console.error('📥 ❌ fetchProfile error:', e);
    } finally {
      set({ isLoading: false });
    }
  },

  updateProfile: async (updates) => {
    const current = get().profile;

    // Determine userId — from existing profile or from the updates themselves
    const userId = current?.userId ?? (updates as any).userId;
    if (!userId) {
      console.warn('📝 updateProfile called but no userId available');
      return;
    }

    console.log('📝 Saving profile to Supabase...', Object.keys(updates));

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
      dietaryPreferences: { type: 'non-veg' as const, allergies: [], dislikes: [], cuisineRegion: '' },
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

    // Persist to Supabase
    if (!MOCK_MODE) {
      try {
        await upsertProfile(userId, updates);
        console.log('📝 ✅ Profile saved successfully');
      } catch (e) {
        console.error('📝 ❌ Profile save failed:', e);
      }
    }
    set({ isLoading: false });
  },

  setOnboardingCompleted: (completed) => {
    set({ onboardingCompleted: completed });
    const current = get().profile;
    if (current) {
      set({ profile: { ...current, onboardingCompleted: completed } });
      // Persist in background
      if (!MOCK_MODE) {
        upsertProfile(current.userId, { onboardingCompleted: completed }).catch((e) =>
          console.error('[profileStore] setOnboardingCompleted persist error:', e),
        );
      }
    }
  },
}));
