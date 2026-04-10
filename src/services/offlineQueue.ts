import AsyncStorage from '@react-native-async-storage/async-storage';
import NetInfo from '@react-native-community/netinfo';

const QUEUE_KEY = 'mb-offline-queue';

export interface QueuedOperation {
  id: string;
  action: string; // e.g. 'updateWorkoutStatus', 'upsertWaterLog'
  args: unknown[];
  createdAt: number;
}

let isSyncing = false;
let unsubscribeNetInfo: (() => void) | null = null;

// Registry of functions that can be replayed
const actionRegistry: Record<string, (...args: any[]) => Promise<unknown>> = {};

export const offlineQueue = {
  registerAction(name: string, fn: (...args: any[]) => Promise<unknown>) {
    actionRegistry[name] = fn;
  },

  async enqueue(action: string, args: unknown[]): Promise<void> {
    try {
      const queue = await this.getQueue();
      const op: QueuedOperation = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        action,
        args,
        createdAt: Date.now(),
      };
      queue.push(op);
      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(queue));
      console.log(`[offlineQueue] enqueued: ${action}`);
    } catch (e) {
      console.error('[offlineQueue] enqueue error:', e);
    }
  },

  async getQueue(): Promise<QueuedOperation[]> {
    try {
      const raw = await AsyncStorage.getItem(QUEUE_KEY);
      return raw ? JSON.parse(raw) : [];
    } catch {
      return [];
    }
  },

  async processQueue(): Promise<void> {
    if (isSyncing) return;
    isSyncing = true;

    try {
      const queue = await this.getQueue();
      if (queue.length === 0) {
        isSyncing = false;
        return;
      }

      console.log(`[offlineQueue] processing ${queue.length} queued operations...`);
      const remaining: QueuedOperation[] = [];

      for (const op of queue) {
        const fn = actionRegistry[op.action];
        if (!fn) {
          console.warn(`[offlineQueue] unknown action: ${op.action}, skipping`);
          continue;
        }

        try {
          await fn(...op.args);
          console.log(`[offlineQueue] synced: ${op.action}`);
        } catch (e) {
          console.error(`[offlineQueue] failed: ${op.action}`, e);
          // Keep failed ops for retry (max 7 days old)
          const maxAge = 7 * 24 * 60 * 60 * 1000;
          if (Date.now() - op.createdAt < maxAge) {
            remaining.push(op);
          }
        }
      }

      await AsyncStorage.setItem(QUEUE_KEY, JSON.stringify(remaining));
      console.log(`[offlineQueue] done. ${remaining.length} remaining.`);
    } finally {
      isSyncing = false;
    }
  },

  async clear(): Promise<void> {
    await AsyncStorage.removeItem(QUEUE_KEY);
  },

  startListening() {
    if (unsubscribeNetInfo) return;
    unsubscribeNetInfo = NetInfo.addEventListener((state) => {
      if (state.isConnected) {
        this.processQueue();
      }
    });
  },

  stopListening() {
    if (unsubscribeNetInfo) {
      unsubscribeNetInfo();
      unsubscribeNetInfo = null;
    }
  },
};
