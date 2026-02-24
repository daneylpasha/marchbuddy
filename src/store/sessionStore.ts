import { create } from 'zustand';
import { SessionOptions, SessionPlan } from '../types/session';

export interface PlanAdjustment {
  type: string;           // 'reduce_duration' | 'injury_rest' | 'increase_intensity'
  suggestedVariant: string; // 'quick' | 'rest' | 'challenge'
  validUntil: string;     // ISO timestamp — valid until midnight
}

interface SessionState {
  // Today's options
  todayOptions: SessionOptions | null;
  isLoadingOptions: boolean;

  // Selected session
  selectedPlan: SessionPlan | null;

  // Coach-triggered plan adjustment
  planAdjustment: PlanAdjustment | null;

  // Actions
  setTodayOptions: (options: SessionOptions) => void;
  setSelectedPlan: (plan: SessionPlan | null) => void;
  clearTodayOptions: () => void;
  setLoadingOptions: (loading: boolean) => void;
  setPlanAdjustment: (adj: PlanAdjustment) => void;
  clearPlanAdjustment: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  todayOptions: null,
  isLoadingOptions: false,
  selectedPlan: null,
  planAdjustment: null,

  setTodayOptions: (options) => {
    set({ todayOptions: options, isLoadingOptions: false });
  },

  setSelectedPlan: (plan) => {
    set({ selectedPlan: plan });
  },

  clearTodayOptions: () => {
    set({ todayOptions: null, selectedPlan: null });
  },

  setLoadingOptions: (loading) => {
    set({ isLoadingOptions: loading });
  },

  setPlanAdjustment: (adj) => {
    set({ planAdjustment: adj });
  },

  clearPlanAdjustment: () => {
    set({ planAdjustment: null });
  },
}));
