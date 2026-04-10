import { Database, Model, appSchema, tableSchema } from '@nozbe/watermelondb'
import SQLiteAdapter from '@nozbe/watermelondb/adapters/sqlite'
import { field, date, readonly } from '@nozbe/watermelondb/decorators'

// Schema
const dbSchema = appSchema({
  version: 1,
  tables: [
    tableSchema({
      name: 'programs',
      columns: [
        { name: 'supabase_id', type: 'string', isOptional: true },
        { name: 'is_active', type: 'boolean' },
        { name: 'program_json', type: 'string' },
        { name: 'coach_note', type: 'string', isOptional: true },
        { name: 'version', type: 'number' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'sessions',
      columns: [
        { name: 'supabase_id', type: 'string', isOptional: true },
        { name: 'program_id', type: 'string' },
        { name: 'session_day', type: 'string' },
        { name: 'planned_json', type: 'string' },
        { name: 'actual_json', type: 'string', isOptional: true },
        { name: 'energy_checkin', type: 'number', isOptional: true },
        { name: 'sore_areas', type: 'string', isOptional: true },
        { name: 'time_available', type: 'number', isOptional: true },
        { name: 'rating', type: 'number', isOptional: true },
        { name: 'user_note', type: 'string', isOptional: true },
        { name: 'ai_reaction', type: 'string', isOptional: true },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
    tableSchema({
      name: 'sets',
      columns: [
        { name: 'supabase_id', type: 'string', isOptional: true },
        { name: 'session_id', type: 'string' },
        { name: 'exercise_name', type: 'string' },
        { name: 'set_number', type: 'number' },
        { name: 'target_reps', type: 'string' },
        { name: 'actual_reps', type: 'number', isOptional: true },
        { name: 'weight', type: 'number', isOptional: true },
        { name: 'is_pr', type: 'boolean' },
        { name: 'completed_at', type: 'number', isOptional: true },
        { name: 'synced', type: 'boolean' },
        { name: 'created_at', type: 'number' },
        { name: 'updated_at', type: 'number' },
      ],
    }),
  ],
})

// Models
export class ProgramModel extends Model {
  static table = 'programs'

  @field('supabase_id') supabaseId!: string
  @field('is_active') isActive!: boolean
  @field('program_json') programJson!: string
  @field('coach_note') coachNote!: string
  @field('version') version!: number
  @readonly @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date

  get program() {
    try {
      const parsed = JSON.parse(this.programJson)
      // Guard against empty objects stored by a bad apply
      if (parsed && Array.isArray(parsed.sessions) && parsed.sessions.length > 0) return parsed
      return null
    } catch {
      return null
    }
  }
}

export class SessionModel extends Model {
  static table = 'sessions'

  @field('supabase_id') supabaseId!: string
  @field('program_id') programId!: string
  @field('session_day') sessionDay!: string
  @field('planned_json') plannedJson!: string
  @field('actual_json') actualJson!: string
  @field('energy_checkin') energyCheckin!: number
  @field('sore_areas') soreAreas!: string
  @field('time_available') timeAvailable!: number
  @field('rating') rating!: number
  @field('user_note') userNote!: string
  @field('ai_reaction') aiReaction!: string
  @field('completed_at') completedAt!: number
  @field('synced') synced!: boolean
  @readonly @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date

  get planned() {
    return this.plannedJson ? JSON.parse(this.plannedJson) : null
  }

  get actual() {
    return this.actualJson ? JSON.parse(this.actualJson) : null
  }
}

export class SetModel extends Model {
  static table = 'sets'

  @field('supabase_id') supabaseId!: string
  @field('session_id') sessionId!: string
  @field('exercise_name') exerciseName!: string
  @field('set_number') setNumber!: number
  @field('target_reps') targetReps!: string
  @field('actual_reps') actualReps!: number
  @field('weight') weight!: number
  @field('is_pr') isPR!: boolean
  @field('completed_at') completedAt!: number
  @field('synced') synced!: boolean
  @readonly @date('created_at') createdAt!: Date
  @date('updated_at') updatedAt!: Date
}

// Database instance
const adapter = new SQLiteAdapter({
  schema: dbSchema,
  dbName: 'adapt',
  jsi: true,
  onSetUpError: (error: Error) => {
    console.error('WatermelonDB setup error:', error)
  },
})

export const database = new Database({
  adapter,
  modelClasses: [ProgramModel, SessionModel, SetModel],
})
