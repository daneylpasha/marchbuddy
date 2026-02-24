# Fitness UI/UX Designer Memory

## Project: FitTransformAI
React Native fitness app with workout, nutrition, progress tracking, and AI coach features.

## Tech Stack
- React Native (v0.81.5) with TypeScript
- React Navigation (bottom tabs + stack navigators)
- Expo framework
- Zustand for state management
- Ionicons for icons

## Current Color System (CORRECTED - actual theme file)
- **Background**: `#121212` (primary dark), `#1E1E1E` (surface), `#2A2A2A` (elevated)
- **Primary Accent**: `#00D4FF` (electric cyan) - main action color
- **Text**: `#F0F0F0` (primary), `#999` (secondary), `#666` (tertiary), `#555` (muted)
- **Success**: `#00E676`, **Warning**: `#FF9800`, **Danger**: `#FF3D71`
- **Macros**: Protein `#00D4FF`, Carbs `#FF9800`, Fat `#FF2D78`
- **Muscle groups**: Legs `#00E676`, Chest `#00D4FF`, Back `#FF6D00`, Shoulders `#AB47BC`, Core `#FFD600`, Arms `#FF3D71`
- **Water**: `#29B6F6`

## Typography (SYSTEM FONTS ONLY - No custom fonts yet)
- **screenTitle**: 28px, weight 700, letterSpacing -0.3
- **sectionTitle**: 17px, weight 600
- **cardTitle**: 17px, weight 600
- **statLarge**: 24px, weight 700, tabular-nums
- **body**: 15px, lineHeight 22
- **bodySecondary**: 14px
- **label**: 12px, weight 500
- **overline**: 11px, weight 700, uppercase, letterSpacing 0.8
- **caption**: 12px
- System fonts: SF Pro (iOS), Roboto (Android)

## Component Design Patterns

### Cards (`Card.tsx`)
- Background: `#2a2a2a`
- Border radius: 14px
- Padding: 16px
- Margin bottom: 14px
- Pressed state: 0.85 opacity

### Buttons
- **Primary CTA**: `#4f8ef7` background, white text, 12px border-radius, 15px vertical padding
- **Secondary**: Gray text, no background
- **Quick Action**: `#2a2a2a` background, row layout with icon+text
- **Water buttons**: `#29b6f622` background (transparent), 20px border-radius

### Status Badges
- Rounded (12px), colored background at 22% opacity, colored text
- Pending: blue, In-progress: orange, Completed: green, Skipped: gray

### Muscle Group Chips
- Small rounded pills (10px radius), colored backgrounds at 22% opacity, colored text
- Color-coded by muscle group

## Screen Inventory

### 1. Home Screen (`HomeScreen.tsx`)
- Greeting header with name, date, settings icon
- Streak card with fire emoji, day count, weekly dots (M-S)
- Workout card preview (exercises, duration, muscle groups, AI notes)
- Nutrition card preview (calorie ring, macro bars, meal list)
- Water card (progress bar, +250ml/+500ml buttons)
- Quick actions (Talk to Coach, Snap Food)
- Pull-to-refresh for plan regeneration

### 2. Workout Screen (`WorkoutScreen.tsx`)
- Title + date header
- Status badge (pending/in-progress/completed)
- Summary bar (exercise count, duration)
- Muscle group chips (color-coded)
- AI notes box with sparkles icon
- Exercise list (numbered cards)
- Bottom bar with Start/Complete/Skip buttons

### 3. Nutrition Screen (`NutritionScreen.tsx`)
- Large calorie ring with consumed/target/remaining
- Macro progress bars (Protein blue, Carbs orange, Fat pink)
- Meal cards list (emoji, name, calories, macros, action buttons)
- Snap Your Food card with camera icon
- Food snaps history

### 4. Progress Screen (`ProgressScreen.tsx`)
- Three stat cards (Weight, Waist, Streak) with trend indicators
- Weight trend chart (empty state shows icon+text)
- This Week calendar grid with completion dots
- Body measurements card
- Weekly AI summary card with insights
- Generate Summary button

### 5. Coach Chat Screen (`CoachChatScreen.tsx`)
- Header with green dot + "Always available" subtitle
- Inverted message list
- User messages: blue bubble on right
- Coach messages: gray bubble on left
- Camera icon + text input + send button in bottom bar
- Typing indicator for AI

### 6. Loading Screen (`LoadingScreen.tsx`)
- Blue spinner (`#4f8ef7`)
- Message text (18px semibold)
- Submessage (14px gray)

## Navigation
Bottom tab bar with 5 tabs: Home, Workout, Coach (center, emphasized), Nutrition, Progress
- Tab bar: `#1a1a1a` background, `#2a2a2a` border, 88px height
- Active color: `#4f8ef7`, Inactive: `#888`
- Coach tab slightly larger icon

## Spacing System
- Screen padding: 16px
- Card padding: 16px
- Card margin bottom: 14px
- Typical gaps: 6px, 8px, 10px, 12px, 14px, 16px, 18px, 20px

## Spacing System (from theme/index.ts)
- screenPadding: 20, cardPadding: 18, cardRadius: 16, cardMarginBottom: 14
- Scale: xs:4, sm:8, md:12, lg:16, xl:20, xxl:24
- Touch targets: min 48px, button 52px, iconButton 44px

## Known UI/UX Issues
- No custom fonts (system defaults lack character/premium feel)
- Typography hierarchy could be stronger (some sizes too close: 15/14/13/12)
- Screen titles could be larger for more impact
- Some button text uses ALL CAPS (feels dated)
- Needs evaluation: font pairing for dark-mode fitness aesthetic
