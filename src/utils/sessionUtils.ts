import { SessionSegment, GeoPoint, FeedbackRating } from '../types/session';

// Format duration as mm:ss
export const formatDuration = (seconds: number): string => {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

export const formatDurationMinutes = (minutes: number): string => {
  if (minutes < 60) return `${minutes} min`;
  const hrs = Math.floor(minutes / 60);
  const mins = minutes % 60;
  if (mins === 0) return `${hrs} hr`;
  return `${hrs} hr ${mins} min`;
};

// Calculate total duration from segments
export const calculateTotalDuration = (segments: SessionSegment[]): number => {
  return segments.reduce((sum, seg) => sum + seg.durationSeconds, 0);
};

// Get segment type display name
export const getSegmentTypeName = (type: SessionSegment['type']): string => {
  switch (type) {
    case 'warmup':  return 'Warmup';
    case 'walk':    return 'Walk';
    case 'run':     return 'Run';
    case 'cooldown': return 'Cooldown';
    default:        return 'Walk';
  }
};

// Haversine formula for distance calculation
export const haversineDistance = (point1: GeoPoint, point2: GeoPoint): number => {
  const R = 6371; // Earth's radius in km
  const dLat = toRad(point2.latitude - point1.latitude);
  const dLon = toRad(point2.longitude - point1.longitude);
  const lat1 = toRad(point1.latitude);
  const lat2 = toRad(point2.latitude);

  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.sin(dLon / 2) * Math.sin(dLon / 2) * Math.cos(lat1) * Math.cos(lat2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

const toRad = (deg: number): number => deg * (Math.PI / 180);

// Calculate total distance from route points
export const calculateRouteDistance = (points: GeoPoint[]): number => {
  if (points.length < 2) return 0;

  let total = 0;
  for (let i = 1; i < points.length; i++) {
    total += haversineDistance(points[i - 1], points[i]);
  }
  return total;
};

// Calculate pace (min/km)
export const calculatePace = (distanceKm: number, durationMinutes: number): number | null => {
  if (distanceKm <= 0) return null;
  return durationMinutes / distanceKm;
};

// Format pace for display ("5:30 /km")
export const formatPace = (paceMinPerKm: number | null): string => {
  if (paceMinPerKm === null || paceMinPerKm <= 0) return '--:--';
  const mins = Math.floor(paceMinPerKm);
  const secs = Math.round((paceMinPerKm - mins) * 60);
  return `${mins}:${secs.toString().padStart(2, '0')}`;
};

// Get feedback label
export const getFeedbackLabel = (rating: FeedbackRating): string => {
  switch (rating) {
    case 'too_easy':    return 'Too Easy';
    case 'just_right':  return 'Just Right';
    case 'challenging': return 'Challenging';
    case 'too_hard':    return 'Too Hard';
    default:            return 'Good';
  }
};

// Calculate week start (Monday) — all UTC to match session date strings
export const getWeekStartDate = (date: Date = new Date()): string => {
  const d = new Date(date);
  const day = d.getUTCDay(); // 0=Sun … 6=Sat
  const diff = d.getUTCDate() - day + (day === 0 ? -6 : 1);
  d.setUTCDate(diff);
  return d.toISOString().split('T')[0];
};

// Check if date string is today
export const isToday = (dateString: string): boolean => {
  const today = new Date().toISOString().split('T')[0];
  return dateString === today;
};

// Days since a given date
export const daysSince = (dateString: string | null): number | null => {
  if (!dateString) return null;
  const lastDate = new Date(dateString);
  const today = new Date();
  const diffTime = today.getTime() - lastDate.getTime();
  return Math.floor(diffTime / (1000 * 60 * 60 * 24));
};
