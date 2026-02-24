/** Returns today's date as YYYY-MM-DD */
export function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/** Human-readable date: "Monday, Feb 9" */
export function formatDate(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

/** Returns the Monday of the week containing `date` as YYYY-MM-DD */
export function getWeekStart(date: Date | string = new Date()): string {
  const d = typeof date === 'string' ? new Date(date) : new Date(date);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? 6 : day - 1; // Mon=0
  d.setDate(d.getDate() - diff);
  return d.toISOString().split('T')[0];
}

/** Returns time of day bucket */
export function getTimeOfDay(): 'morning' | 'afternoon' | 'evening' {
  const hour = new Date().getHours();
  if (hour < 12) return 'morning';
  if (hour < 17) return 'afternoon';
  return 'evening';
}

/** Returns the number of weeks since the given date (1-indexed, minimum 1). */
export function getWeekNumber(createdAt: string): number {
  const start = new Date(createdAt);
  const now = new Date();
  const diffMs = now.getTime() - start.getTime();
  const diffWeeks = Math.floor(diffMs / (7 * 24 * 60 * 60 * 1000));
  return Math.max(1, diffWeeks + 1);
}

/**
 * Returns the number of consecutive days the user has missed
 * (no completed/in-progress workout) counting backward from yesterday.
 * Returns 0 for new users with no history.
 */
export function computeMissedDays(
  recentDates: { date: string; status: string }[],
): number {
  if (recentDates.length === 0) return 0;
  const activeDates = new Set(recentDates.map((d) => d.date));
  let missed = 0;
  const d = new Date();
  d.setDate(d.getDate() - 1); // start from yesterday

  while (missed < 30) {
    const key = d.toISOString().split('T')[0];
    if (activeDates.has(key)) break;
    missed++;
    d.setDate(d.getDate() - 1);
  }
  return missed;
}

/**
 * Compute the longest streak from a sorted set of date strings.
 * Dates should be YYYY-MM-DD format.
 */
export function computeLongestStreak(activeDates: Set<string>): number {
  if (activeDates.size === 0) return 0;
  const sorted = Array.from(activeDates).sort();
  let longest = 1;
  let current = 1;
  for (let i = 1; i < sorted.length; i++) {
    const prev = new Date(sorted[i - 1]);
    const curr = new Date(sorted[i]);
    const diffDays = Math.round((curr.getTime() - prev.getTime()) / (1000 * 60 * 60 * 24));
    if (diffDays === 1) {
      current++;
      if (current > longest) longest = current;
    } else if (diffDays > 1) {
      current = 1;
    }
  }
  return longest;
}

/** Returns relative time: "2:30 PM" for today, "Yesterday" for yesterday, or date string */
export function getRelativeTime(date: string): string {
  const d = new Date(date);
  const now = new Date();
  const today = now.toISOString().split('T')[0];
  const yesterday = new Date(now.getTime() - 86400000).toISOString().split('T')[0];
  const dateStr = d.toISOString().split('T')[0];

  if (dateStr === today) {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
  }
  if (dateStr === yesterday) {
    return 'Yesterday';
  }
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}
