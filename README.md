# MarchBuddy

AI-powered fitness coaching app that generates personalized daily workout plans, culturally-aware meal plans, and provides real-time coaching via chat. Built with React Native and powered by Claude AI through Supabase Edge Functions.

## Tech Stack

- **Framework**: React Native (Expo SDK 54, managed workflow)
- **Language**: TypeScript (strict mode)
- **State Management**: Zustand v5
- **Backend**: Supabase (Auth, PostgreSQL, Edge Functions, RLS)
- **AI**: Anthropic Claude API (claude-sonnet-4-20250514) via Edge Functions
- **Navigation**: React Navigation v7 (bottom tabs + native stack)

## Setup

### 1. Clone and install

```bash
git clone <repo-url>
cd FitTransformAI
npm install
```

### 2. Environment variables

Copy the env config and fill in your Supabase credentials:

```bash
# Edit src/config/env.ts with your values:
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_ANON_KEY=your-anon-key
```

### 3. Database setup

Run the SQL migration in your Supabase SQL Editor:

```bash
# Copy contents of src/api/schema.sql into Supabase SQL Editor and execute
```

This creates 9 tables with Row Level Security policies and an auto-profile trigger.

### 4. Deploy Edge Functions

```bash
supabase functions deploy coach-chat
supabase functions deploy analyze-food
supabase functions deploy generate-workout
supabase functions deploy generate-meal-plan
supabase functions deploy weekly-summary
```

Set the Anthropic API key as a secret:

```bash
supabase secrets set ANTHROPIC_API_KEY=your-api-key
```

### 5. Run the app

```bash
npx expo start
```

## Folder Structure

```
src/
  api/            # Supabase client, database helpers, SQL schema
  components/     # Reusable UI components (common, chat, workout, nutrition, progress)
  config/         # App config, env variables
  hooks/          # Custom hooks (useNetworkStatus)
  navigation/     # App navigator, tab navigator, stack navigators
  screens/        # Screen components organized by feature
    auth/         # Login, SignUp
    onboarding/   # AI-driven onboarding chat flow
    home/         # Home dashboard
    chat/         # Coach chat screen
    workout/      # Workout tracker
    nutrition/    # Nutrition tracker, food snap
    water/        # Water tracking
    progress/     # Progress dashboard
    settings/     # Settings, edit profile
  services/       # AI service, daily plan orchestrator, onboarding service
  store/          # Zustand stores (auth, profile, workout, nutrition, water, chat, progress)
  types/          # TypeScript type definitions
  utils/          # Date utils, image utils, mock data
supabase/
  functions/      # Edge Functions (Deno runtime)
    _shared/      # Shared utilities (Claude API client, CORS)
```

## Mock / Fallback Mode

When Supabase is not configured or Edge Functions are unavailable, the app automatically falls back to mock data and pattern-matching AI responses. This allows the full UI to be tested without a backend connection. A yellow banner on the home screen indicates when fallback mode is active.
