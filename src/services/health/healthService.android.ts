// Android stub — structure mirrors healthService.ios.ts exactly.
// Replace this body with react-native-health-connect (Health Connect API)
// when adding Android support. The IHealthService interface is identical,
// so swapping the implementation here is the only change needed.
//
// Health Connect quick-start:
//   npx expo install react-native-health-connect
//   Add HEALTH_CONNECT_* permissions to app.json android.permissions
//   Implement: requestPermission(), insertRecords([{ recordType: 'ExerciseSession', ... }])
import type { IHealthService, WorkoutSummary } from './types';

const healthService: IHealthService = {
  async saveWorkout(_workout: WorkoutSummary): Promise<boolean> {
    return false;
  },
};

export default healthService;
