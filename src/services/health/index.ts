// Metro resolves './healthService' to the platform-specific file at build time:
//   iOS   → healthService.ios.ts  (react-native-health)
//   Android → healthService.android.ts (Health Connect stub)
// TypeScript sees healthService.ts for type checking.
export { default } from './healthService';
export type { WorkoutSummary, IHealthService } from './types';
