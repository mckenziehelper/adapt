# 💪 Adapt — Claude Code Briefing

## What We're Building
**Adapt** is an AI-powered weightlifting app for busy people who are serious about lifting but not obsessed with it. The core promise: your program adapts to your life, not the other way around.

**Target User:** People who lift 3x a week, have 30 minutes per session, have probably tried and quit other programs, and want results without having to think about programming.

**The founder IS the target user** — build what you personally need and would use every day.

**Tagline:** *"Your program adapts to your life."*
**Positioning:** *"For people who are serious about lifting but not obsessed with it."*

---

## What Makes Adapt Different

Every other lifting app assumes your life is consistent. Adapt assumes it isn't.

- Missed a session? Adapt reshuffles the week automatically
- Only got 20 minutes today? Adapt trims intelligently — keeps main lifts, drops accessories
- Crushed a PR? Adapt accelerates progression
- Feeling beat up? Adapt gives you a deload without you needing to know what a deload is
- Ran 5 miles yesterday? Adapt scales back today's leg day
- Slept 5 hours? Adapt factors that into your recovery score

**The AI isn't just generating workouts. It's managing your entire training life.**

---

## Tech Stack

| Layer | Tool | Notes |
|---|---|---|
| Framework | React Native (Expo) | Single codebase — iOS + Android |
| AI | OpenRouter API | Program generation, adaptation, coach messages — model: `anthropic/claude-sonnet-4-5` |
| Backend / Auth | Supabase | Auth, data, edge functions |
| Payments | RevenueCat | Subscriptions + one-time purchases |
| Health Data | Apple HealthKit + Google Fit | Read-only — cardio, sleep, steps, HRV |
| Apple Watch Import | HealthKit workout history | Onboarding cold start fix |
| Navigation | Expo Router | File-based routing |
| Styling | NativeWind (Tailwind for RN) | Utility-first styling |
| Charts | Victory Native | Progress graphs |
| Notifications | Expo Notifications | Weekly coach message, workout reminders |
| Local Database | WatermelonDB | Offline-first SQLite — all writes go here first |
| Sync | WatermelonDB sync protocol | Queue locally, flush to Supabase on reconnect |
| Network Detection | @react-native-community/netinfo | Connectivity state + offline banner |

---

## Brand & Design Language

- **Name:** Adapt
- **Colors:**
  - Near Black: `#0F0F0F` (primary background)
  - Electric Blue: `#3B82F6` (primary accent, CTAs)
  - Lime Green: `#84CC16` (success, PRs, streaks)
  - Warm White: `#F8F8F6` (text on dark)
  - Steel: `#374151` (secondary surfaces)
  - Muted: `#6B7280` (secondary text)
- **Fonts:** Syne (headings — bold, athletic) + DM Sans (body — clean, readable)
- **Tone:** Smart coach who respects your time. Confident but not arrogant. Celebrates your wins. Honest about what's not working. Never preachy.
- **Energy:** Quiet confidence. Not a hype machine. Not a spreadsheet. A coach.

---

## Offline Mode — Non-Negotiable

Gyms have terrible WiFi. The workout screen must work with zero connectivity, full stop.

### What Works Offline (Always)
- ✅ View today's workout (pre-cached on app open)
- ✅ Log sets, reps, weight
- ✅ Rest timer
- ✅ Complete a session
- ✅ View current program
- ✅ View last 30 days of history (cached)

### What Waits for Connectivity
- ☁️ Syncing completed session to Supabase
- ☁️ Weekly AI adaptation (runs server-side Sunday anyway)
- ☁️ Coach message delivery
- ☁️ Subscription status refresh (cached locally for 7 days)

### What Requires Connectivity (Acceptable)
- 🌐 First-time program generation (onboarding)
- 🌐 Account creation / login
- 🌐 Purchasing Pro subscription
- 🌐 Pre-workout AI session adjustment

### Architecture — Offline First

**All writes go to WatermelonDB first, always. Supabase is the sync target, not the source of truth during a session.**

```typescript
// lib/sync.ts

// On every app open with connectivity:
// 1. Pull latest program from Supabase → WatermelonDB
// 2. Pull last 30 days history → WatermelonDB
// 3. Cache coach message → MMKV (simple key-value)
// 4. Cache Pro status → MMKV (expires after 7 days)

// During workout (online or offline):
// All set logging → WatermelonDB only

// On reconnect (NetInfo listener):
// Flush sync queue → Supabase
// Confirm sync → mark records as synced
// Retry with exponential backoff on failure
// Never silently drop data
```

### Sync Queue Pattern
```typescript
type SyncQueueItem = {
  id: string
  table: 'sessions' | 'sets'
  operation: 'create' | 'update'
  payload: object
  created_at: number
  synced: boolean
  retry_count: number
}

// Queue persists across app restarts
// Flushes automatically when connectivity returns
// User never sees or manages this — it's invisible
```

### Offline UI Rules
- Show a subtle banner when offline: `⚡ Offline — syncs when you reconnect`
- Never show an error during a workout
- Never block logging a set because of connectivity
- Never show a spinner waiting for network during active workout
- Subscription lapse during offline: cache Pro status 7 days, then soft prompt to reconnect — never block a workout

### What to Cache on App Open
```typescript
// lib/cache.ts — runs on every app open with connectivity
async function warmCache(userId: string) {
  await syncProgramToLocal(userId)        // current program
  await syncHistoryToLocal(userId, 30)   // last 30 days
  await cacheCoachMessage(userId)        // latest coach message
  await cacheProStatus(userId)           // subscription status (7-day TTL)
}
```

---

## What You Build vs What You Read

This distinction is critical — don't build what already exists:

| Data Type | Approach | Effort |
|---|---|---|
| Weightlifting sessions | **Build fully** — core product | High |
| Apple Watch workout history | **Import via HealthKit** — onboarding | Low |
| Running / Cardio | **Read from HealthKit** — inform AI only | Low |
| Steps / Activity | **Read from HealthKit** — recovery scoring | Low |
| Sleep | **Read from HealthKit** — energy check-ins | Low |
| HRV | **Read from HealthKit** — recovery scoring | Low |
| Yoga / Stretching | **Light manual logging** — duration + type | Phase 3 |
| Cycling | **Read from HealthKit** — inform AI only | Low |

The AI gets smarter with every data source. But you only *build* the lifting side.

---

## Core User Flow

```
1. Onboarding (5 questions max — reduce friction to zero)
   ├── Import Apple Watch history? (Yes / Start Fresh)
   ├── Training history (Never lifted / Some experience / Been lifting 2+ years)
   ├── Goal (Get stronger / Look better / Both)
   ├── Available days per week (2 / 3 / 4)
   ├── Equipment (Full gym / Home with weights / Bodyweight only)
   └── Current lifts (optional — squat, bench, deadlift 1RM estimates)
   → AI generates personalized program immediately
   → No account required to see first workout (reduce friction)

2. Home Screen
   ├── Today's workout (or rest day)
   ├── Weekly coach message (Sunday delivery)
   ├── Current streak
   └── Quick stats (this week's volume, avg session time)

3. Pre-Workout Check-In (30 seconds max)
   ├── Energy level (1-5)
   ├── Anything sore or tight? (quick body map tap)
   └── Time available today (30 min / 45 min / 60 min+)
   → AI adjusts today's session based on answers

4. Workout Screen
   ├── Exercise name + video demo link
   ├── Sets / reps / weight targets
   ├── Built-in rest timer (smart defaults per exercise type)
   ├── One-tap set logging
   ├── Weight adjustment (+ / - per set)
   └── Swap exercise button (AI picks best substitute)

5. Post-Workout Summary
   ├── Session stats (time, volume, PRs hit)
   ├── AI reaction (one sentence — what it noticed)
   ├── Quick rating (thumbs up / thumbs down)
   └── Optional note

6. Progress Screen
   ├── Key lift trend charts (squat, bench, deadlift + accessories)
   ├── Volume over time
   ├── AI monthly summary
   └── Consistency calendar (forgiving — miss one day, streak survives)

7. Profile / Settings
   ├── Equipment change (gym → travel → home)
   ├── Schedule change
   ├── HealthKit permissions
   └── Subscription management
```

---

## The AI System — Core Prompts

### 1. Program Generation Prompt

**System:**
```
You are Adapt's AI coach — a smart, experienced strength coach who specializes in programming for busy people. You understand progressive overload, periodization, and recovery. You're not a hype machine. You're direct, evidence-based, and you respect the user's time.

Your programs are:
- Always 3 days per week unless specified otherwise
- Built around compound movements (squat, hinge, push, pull, carry)
- Progressive — weights increase systematically
- Realistic — accessory work is minimal and purposeful, not excessive
- Adaptable — you'll be adjusting this weekly based on performance

Always respond in valid JSON only. No markdown, no explanation outside the JSON.
```

**User prompt template:**
```
Generate a personalized 3-day lifting program for this user:
- Training history: {training_history}
- Goal: {goal}
- Equipment: {equipment}
- Current estimated lifts: Squat {squat}lbs, Bench {bench}lbs, Deadlift {deadlift}lbs
- Apple Watch history summary: {watch_summary} (null if not imported)
- Time per session: {session_time} minutes

Respond in this exact JSON format:
{
  "program_name": "string — give it a name that fits their goal",
  "weekly_structure": "string — e.g. Mon/Wed/Fri or flexible 3 days",
  "sessions": [
    {
      "day": "A",
      "focus": "string — e.g. Lower Body Strength",
      "exercises": [
        {
          "name": "string",
          "category": "main|accessory|warmup",
          "sets": number,
          "reps": "string — e.g. 5 or 8-10 or AMRAP",
          "starting_weight": number,
          "progression": "string — e.g. +5lbs per session or +2.5lbs weekly",
          "rest_seconds": number,
          "notes": "string — coaching cue or substitution note"
        }
      ]
    }
  ],
  "coach_note": "string — 2-3 sentences explaining why you designed it this way"
}
```

---

### 2. Weekly Adaptation Prompt

Run every Sunday night after the week's sessions are logged.

**System:** (same as above)

**User prompt template:**
```
Review this user's week and adapt their program for next week.

This week's plan vs actual:
{planned_vs_actual_sessions}

Pre-workout check-ins this week:
{checkins}

HealthKit data this week:
- Cardio sessions: {cardio_summary}
- Average sleep: {avg_sleep} hours
- Average steps: {avg_steps}
- HRV trend: {hrv_trend}

Current program:
{current_program_json}

User's overall goal: {goal}
Weeks on this program: {weeks}

Analyze what happened and respond in this exact JSON format:
{
  "changes": [
    {
      "type": "weight_increase|weight_decrease|exercise_swap|volume_change|deload|rest_day_added",
      "exercise": "string",
      "reason": "string — plain English explanation of why",
      "old_value": "string",
      "new_value": "string"
    }
  ],
  "plateau_detected": {
    "detected": boolean,
    "exercise": "string or null",
    "weeks_stalled": number,
    "intervention": "string — what you're doing about it"
  },
  "weekly_coach_message": "string — 3-4 sentences. Conversational, specific, honest. Reference actual things that happened this week. Celebrate wins. Flag concerns. Tell them what changed and why. Use 'I' as the AI coach. Never be generic.",
  "next_week_focus": "string — one sentence priority for next week"
}
```

### Example Great Coach Message
```
"Your squat is on a 4-week run of hitting targets — I've bumped it 10lbs this week, you've earned it. I noticed you ran Tuesday and Wednesday before leg day Thursday, which probably explains why that session felt heavy — I've moved your next leg day to give you a full day buffer from cardio. Sleep averaged 5.9 hours this week which is your real limiter right now; your body repairs muscle during sleep, not during the workout. One thing at a time though — consistency this week was perfect."
```

**Key tone rules:**
- Always specific — reference actual exercises, actual numbers, actual days
- Hedge HealthKit data appropriately — "it looks like" not "because you"
- Celebrate consistency as much as PRs
- Never preachy about sleep/diet — mention it once, move on
- End with something forward-looking

---

### 3. Plateau Detection Logic

Plateau = same weight, same reps, 3+ consecutive weeks on a main lift.

**Response options the AI can choose:**
- Variation swap (pause reps, tempo, different grip)
- Rep range shift (5x5 → 3x8)
- Deload week (60% weight, focus on form)
- Accessory focus (strengthen weak point)
- Volume increase before intensity increase

---

### 4. Pre-Workout Session Adjustment Prompt

Quick — runs when user completes check-in.

```
User check-in before today's workout:
- Energy: {energy}/5
- Soreness: {sore_areas}
- Time available: {time} minutes
- Planned session: {session_json}
- Last session: {last_session_summary}

Adjust today's session if needed. If energy < 3 or time < planned, modify.
If everything is fine, return the session unchanged.

Respond in same session JSON format as the program.
Include a "adjustment_note" field explaining any changes made (or "No adjustments needed" if unchanged).
```

---

## Monetization

### Free Tier
- Full access for first 4 weeks (hook them on the adaptation)
- After 4 weeks: 1 program only, no AI adaptation, 30-day history
- Weekly coach message preview (first sentence only)
- HealthKit import on onboarding always free

### Adapt Pro — $12.99/month or $79.99/year
- Full AI adaptation engine (the whole product)
- Weekly coach message in full
- Pre-workout AI check-in adjustments
- Unlimited program history
- Equipment change handling
- Plateau detection + interventions
- Full HealthKit integration (sleep, HRV, cardio informing AI)
- Monthly AI progress summary

### One-Time Purchases
- Specific program packs — $4.99 each
  - Beginner Strength (Starting Strength style)
  - Pure Hypertrophy (bodybuilding focus)
  - Athlete (power + conditioning)
  - Home Warrior (dumbbells + bodyweight only)

### Pricing Rationale
*"Less than one personal training session, every month."*
$12.99/month is below the guilt threshold for someone already paying $50+/month for a gym.

---

## Paywall Logic

```typescript
const TRIAL_WEEKS = 4

if (user.weeksOnApp > TRIAL_WEEKS && !user.isPro) {
  // Show paywall before adaptation runs
  // Always let them complete the workout — never block mid-session
}
```

Never block a workout in progress. Show paywall after completion or before starting a new week.

---

## Supabase Schema

```sql
-- User profiles
create table profiles (
  id uuid references auth.users primary key,
  created_at timestamptz default now(),
  is_pro boolean default false,
  revenuecat_id text,
  goal text, -- 'stronger' | 'look_better' | 'both'
  equipment text, -- 'full_gym' | 'home' | 'bodyweight'
  sessions_per_week integer default 3,
  minutes_per_session integer default 30,
  weeks_on_app integer default 0,
  healthkit_connected boolean default false,
  watch_history_imported boolean default false
);

-- Programs
create table programs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  created_at timestamptz default now(),
  is_active boolean default true,
  program_json jsonb, -- full AI-generated program
  coach_note text,
  version integer default 1 -- increments on each adaptation
);

-- Workout sessions
create table sessions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  program_id uuid references programs(id),
  created_at timestamptz default now(),
  completed_at timestamptz,
  session_day text, -- 'A' | 'B' | 'C'
  planned_json jsonb,
  actual_json jsonb,
  energy_checkin integer, -- 1-5
  sore_areas text[],
  time_available integer, -- minutes
  rating integer, -- 1 (thumbs down) | 2 (thumbs up)
  user_note text,
  ai_reaction text
);

-- Individual sets logged
create table sets (
  id uuid primary key default gen_random_uuid(),
  session_id uuid references sessions(id),
  exercise_name text,
  set_number integer,
  target_reps text,
  actual_reps integer,
  weight numeric(6,2),
  is_pr boolean default false,
  completed_at timestamptz default now()
);

-- Weekly adaptations
create table adaptations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  created_at timestamptz default now(),
  week_start date,
  changes_json jsonb,
  plateau_detected boolean default false,
  plateau_exercise text,
  coach_message text,
  next_week_focus text
);

-- Coach messages (for notification + history)
create table coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references profiles(id),
  created_at timestamptz default now(),
  message text,
  week_start date,
  read boolean default false
);
```

---

## HealthKit Integration

### Permissions to Request
```typescript
const healthKitPermissions = {
  read: [
    'HKWorkoutTypeIdentifier',           // workout history
    'HKQuantityTypeIdentifierStepCount', // daily steps
    'HKCategoryTypeIdentifierSleepAnalysis', // sleep
    'HKQuantityTypeIdentifierHeartRateVariabilitySDNN', // HRV
    'HKQuantityTypeIdentifierActiveEnergyBurned', // calories
    'HKQuantityTypeIdentifierDistanceWalkingRunning', // running distance
  ]
}
```

### Apple Watch Import — Onboarding Flow
```typescript
// Pull last 6 months of HealthKit workout data
// Filter for: Running, Cycling, HIIT, Functional Strength Training
// Summarize for AI: frequency, types, avg duration, consistency score
// Pass summary to program generation prompt as {watch_summary}
// This lets AI skip the guessing phase on fitness level
```

### Weekly HealthKit Summary — For Adaptation
```typescript
// Pull each Sunday night before adaptation runs:
// - Cardio sessions (type, duration, distance, calories)
// - Sleep (avg hours, consistency)
// - Daily steps (avg)
// - HRV readings (trend — improving/declining/stable)
// Summarize and inject into adaptation prompt
```

---

## File Structure

```
app/
  (auth)/
    login.tsx
    signup.tsx
  (onboarding)/
    welcome.tsx         ← Import Apple Watch or start fresh
    questions.tsx       ← 5-question flow
    generating.tsx      ← AI generating program (loading)
    ready.tsx           ← Program reveal
  (tabs)/
    index.tsx           ← Home — today's workout + coach message
    progress.tsx        ← Charts + history
    profile.tsx         ← Stats + settings
  workout/
    [sessionId]/
      checkin.tsx       ← Pre-workout check-in
      active.tsx        ← Live workout screen
      summary.tsx       ← Post-workout summary
  paywall.tsx
  coach-message.tsx     ← Full weekly message view

components/
  WorkoutCard.tsx       ← Today's session preview
  ExerciseRow.tsx       ← Individual exercise in active workout
  SetLogger.tsx         ← Tap to log sets/reps/weight
  RestTimer.tsx         ← Animated countdown
  PRBadge.tsx           ← Celebration when PR hit
  CoachMessage.tsx      ← Weekly message card
  ProgressChart.tsx     ← Lift trend chart
  AdaptationSummary.tsx ← What changed this week + why
  PaywallModal.tsx      ← Upgrade prompt
  HealthKitPrompt.tsx   ← Permission request UI

lib/
  claude.ts             ← All AI prompt calls
  supabase.ts           ← Supabase client
  watermelon.ts         ← WatermelonDB setup + models
  sync.ts               ← Sync queue, cache warming, reconnect handler
  healthkit.ts          ← HealthKit read helpers
  revenuecat.ts         ← Subscription management
  adaptation.ts         ← Weekly adaptation orchestration
  programs.ts           ← Program CRUD helpers (reads from local DB first)

constants/
  theme.ts              ← Colors, fonts, spacing
  prompts.ts            ← All AI prompts (iterate here)
  exercises.ts          ← Exercise library with video links

supabase/
  functions/
    generate-program/   ← AI program generation (server-side)
    adapt-program/      ← Weekly adaptation (server-side, cron)
    adjust-session/     ← Pre-workout adjustment (server-side)
```

---

## MVP Build Order

### Phase 1 — Core Loop (Weekend 1-2)
- [ ] Expo project setup with NativeWind
- [ ] WatermelonDB setup + models (sessions, sets, exercises)
- [ ] Onboarding flow (5 questions, skip HealthKit for now)
- [ ] Supabase Edge Function: generate-program
- [ ] Cache program locally on generation (first offline seed)
- [ ] Active workout screen — reads from local DB, writes to local DB only
- [ ] Rest timer
- [ ] Post-workout summary
- [ ] NetInfo offline banner (subtle, non-blocking)
- [ ] **Ship to TestFlight — take it to the gym, test offline for real**

### Phase 2 — Sync + AI Magic (Weekend 3-4)
- [ ] Supabase auth (email + Apple Sign In)
- [ ] Sync queue — flush local sessions to Supabase on reconnect
- [ ] Cache warming on app open (program, history, coach message)
- [ ] Pre-workout check-in screen (requires connectivity — graceful fallback if offline)
- [ ] Supabase Edge Function: adapt-program (run manually first, then automate)
- [ ] Weekly coach message display
- [ ] Progress charts (Victory Native — reads from local DB)

### Phase 3 — HealthKit + Monetization (Weekend 5-6)
- [ ] HealthKit permissions + Apple Watch history import
- [ ] HealthKit weekly data pull feeding adaptation
- [ ] RevenueCat integration
- [ ] Paywall screen (real subscriptions)
- [ ] Push notifications (workout reminders + Sunday coach message)

### Phase 4 — Polish + Launch (Weekend 7-8)
- [ ] Animations and transitions
- [ ] Exercise video demos
- [ ] PR celebrations (confetti, sound)
- [ ] App Store screenshots + preview video
- [ ] App Store submission

---

## Environment Variables

```bash
EXPO_PUBLIC_SUPABASE_URL=your_supabase_url
EXPO_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key
OPENROUTER_API_KEY=your_openrouter_key        # server-side only — never expose
REVENUECAT_API_KEY_IOS=your_rc_ios_key
REVENUECAT_API_KEY_ANDROID=your_rc_android_key
```

⚠️ **NEVER expose OPENROUTER_API_KEY client-side. All AI calls go through Supabase Edge Functions.**

---

## Supabase Edge Function — AI Call Pattern

All AI calls use OpenRouter. Response format is OpenAI-compatible.

```typescript
// supabase/functions/_shared/openrouter.ts
const OPENROUTER_BASE = 'https://openrouter.ai/api/v1/chat/completions'
const MODEL = 'anthropic/claude-sonnet-4-5' // swap here if needed

async function callAI(systemPrompt: string, userPrompt: string): Promise<string> {
  const response = await fetch(OPENROUTER_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${Deno.env.get('OPENROUTER_API_KEY')}`,
      'HTTP-Referer': 'https://adapt.app', // your app URL
      'X-Title': 'Adapt'
    },
    body: JSON.stringify({
      model: MODEL,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userPrompt }
      ],
      response_format: { type: 'json_object' } // enforce JSON output
    })
  })

  const data = await response.json()
  return data.choices[0].message.content // OpenAI-compatible response shape
}
```

Always parse the returned string as JSON. Wrap in try/catch — if parsing fails, log the raw response and return a safe fallback.

---

## Marketing Strategy

### Pre-Launch (Before App Store)
**Goal:** 20 real beta users. Prove retention before acquisition.

- Post in r/fitness, r/weightroom, r/beginnerfitness:
  *"Building an AI lifting app for busy people — looking for 20 beta testers in exchange for honest feedback and free Pro forever"*
- Post in Facebook Groups: busy professionals fitness, dads who lift
- DM 10 people personally who gym inconsistently
- These 20 people = first App Store reviews on launch day

### Launch Day
- **Product Hunt** — submit Tuesday
- Headline: *"Adapt — The lifting app that adjusts to your life, not the other way around"*
- Share in relevant subreddits same day (honest, no spam)

### Organic Social (Ongoing — 3x per week)
Best performing content angles:
- **"The AI noticed something I didn't"** — screenshot of coach message catching a plateau
- **"I missed 3 workouts — here's what the AI did"** — shows real-life adaptation
- **"Day 1 vs Day 90 — what changed in my program"** — adaptation engine in action
- **"I imported my Apple Watch and the AI immediately said..."** — onboarding magic moment
- **Building in public** — weekly update on users, revenue, what's being built

Platform priority: TikTok + Instagram Reels first, Twitter/X for building in public

### Reddit Strategy (Underrated, Free, High Intent)
- Be genuinely helpful in r/fitness, r/weightroom, r/gainit, r/leangains
- Answer programming questions — mention Adapt naturally when relevant
- "Show HN" post on Hacker News when ready
- One honest Reddit post in the right community can outperform a week of TikToks

### Micro-Influencer Outreach
Target: 5k-50k followers, specific niches:
- Lifting-focused creators
- "Dad bod to fit dad" transformation accounts
- Busy professional / productivity creators (their audience = your user)
- Pitch: lifetime Pro, no obligation, honest review only

### Paid Acquisition (Month 3+ only — after retention is proven)
- Meta ads: target 30-45yo busy professionals, use coach message screenshot as creative
- TikTok Spark Ads: boost best organic content
- Apple Search Ads: bid on "lifting tracker", "workout app", "personal trainer app"
- Start $10/day, test 3-5 creatives, kill losers, scale winners

### Press Angles
- Fitness newsletters: BarBend, Morning Chalk Up
- Productivity newsletters: Ali Abdaal audience = exact target user
- Local news: founder story always gets covered locally
- Pitch: *"AI fitness coach built by a busy person who was tired of apps that assume you have unlimited time"*

### The Real Marketing Asset
**The weekly coach message IS the marketing.** When it says something genuinely insightful, users screenshot and share it unprompted. Engineer it to be impressive — specific, personal, a little surprising. That's word of mouth you can't buy.

### Realistic Revenue Timeline
| Month | Focus | Target |
|---|---|---|
| Pre-launch | 20 beta users, nail retention | Prove Day-30 retention > 40% |
| Month 1 | Product Hunt + Reddit + social | 500 downloads, first paid users |
| Month 2 | Micro-influencer outreach | 1,500 downloads, $500 MRR |
| Month 3 | Double down on what worked | 3,000 downloads, $1,500 MRR |
| Month 6 | Paid acquisition if unit economics work | $5,000 MRR |

---

## Key Product Decisions & Reasoning

- **Offline-first architecture** — WatermelonDB is the local source of truth during workouts, Supabase is the sync target. Never depend on connectivity mid-session.
- **Cache warming on app open** — pull program + history to local DB whenever online, so the gym experience is always fast and reliable
- **Sync queue never drops data** — retry with backoff, persist across restarts, confirm before marking synced
- **Offline banner is subtle** — inform, never alarm. A tiny banner, not a modal or error screen
- **Pro status cached 7 days** — never punish a paying user for having bad gym WiFi
- **4-week free trial** — long enough to experience real adaptation, creates genuine attachment before paywall
- **Never block mid-workout** — paywall shows after session or before starting new week, never during
- **All AI calls server-side via OpenRouter** — `OPENROUTER_API_KEY` never exposed client-side, all calls go through Supabase Edge Functions. Model: `anthropic/claude-sonnet-4-5` — swap in one place if needed
- **HealthKit read-only** — never ask to write, keeps permissions simpler and trust higher
- **Forgiving streak** — miss one day, streak survives. Consistency over perfection is the whole brand
- **Coach message hedges HealthKit data** — "it looks like you ran" not "because you ran" — AI humility builds trust
- **Onboarding: no account required to see first workout** — reduce friction to absolute minimum
- **Founder is the user** — when in doubt, build what you personally need

---

## First Commands to Run

```bash
npx create-expo-app adapt --template blank-typescript
cd adapt
npx expo install nativewind tailwindcss
npx expo install expo-health-kit
npx expo install expo-notifications
npx expo install react-native-purchases        # RevenueCat
npm install @supabase/supabase-js
npm install @nozbe/watermelondb                # Offline-first local DB
npm install @react-native-community/netinfo    # Connectivity detection
npm install react-native-mmkv                  # Fast key-value cache (Pro status, coach message)
npm install victory-native
npx expo install expo-camera expo-image-picker
```

Note: No Anthropic SDK needed — all AI calls go through OpenRouter via Supabase Edge Functions using a plain `fetch`. OpenRouter is OpenAI-compatible, no special client library required.

---

## First Session Goal

Get the offline core loop working end-to-end:

1. Onboarding questions → AI generates program → saved to WatermelonDB
2. Turn airplane mode on
3. Open workout → log sets → complete session → all works perfectly offline
4. Turn airplane mode back on → session syncs to Supabase automatically

If step 3 works in airplane mode, you have the right architecture. Everything else is features on top of a solid foundation.

**The prompt in `constants/prompts.ts` is the most important file in the project. Iterate on it obsessively.**

**Take the app to your actual gym in week 1. If it works there, it works.**

---

*This file is the source of truth for Adapt. Update it as decisions evolve.*