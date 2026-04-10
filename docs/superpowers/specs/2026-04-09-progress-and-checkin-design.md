# Progress Screen + Pre-Workout Check-In — Design Spec

**Date:** 2026-04-09  
**Status:** Approved  
**Scope:** Phase 2 — Progress screen (full implementation) + pre-workout check-in screen (full implementation)

---

## Overview

Two features that complete the core training loop:

1. **Progress screen** — Dashboard showing stats, lift trends, session history, and consistency calendar. Reads entirely from local WatermelonDB; no network required.
2. **Pre-workout check-in** — 3-question screen before each workout. Saves answers locally, optionally calls the AI to suggest session adjustments, lets the user accept or skip changes.

---

## 1. Progress Screen

### Layout

Dashboard layout (no tabs). Three zones stacked vertically, all scrollable.

#### Zone 1 — Stats Row
Three stat tiles in a horizontal row:
- **Sessions this month** — count of completed sessions in the current calendar month
- **PRs hit** — count of sets where `is_pr = true` across all sessions
- **Week streak** — consecutive weeks with at least one completed session (forgiving: a week counts if any session was completed in it)

Numbers only. No interaction.

#### Zone 2 — Top Lifts
List of every unique exercise name that appears in at least one completed set, sorted: main lifts first (exercises where the session's planned category = `main`), then accessories.

Each row:
- Exercise name
- Best weight ever logged for that exercise
- Trend arrow: ↑ if the most recent session's max weight is higher than the previous session's max weight, → if equal, no arrow if only one session exists
- Tapping a row navigates to the lift drill-down screen

#### Zone 3 — Recent Sessions
Last 10 completed sessions (sorted newest first). Each entry shows:
- Date (e.g. "Apr 7")
- Session day label (e.g. "Day A — Lower Body Strength")
- Exercise names listed (comma-separated, truncated at 3 with "+N more")
- Total volume: sum of (weight × reps) across all sets in the session, shown as "12,450 lbs volume"

Tapping a session card **expands it inline** to show every set logged:
- Exercise name as a subheading
- Each set: "Set 1 — 185 lbs × 5 reps" with a PR badge if `is_pr = true`

#### Zone 4 — Consistency Calendar
Last 5 weeks displayed as rows of 7 day-dots (Mon–Sun). Green dot = session completed that day, empty circle = rest or missed. No streak punishment visual — purely informational. Current week shown last (bottom).

---

### Lift Drill-Down Screen

**Route:** `app/progress/[exercise].tsx`  
**Param:** `exercise` — URL-encoded exercise name

**Content:**
1. **Header** — Exercise name + back button
2. **PR callout** — Best weight ever logged for this exercise with the date
3. **Bar chart** — Best weight per session for the last 8 sessions. X-axis: session dates. Y-axis: weight. The PR bar is rendered in lime green (`#84CC16`), all others in blue (`#3B82F6`). Built with Victory Native.
4. **Session history list** — Every set ever logged for this exercise, grouped by session date (newest first). Each group shows date + sets as rows: "3 × 5 @ 185 lbs".

---

### Data Sources

All data read from WatermelonDB:

| Data | Table | Query |
|------|-------|-------|
| Session count | `sessions` | `completed_at IS NOT NULL`, current month |
| PRs hit | `sets` | `is_pr = true` |
| Week streak | `sessions` | Group by ISO week, count consecutive weeks |
| Top lifts | `sets` JOIN `sessions` | Distinct exercise names, max weight, last two sessions per exercise |
| Recent sessions | `sessions` | `completed_at IS NOT NULL`, limit 10, order by `completed_at DESC` |
| Session sets | `sets` | Filter by `session_id` |
| Consistency calendar | `sessions` | Last 35 days, group by date |
| Lift drill-down chart | `sets` | Filter by `exercise_name`, group by session, last 8 sessions |

---

## 2. Pre-Workout Check-In

### Route
`app/workout/[sessionId]/checkin.tsx` — replaces current stub.

### Routing Change
The "Start Workout" button on the home screen (`app/(tabs)/index.tsx`) routes to `checkin` instead of directly to `active`. The `checkin` screen then routes to `active` with the (possibly adjusted) session JSON.

### Screen Layout

One scrollable screen with three questions and a submit button. The submit button is disabled until all three questions are answered.

#### Question 1 — Energy Level
Label: "How's your energy today?"

Five full-width tappable buttons, top to bottom:
1. 🔥 Feeling great — let's go (value: 5)
2. 💪 Good, ready to train (value: 4)
3. 😐 Average, I'll push through (value: 3)
4. 😴 Low energy today (value: 2)
5. 💀 Running on fumes (value: 1)

Selected button highlighted in blue (`#3B82F6`). One selection required.

#### Question 2 — Sore or Tight?
Label: "Anything sore or tight?"

Chip grid, multi-select:
- Lower back
- Shoulders
- Knees
- Hips
- Hamstrings
- Quads
- Chest
- Nothing ← tapping this deselects all others and selects only "Nothing"; selecting any other chip deselects "Nothing"

Selecting zero chips is not allowed — user must tap at least one (including "Nothing").

#### Question 3 — Time Available
Label: "How much time do you have?"

Three large buttons in a row:
- **30 min**
- **45 min**
- **60 min+**

Selected button highlighted in blue. One selection required.

#### Submit Button
"Let's go →" — full-width, enabled only when all three questions answered.

---

### After Submitting

**Step 1 — Write to local DB immediately:**
Update the session record in WatermelonDB with:
- `energy_checkin` = energy value (1–5)
- `sore_areas` = JSON stringified array of selected chip labels (empty array if "Nothing")
- `time_available` = selected minutes (30, 45, or 60)

**Step 2 — AI adjustment (online only):**

If connected:
- Show loading state: "Checking in with your coach..." with a subtle activity indicator
- Call `adjust-session` Supabase Edge Function with:
  - `energy` (1–5)
  - `sore_areas` (array)
  - `time_available` (minutes)
  - `planned_session` (today's session JSON from the active program)
  - `last_session_summary` (exercise names + weights from the most recent completed session, or null)
- **If AI returns changes:** Show a summary card with:
  - What changed (e.g. "Dropped Romanian Deadlifts — lower back soreness noted. Trimmed to 4 exercises for 30 min.")
  - Two buttons: **Use adjusted workout** (blue) / **Keep original** (text button)
- **If AI call fails or times out (10s timeout):** Skip silently, proceed with original session
- **If user taps "Keep original":** Proceed with original planned session unchanged

If offline:
- Skip AI entirely, proceed directly to active workout. No error shown.

**Step 3 — Navigate to active workout:**
Push to `active` with `sessionId` and the final session JSON (either adjusted or original) as a param.

---

### Edge Function: `adjust-session`

Already scaffolded. Receives check-in answers + planned session, returns adjusted session JSON with an `adjustment_note` field explaining changes (or "No adjustments needed" if unchanged). Uses same OpenRouter/claude-sonnet-4-5 pattern as other functions.

---

## Files Affected

| File | Change |
|------|--------|
| `app/(tabs)/progress.tsx` | Full implementation — dashboard layout |
| `app/progress/[exercise].tsx` | New screen — lift drill-down with chart |
| `app/workout/[sessionId]/checkin.tsx` | Full implementation — 3-question check-in |
| `app/workout/[sessionId]/active.tsx` | Accept optional adjusted session JSON param |
| `app/(tabs)/index.tsx` | Route "Start Workout" to checkin instead of active |
| `supabase/functions/adjust-session/index.ts` | Implement the edge function (currently stubbed) |

---

## Dependencies to Install

- `victory-native` — required for the lift drill-down bar chart. Must be added to package.json and installed before implementing the drill-down screen.

## Out of Scope
- HealthKit data feeding into check-in (Phase 3)
- Weekly adaptation / coach message (requires auth + sync, Phase 2 later)
- Push notifications for workout reminders (Phase 3)
