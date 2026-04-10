// Sync queue — flush local WatermelonDB records to Supabase when connectivity returns.

import NetInfo from '@react-native-community/netinfo'
import { database, SessionModel, SetModel } from './watermelon'
import { supabase } from './supabase'
import { Q } from '@nozbe/watermelondb'

/**
 * Start listening for connectivity changes and flush sync queue on reconnect.
 * Returns an unsubscribe function. Call once after auth is confirmed.
 */
export function startSyncListener(userId: string): () => void {
  return NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      await flushSyncQueue(userId)
    }
  })
}

/**
 * Flush all unsynced sessions and sets to Supabase.
 *
 * Order matters: sessions must be synced first so their Supabase IDs
 * are available when syncing child sets.
 */
export async function flushSyncQueue(userId: string) {
  try {
    // --- 1. Sync sessions ---
    const unsyncedSessions = await database
      .get<SessionModel>('sessions')
      .query(Q.where('synced', false))
      .fetch()

    for (const session of unsyncedSessions) {
      if (!session.completedAt) continue // don't sync incomplete sessions

      const { data, error } = await supabase
        .from('sessions')
        .upsert({
          id: session.supabaseId || undefined,
          user_id: userId,
          session_day: session.sessionDay,
          planned_json: session.planned,
          actual_json: session.actual,
          energy_checkin: session.energyCheckin,
          time_available: session.timeAvailable,
          rating: session.rating,
          user_note: session.userNote,
          completed_at: session.completedAt
            ? new Date(session.completedAt).toISOString()
            : null,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Sync: failed to upsert session', session.id, error)
        continue
      }
      if (data?.id) {
        const supabaseId = data.id
        await database.write(async () => {
          await session.update((record) => {
            record.synced = true
            record.supabaseId = supabaseId
          })
        })
      }
    }

    // --- 2. Sync sets ---
    const unsyncedSets = await database
      .get<SetModel>('sets')
      .query(Q.where('synced', false))
      .fetch()

    for (const set of unsyncedSets) {
      // Look up parent session from WatermelonDB
      let parentSession: SessionModel | null = null
      try {
        parentSession = await database
          .get<SessionModel>('sessions')
          .find(set.sessionId)
      } catch {
        // Parent session not found locally — skip
        continue
      }

      // Skip if parent hasn't received a Supabase ID yet
      if (!parentSession.supabaseId) continue

      const { data, error } = await supabase
        .from('sets')
        .upsert({
          id: set.supabaseId || undefined,
          session_id: parentSession.supabaseId,
          exercise_name: set.exerciseName,
          set_number: set.setNumber,
          target_reps: set.targetReps,
          actual_reps: set.actualReps,
          weight: set.weight,
          is_pr: set.isPR,
          completed_at: set.completedAt
            ? new Date(set.completedAt).toISOString()
            : null,
        })
        .select('id')
        .single()

      if (error) {
        console.error('Sync: failed to upsert set', set.id, error)
        continue
      }
      if (data?.id) {
        const supabaseId = data.id
        await database.write(async () => {
          await set.update((record) => {
            record.synced = true
            record.supabaseId = supabaseId
          })
        })
      }
    }
  } catch (err) {
    console.error('Sync flush error:', err)
    // Silently fail — will retry on next reconnect
  }
}
