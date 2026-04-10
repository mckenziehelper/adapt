#!/usr/bin/env node
// Tests for the coach-chat Edge Function.
// Run with: node supabase/functions/tests/coach-chat.test.mjs
// Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env

import { readFileSync } from 'fs'
import { resolve, dirname } from 'path'
import { fileURLToPath } from 'url'

const __dirname = dirname(fileURLToPath(import.meta.url))

// Load .env manually
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
  console.error('Could not read .env — set env vars manually')
}

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || env['EXPO_PUBLIC_SUPABASE_URL']
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || env['EXPO_PUBLIC_SUPABASE_ANON_KEY']

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/coach-chat`

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

const SAMPLE_PROGRAM = {
  program_name: 'Test Program',
  weekly_structure: 'Mon/Wed/Fri',
  sessions: [
    {
      day: 'A',
      focus: 'Lower Body',
      exercises: [
        { name: 'Barbell Back Squat', category: 'main', sets: 3, reps: '5', starting_weight: 135, rest_seconds: 180 },
        { name: 'Romanian Deadlift', category: 'accessory', sets: 3, reps: '8-10', starting_weight: 95, rest_seconds: 90 },
      ],
    },
  ],
  coach_note: 'A simple test program.',
}

async function call(body) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  const text = await res.text()
  let json = null
  try { json = JSON.parse(text) } catch {}
  return { status: res.status, body: json, raw: text }
}

// --- Tests ---

async function testCORSPreflight() {
  console.log('\nTest: CORS preflight')
  const res = await fetch(FUNCTION_URL, {
    method: 'OPTIONS',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
  })
  assert(res.status === 200, `OPTIONS returns 200 (got ${res.status})`)
}

async function testSimpleQuestion() {
  console.log('\nTest: simple question (no program changes)')
  const { status, body, raw } = await call({
    current_program: SAMPLE_PROGRAM,
    conversation: [],
    user_message: 'How many days a week is this program?',
  })

  console.log(`  → status: ${status}`)
  if (body?.error) console.error(`  → error field: ${body.error}`)
  if (status !== 200) console.error(`  → raw body: ${raw.slice(0, 500)}`)

  assert(status === 200, `status is 200 (got ${status})`)
  assert(body !== null, 'response is valid JSON')
  assert(typeof body?.message === 'string' && body.message.length > 0, 'response has a non-empty message')
  assert(!('program_changes' in (body ?? {})), 'no program_changes for a simple question')
}

async function testProgramModification() {
  console.log('\nTest: program modification request')
  const { status, body, raw } = await call({
    current_program: SAMPLE_PROGRAM,
    conversation: [],
    user_message: 'Change the squat to 4 sets instead of 3.',
  })

  console.log(`  → status: ${status}`)
  if (body?.error) console.error(`  → error field: ${body.error}`)
  if (status !== 200) console.error(`  → raw body: ${raw.slice(0, 500)}`)

  assert(status === 200, `status is 200 (got ${status})`)
  assert(body !== null, 'response is valid JSON')
  assert(typeof body?.message === 'string', 'response has a message')
  assert('program_changes' in (body ?? {}), 'response includes program_changes')

  if (body?.program_changes) {
    const pc = body.program_changes
    assert(Array.isArray(pc.sessions), 'program_changes has sessions array')
    const squat = pc.sessions?.[0]?.exercises?.find(e => e.name === 'Barbell Back Squat')
    assert(squat?.sets === 4, `squat updated to 4 sets (got ${squat?.sets})`)
  }
}

async function testMultiTurnConversation() {
  console.log('\nTest: multi-turn conversation (second message has no program context)')
  const { status, body } = await call({
    current_program: SAMPLE_PROGRAM,
    conversation: [
      { role: 'user', content: 'How many sessions per week?' },
      { role: 'assistant', content: 'This is a 3-day program — Mon/Wed/Fri.' },
    ],
    user_message: 'Can you add a fourth day?',
  })

  assert(status === 200, `status is 200 (got ${status})`)
  assert(typeof body?.message === 'string', 'response has a message')
}

async function testMissingBody() {
  console.log('\nTest: missing required fields (should not crash)')
  const { status, body, raw } = await call({})
  console.log(`  → status: ${status}, body: ${raw.slice(0, 200)}`)
  assert(
    status === 200 || status === 400 || status === 500,
    `returns a valid HTTP status (got ${status})`
  )
  // Should not return HTML or a non-JSON 502
  assert(body !== null, 'response is JSON (not HTML/gateway error)')
}

// --- Run ---

;(async () => {
  console.log(`Testing: ${FUNCTION_URL}\n`)

  await testCORSPreflight()
  await testMissingBody()
  await testSimpleQuestion()
  await testProgramModification()
  await testMultiTurnConversation()

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
})()
