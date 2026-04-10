import { create } from 'zustand';
import NetInfo from '@react-native-community/netinfo';

interface NetworkState {
  isConnected: boolean;
  startListening: () => () => void;
}

export const useNetworkStore = create<NetworkState>((set) => ({
  isConnected: true,

  startListening: () => {
    const unsubscribe = NetInfo.addEventListener((state) => {
      set({ isConnected: state.isConnected ?? true });
    });
    return unsubscribe;
  },
}));
