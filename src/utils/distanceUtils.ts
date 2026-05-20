import { useSettingsStore } from '../store/settingsStore';

export type DistanceUnit = 'km' | 'miles';

const KM_PER_MILE = 1.609344;

export const convertDistance = (distanceKm: number, unit: DistanceUnit): number =>
  unit === 'miles' ? distanceKm / KM_PER_MILE : distanceKm;

export const formatDistance = (
  distanceKm: number,
  unit: DistanceUnit,
  decimals = 2,
): string => convertDistance(distanceKm, unit).toFixed(decimals);

export const getDistanceLabel = (unit: DistanceUnit): string =>
  unit === 'miles' ? 'mi' : 'km';

// Pace stored as minutes-per-km. Travelling one mile takes ~1.609x longer
// than one km at the same speed, so min/mi = min/km * KM_PER_MILE.
export const convertPace = (
  paceMinPerKm: number | null,
  unit: DistanceUnit,
): number | null => {
  if (paceMinPerKm == null || !isFinite(paceMinPerKm) || paceMinPerKm <= 0) return null;
  return unit === 'miles' ? paceMinPerKm * KM_PER_MILE : paceMinPerKm;
};

export const getPaceLabel = (unit: DistanceUnit): string =>
  unit === 'miles' ? '/mi' : '/km';

export const useDistanceUnit = (): DistanceUnit =>
  useSettingsStore((s) => s.distanceUnit);
