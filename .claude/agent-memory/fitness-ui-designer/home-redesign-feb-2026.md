# HomeScreen Redesign - Feb 2026

## User Feedback
"Too verbose, not graphical enough"

## Key Problems Identified

### 1. Workout Card (Most Verbose)
- AI notes paragraph (6-8 lines) → Replace with icon badge or remove
- Muscle groups text list → Color-coded icon badges
- Text stats with labels → Icon + number only

### 2. Nutrition Card
- "Protein/Carbs/Fat" labels → Color-only identification
- Meal text list → 2x2 emoji grid with status dots
- Remove metadata text "Breakfast · 380 cal"

### 3. Streak Card
- M/T/W/T/F/S/S letters → Just dots
- "day streak" text → Remove entirely
- Goal badge text → Icon only

### 4. Stats Bar
- "weight", "workouts", "streak" labels → Replace with icons

### 5. General Text Reduction
- Remove "Today's" prefix from all cards
- Shorten greeting to name only
- Compact date format
- Water buttons: "+250ml" → "250" or just "+"

## Design Principle Applied
**"Communicate through color, icons, and numbers - not labels"**

Industry pattern: Nike/WHOOP/Strava/Peloton use ~80% less text on home screens.

## Components to Create
- `MuscleGroupIconBadge` - colored circles with muscle icons
- `MealIconGrid` - 2x2 food emoji grid
- `CompactStatIcon` - icon + number, no label
- `WeekProgressDots` - 7 dots, no day letters
- `IconLabel` - tiny icon above stat value
