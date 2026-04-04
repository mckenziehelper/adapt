// Sync queue — flush local WatermelonDB records to Supabase when connectivity returns.
// Phase 2 implementation.

import NetInfo from '@react-native-community/netinfo'
import { database, SessionModel, SetModel } from './watermelon'
import { supabase } from './supabase'
import { Q } from '@nozbe/watermelondb'

type SyncQueueItem = {
  id: string
  table: 'sessions' | 'sets'
  operation: 'create' | 'update'
  payload: object
  created_at: number
  synced: boolean
  retry_count: number
}

/**
 * Start listening for connectivity changes and flush sync queue on reconnect.
 * Call this once on app startup.
 */
export function startSyncListener(userId: string) {
  return NetInfo.addEventListener(async (state) => {
    if (state.isConnected) {
      await flushSyncQueue(userId)
    }
  })
}

/**
 * Flush all unsynced sessions and sets to Supabase.
 */
export async function flushSyncQueue(userId: string) {
  try {
    const unsyncedSessions = await database
      .get<SessionModel>('sessions')
      .query(Q.where('synced', false))
      .fetch()

    for (const session of unsyncedSessions) {
      if (!session.completedAt) continue // don't sync incomplete sessions

      const { error } = await supabase.from('sessions').upsert({
        id: session.supabaseId || undefined,
        user_id: userId,
        session_day: session.sessionDay,
        planned_json: session.planned,
        actual_json: session.actual,
        energy_checkin: session.energyCheckin,
        time_available: session.timeAvailable,
        rating: session.rating,
        user_note: session.userNote,
        completed_at: session.completedAt ? new Date(session.completedAt).toISOString() : null,
      })

      if (!error) {
        await database.write(async () => {
          await session.update((record) => {
            record.synced = true
          })
        })
      }
    }

    const unsyncedSets = await database
      .get<SetModel>('sets')
      .query(Q.where('synced', false))
      .fetch()

    for (const set of unsyncedSets) {
      const { error } = await supabase.from('sets').upsert({
        id: set.supabaseId || undefined,
        exercise_name: set.exerciseName,
        set_number: set.setNumber,
        target_reps: set.targetReps,
        actual_reps: set.actualReps,
        weight: set.weight,
        is_pr: set.isPR,
        completed_at: set.completedAt ? new Date(set.completedAt).toISOString() : null,
      })

      if (!error) {
        await database.write(async () => {
          await set.update((record) => {
            record.synced = true
          })
        })
      }
    }
  } catch (err) {
    console.error('Sync flush error:', err)
    // Silently fail — will retry on next reconnect
  }
}
