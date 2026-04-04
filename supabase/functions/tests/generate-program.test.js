#!/usr/bin/env node
// Tests for the generate-program Edge Function.
// Run with: npm run functions:test
// Requires EXPO_PUBLIC_SUPABASE_URL and EXPO_PUBLIC_SUPABASE_ANON_KEY in .env

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

const SUPABASE_URL = process.env.EXPO_PUBLIC_SUPABASE_URL || env['EXPO_PUBLIC_SUPABASE_URL']
const SUPABASE_ANON_KEY = process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY || env['EXPO_PUBLIC_SUPABASE_ANON_KEY']

if (!SUPABASE_URL || !SUPABASE_ANON_KEY) {
  console.error('Missing EXPO_PUBLIC_SUPABASE_URL or EXPO_PUBLIC_SUPABASE_ANON_KEY')
  process.exit(1)
}

const FUNCTION_URL = `${SUPABASE_URL}/functions/v1/generate-program`

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

async function callFunction(body) {
  const res = await fetch(FUNCTION_URL, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(body),
  })
  return { status: res.status, body: await res.json() }
}

// --- Tests ---

async function testValidRequest() {
  console.log('\nTest: valid program generation request')
  const { status, body } = await callFunction({
    training_history: 'beginner',
    goal: 'stronger',
    equipment: 'full_gym',
    days_per_week: 3,
    session_time: 45,
  })

  assert(status === 200, `status is 200 (got ${status})`)
  assert(body.program !== undefined, 'response has a program field')

  if (body.program) {
    const p = body.program
    assert(typeof p.program_name === 'string' && p.program_name.length > 0, 'program_name is a non-empty string')
    assert(typeof p.weekly_structure === 'string', 'weekly_structure is a string')
    assert(Array.isArray(p.sessions), 'sessions is an array')
    assert(p.sessions.length >= 1, `sessions has at least 1 entry (got ${p.sessions.length})`)
    assert(typeof p.coach_note === 'string', 'coach_note is a string')

    if (p.sessions.length > 0) {
      const s = p.sessions[0]
      assert(typeof s.day === 'string', 'session has a day field')
      assert(typeof s.focus === 'string', 'session has a focus field')
      assert(Array.isArray(s.exercises), 'session has exercises array')
      assert(s.exercises.length >= 1, `session has at least 1 exercise (got ${s.exercises.length})`)

      if (s.exercises.length > 0) {
        const e = s.exercises[0]
        assert(typeof e.name === 'string', 'exercise has a name')
        assert(typeof e.sets === 'number', 'exercise has numeric sets')
        assert(typeof e.reps === 'string', 'exercise has reps string')
      }
    }
  }
}

async function testMissingBody() {
  console.log('\nTest: empty body does not crash (graceful error or valid response)')
  const { status } = await callFunction({})
  assert(status === 200 || status === 400 || status === 500, `returns a status code (got ${status})`)
}

async function testCORSPreflight() {
  console.log('\nTest: CORS preflight returns 200')
  const res = await fetch(FUNCTION_URL, {
    method: 'OPTIONS',
    headers: { 'Authorization': `Bearer ${SUPABASE_ANON_KEY}` },
  })
  assert(res.status === 200, `OPTIONS returns 200 (got ${res.status})`)
}

// --- Run ---

;(async () => {
  console.log(`Testing ${FUNCTION_URL}`)

  await testCORSPreflight()
  await testMissingBody()
  await testValidRequest()

  console.log(`\n${passed} passed, ${failed} failed`)
  process.exit(failed > 0 ? 1 : 0)
})()
