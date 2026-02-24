// config/env.ts — Environment configuration
// TODO: Replace placeholder values with real credentials before deploying.

export const SUPABASE_URL = 'https://yhfprdyivtedzwlzafnr.supabase.co';

export const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InloZnByZHlpdnRlZHp3bHphZm5yIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzA2MjU0NDQsImV4cCI6MjA4NjIwMTQ0NH0.opGN9vQxQ0fXfP0k-C_L3R7FVxb61NS7tLv2jRNwNLQ';

// This key is used server-side only via Supabase Edge Functions.
// NEVER bundle this into the client app — set it as a secret in Supabase Edge Functions.
// Stored here only as reference; the actual key must be set via:
//   supabase secrets set ANTHROPIC_API_KEY=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
export const ANTHROPIC_API_KEY = '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';
