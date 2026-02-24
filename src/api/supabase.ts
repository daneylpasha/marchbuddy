// api/supabase.ts — Supabase client initialization
// Uses expo-secure-store for secure auth token persistence on device.

import { createClient } from '@supabase/supabase-js';
import * as SecureStore from 'expo-secure-store';
import { SUPABASE_URL, SUPABASE_ANON_KEY } from '../config/env';

const secureStoreAdapter = {
  getItem: async (key: string) => {
    try { return await SecureStore.getItemAsync(key); }
    catch { return null; }
  },
  setItem: async (key: string, value: string) => {
    try { await SecureStore.setItemAsync(key, value); }
    catch { /* keychain unavailable */ }
  },
  removeItem: async (key: string) => {
    try { await SecureStore.deleteItemAsync(key); }
    catch { /* keychain unavailable */ }
  },
};

export const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
  auth: {
    storage: secureStoreAdapter,
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: false,
    flowType: 'implicit',
  },
});
