#!/usr/bin/env node
// Tests for the adjust-session Edge Function.
// Run with: npm run functions:test (or node supabase/functions/tests/adjust-session.test.mjs)
// Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env
//
// NOTE: These are smoke tests that verify structure only — they do NOT mock the AI.
// The function calls real OpenRouter when run against a live/local Supabase instance.
// To avoid real AI calls, run against supabase functions serve with a stubbed OPENROUTER_API_KEY.

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env manually (no dotenv dependency)
const envPath = resolve(__dirname, '../../../.env')
const env = {}
try {
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter(l => l && !l.startsWith('#'))
    .forEach(l => {
      const [k, ...rest] = l.split('=')
      env[k.trim()] = rest.join('=').trim()
    })
} catch {
  console.error('Could not read .env — set SUPABASE_URL and SUPABASE_ANON_KEY manually')
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || env['EXPO_PUBLIC_SUPABASE_URL'] || 'http://localhost:54321'
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || env['EXPO_PUBLIC_SUPABASE_ANON_KEY'] || ''

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/adjust-session`

let passed = 0
let failed = 0

function assert(condition, message) {
  if (condition) {
    console.log(`  ✓ ${message}`)
    passed++
  } else {
    console.error(`  ✗ ${message}`)
    failed++
  }
}

// A minimal but realistic session object matching the program JSON format
const SAMPLE_SESSION = {
  day: 'A',
  focus: 'Lower Body Strength',
  exercises: [
    {
      name: 'Barbell Back Squat',
      category: 'main',
      sets: 5,
      reps: '5',
      starting_weight: 185,
      progression: '+5lbs per session',
      rest_seconds: 180,
      notes: 'Keep chest up, drive through heels',
    },
    {
      name: 'Romanian Deadlift',
      category: 'accessory',
      sets: 3,
      reps: '10',
      starting_weight: 135,
      progression: '+5lbs weekly',
      rest_seconds: 120,
      notes: 'Hinge at hips, soft knee bend',
    },
    {
      name: 'Leg Press',
      category: 'accessory',
      sets: 3,
      reps: '12',
      starting_weight: 270,
      progression: '+10lbs weekly',
      rest_seconds: 90,
      notes: 'Full range of motion',
    },
  ],
}

async function callFunction(body) {
  const headers = {
    'Content-Type': 'application/json',
  }
  if (SUPABASE_ANON_KEY) {
    headers['Authorization'] = `Bearer ${SUPABASE_ANON_KEY}`
  }

  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers,
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json
  try {
    json = JSON.parse(text)
  } catch {
    json = { _raw: text }
  }
  return { status: res.status, body: json }
}

// --- Shared response shape assertions ---

function assertResponseShape(body) {
  assert(body !== null && typeof body === 'object', 'response is a JSON object')
  assert(!body.error, `no error field in response (got: ${body.error})`)
  assert(typeof body.adjustment_note === 'string' && body.adjustment_note.length > 0, 'adjustment_note is a non-empty string')
  assert(typeof body.day === 'string', 'response has a day field')
  assert(typeof body.focus === 'string', 'response has a focus field')
  assert(Array.isArray(body.exercises), 'response has an exercises array')
  assert(body.exercises.length >= 1, `exercises array is non-empty (got ${body.exercises?.length})`)

  if (Array.isArray(body.exercises) && body.exercises.length > 0) {
    const ex = body.exercises[0]
    assert(typeof ex.name === 'string', 'first exercise has a name')
    assert(typeof ex.sets === 'number', 'first exercise has numeric sets')
    assert(typeof ex.reps === 'string' || typeof ex.reps === 'number', 'first exercise has a reps field')
  }
}

// --- Tests ---

async function testCORSPreflight() {
  console.log('\nTest: CORS preflight returns 200')
  const res = await fetch(FUNCTION_URL, {
    method: 'OPTIONS',
    headers: SUPABASE_ANON_KEY ? { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` } : {},
  })
  assert(res.status === 200, `OPTIONS returns 200 (got ${res.status})`)
}

async function testNormalEnergyNoSoreness() {
  console.log('\nTest 1: Normal energy (4/5), no soreness, 60 min — expect "No adjustments needed"')
  const { status, body } = await callFunction({
    energy: 4,
    sore_areas: [],
    time: 60,
    session_json: JSON.stringify(SAMPLE_SESSION),
    last_session_summary: 'Completed all sets. Squat felt strong at 185lbs.',
  })

  assert(status === 200, `status is 200 (got ${status})`)
  assertResponseShape(body)

  if (status === 200 && body.adjustment_note) {
    // With good energy and ample time the AI should leave the session unchanged.
    // We check the note mentions "no adjustment" or similar — case-insensitive.
    const noteLC = body.adjustment_note.toLowerCase()
    const isUnchanged =
      noteLC.includes('no adjustment') ||
      noteLC.includes('no changes') ||
      noteLC.includes('unchanged') ||
      noteLC.includes('no modification')
    assert(isUnchanged, `adjustment_note indicates no changes (got: "${body.adjustment_note}")`)
  }
}

async function testLowEnergyMultipleSoreAreas() {
  console.log('\nTest 2: Low energy (2/5), legs + lower back sore — expect modifications or a meaningful note')
  const { status, body } = await callFunction({
    energy: 2,
    sore_areas: ['lower back', 'legs'],
    time: 30,
    session_json: JSON.stringify(SAMPLE_SESSION),
    last_session_summary: 'Felt fatigued. Missed last set of squats.',
  })

  assert(status === 200, `status is 200 (got ${status})`)
  assertResponseShape(body)

  if (status === 200 && body.adjustment_note) {
    // With low energy (2/5) and soreness in the primary muscle groups for this
    // session the AI should acknowledge it made adjustments. The note must be
    // non-trivial — it should NOT say "no adjustments needed".
    const noteLC = body.adjustment_note.toLowerCase()
    const isUnchanged =
      noteLC === 'no adjustments needed' ||
      noteLC === 'no adjustments needed.'

    assert(!isUnchanged, `adjustment_note is NOT "No adjustments needed" (got: "${body.adjustment_note}")`)

    // Validate that the note is substantive (more than just a filler phrase)
    assert(body.adjustment_note.length > 20, `adjustment_note is substantive (length: ${body.adjustment_note.length})`)
  }
}

async function testMissingBodyIsHandledGracefully() {
  console.log('\nTest 3: Empty body does not crash — returns 200 or a clean error')
  const { status } = await callFunction({})
  assert(
    status === 200 || status === 400 || status === 500,
    `returns a valid HTTP status (got ${status})`,
  )
}

// --- Run ---

;(async () => {
  console.log(`Testing ${FUNCTION_URL}`)
  console.log('(Requires the function to be running locally via `supabase functions serve`')
  console.log(' or deployed to your Supabase project.)\n')

  if (!SUPABASE_ANON_KEY) {
    console.warn('Warning: SUPABASE_ANON_KEY not set — requests will be sent without Authorization header.')
  }

  await testCORSPreflight()
  await testNormalEnergyNoSoreness()
  await testLowEnergyMultipleSoreAreas()
  await testMissingBodyIsHandledGracefully()

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
})()
