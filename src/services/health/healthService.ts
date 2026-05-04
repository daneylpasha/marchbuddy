// TypeScript base — used by the compiler for type checking.
// Metro bundler resolves this to healthService.ios.ts on iOS and
// healthService.android.ts on Android, so react-native-health is
// never included in the Android bundle.
import type { IHealthService, WorkoutSummary } from './types';

const healthService: IHealthService = {
  async saveWorkout(_workout: WorkoutSummary): Promise<boolean> {
    return false;
  },
};

export default healthService;
