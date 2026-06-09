// Email allowlist for internal-only features. Add team members here. Stored
// as lowercase strings; the check normalizes the input email so users with
// mixed-case providers (e.g. iCloud) don't get accidentally locked out.
//
// To add a teammate: append their email below, lowercased, no whitespace.
const INTERNAL_TEAM_EMAILS = new Set<string>([
  'reach.dpasha@gmail.com',
  'tahibahmed999@gmail.com',
  'dev@rendernext.io',
]);

export function isInternalTeamMember(email: string | null | undefined): boolean {
  if (!email) return false;
  return INTERNAL_TEAM_EMAILS.has(email.trim().toLowerCase());
}

// Centralized feature-flag accessor. New flags should follow the same shape:
// each key is a function that takes whatever context it needs and returns a
// boolean. This keeps gate logic colocated and easy to flip later (e.g. once
// Community is ready for public release, change the implementation to
// `() => true` here without touching call sites).
export const featureFlags = {
  community: (email: string | null | undefined): boolean => isInternalTeamMember(email),
  buddy: (email: string | null | undefined): boolean => isInternalTeamMember(email),
};
