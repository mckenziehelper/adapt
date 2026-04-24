import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing, Radius } from '../../../constants/theme'
import { database, SessionModel, SetModel } from '../../../lib/watermelon'
import { getActiveProgram } from '../../../lib/programs'

type ExerciseSet = {
  setNumber: number
  targetReps: string
  actualReps: number | null
  weight: number | null
  completed: boolean
  isPR?: boolean
  dbSetId?: string
  isEditing?: boolean
}

type ExerciseState = {
  name: string
  category: string
  targetReps: string
  startingWeight: number
  sets: ExerciseSet[]
  restSeconds: number
  notes: string
  cue: string
}

export default function ActiveWorkoutScreen() {
  const { sessionId, sessionDay, adjustedSession, energyCheckin, soreAreas, timeAvailable } =
    useLocalSearchParams<{
      sessionId: string
      sessionDay: string
      adjustedSession?: string
      energyCheckin?: string
      soreAreas?: string
      timeAvailable?: string
    }>()

  const [exercises, setExercises] = useState<ExerciseState[]>([])
  const [sessionDbId, setSessionDbId] = useState<string | null>(null)
  const [sessionFocus, setSessionFocus] = useState<string>('')
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const [restTimer, setRestTimer] = useState<{ active: boolean; seconds: number; total: number }>(
    { active: false, seconds: 0, total: 0 }
  )
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    initSession()
    return () => { if (timerRef.current) clearInterval(timerRef.current) }
  }, [])

  async function initSession() {
    const program = await getActiveProgram()
    if (!program) return

    let session: any
    if (adjustedSession) {
      try { session = JSON.parse(adjustedSession) } catch {}
    }
    if (!session) {
      const parsed = program.program
      session = parsed.sessions?.find((s: any) => s.day === sessionDay)
    }
    if (!session) return

    setSessionFocus(session.focus ?? '')

    const exerciseStates: ExerciseState[] = session.exercises.map((ex: any) => ({
      name: ex.name,
      category: ex.category,
      targetReps: ex.reps,
      startingWeight: ex.starting_weight || 0,
      restSeconds: ex.rest_seconds ?? 90,
      notes: ex.notes ?? '',
      cue: ex.cue ?? ex.notes ?? '',
      sets: Array.from({ length: ex.sets }, (_: unknown, i: number) => ({
        setNumber: i + 1,
        targetReps: ex.reps,
        actualReps: null,
        weight: ex.starting_weight || null,
        completed: false,
      })),
    }))

    setExercises(exerciseStates)
    setExpandedExercise(exerciseStates[0]?.name ?? null)

    const dbSession = await database.write(async () => {
      return database.get<SessionModel>('sessions').create((record) => {
        record.programId = program.id
        record.sessionDay = sessionDay
        record.plannedJson = JSON.stringify(session)
        record.synced = false
        if (energyCheckin) record.energyCheckin = parseInt(energyCheckin, 10)
        if (soreAreas) record.soreAreas = soreAreas
        if (timeAvailable) record.timeAvailable = parseInt(timeAvailable, 10)
      })
    })
    setSessionDbId(dbSession.id)
  }

  function startRestTimer(seconds: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    setRestTimer({ active: true, seconds, total: seconds })
    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev.seconds <= 1) {
          clearInterval(timerRef.current!)
          return { active: false, seconds: 0, total: 0 }
        }
        return { ...prev, seconds: prev.seconds - 1 }
      })
    }, 1000)
  }

  function skipRest() {
    if (timerRef.current) clearInterval(timerRef.current)
    setRestTimer({ active: false, seconds: 0, total: 0 })
  }

  async function logSet(
    exerciseIndex: number,
    setIndex: number,
    reps: number,
    weight: number,
    existingDbSetId?: string
  ) {
    if (!sessionDbId) return

    const exerciseName = exercises[exerciseIndex].name
    const allPreviousSets = await database.get<SetModel>('sets').query().fetch()
    const previousBest = allPreviousSets
      .filter(s => s.exerciseName === exerciseName && s.sessionId !== sessionDbId)
      .reduce((max, s) => Math.max(max, s.weight ?? 0), 0)
    const isPR = weight > 0 && weight > previousBest

    let dbSetId = existingDbSetId
    if (existingDbSetId) {
      await database.write(async () => {
        const record = await database.get<SetModel>('sets').find(existingDbSetId)
        await record.update((r) => {
          r.actualReps = reps; r.weight = weight; r.isPR = isPR; r.completedAt = Date.now()
        })
      })
    } else {
      const newRecord = await database.write(async () => {
        return database.get<SetModel>('sets').create((record) => {
          record.sessionId = sessionDbId
          record.exerciseName = exerciseName
          record.setNumber = setIndex + 1
          record.targetReps = exercises[exerciseIndex].sets[setIndex].targetReps
          record.actualReps = reps
          record.weight = weight
          record.isPR = isPR
          record.completedAt = Date.now()
          record.synced = false
        })
      })
      dbSetId = newRecord.id
    }

    setExercises((prev) => {
      const updated = [...prev]
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: updated[exerciseIndex].sets.map((s, i) =>
          i === setIndex ? { ...s, actualReps: reps, weight, completed: true, isPR, dbSetId, isEditing: false } : s
        ),
      }
      // Auto-advance to next incomplete exercise
      const allDone = updated[exerciseIndex].sets.every((s, idx) => s.completed || idx === setIndex)
      if (allDone) {
        const nextEx = updated.find((ex, ei) => ei > exerciseIndex && !ex.sets.every(s => s.completed))
        if (nextEx) setExpandedExercise(nextEx.name)
      }
      return updated
    })

    startRestTimer(exercises[exerciseIndex].restSeconds)
  }

  function startEditingSet(exerciseIndex: number, setIndex: number) {
    setExercises(prev => {
      const updated = [...prev]
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: updated[exerciseIndex].sets.map((s, i) => i === setIndex ? { ...s, isEditing: true } : s),
      }
      return updated
    })
  }

  function cancelEditingSet(exerciseIndex: number, setIndex: number) {
    setExercises(prev => {
      const updated = [...prev]
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: updated[exerciseIndex].sets.map((s, i) => i === setIndex ? { ...s, isEditing: false } : s),
      }
      return updated
    })
  }

  async function deleteSet(exerciseIndex: number, setIndex: number) {
    const set = exercises[exerciseIndex].sets[setIndex]
    if (set.dbSetId) {
      await database.write(async () => {
        const record = await database.get<SetModel>('sets').find(set.dbSetId!)
        await record.markAsDeleted()
      })
    }
    setExercises(prev => {
      const updated = [...prev]
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: updated[exerciseIndex].sets.filter((_, i) => i !== setIndex).map((s, i) => ({ ...s, setNumber: i + 1 })),
      }
      return updated
    })
  }

  function addSet(exerciseIndex: number) {
    setExercises(prev => {
      const updated = [...prev]
      const ex = updated[exerciseIndex]
      const lastCompleted = [...ex.sets].reverse().find(s => s.completed)
      updated[exerciseIndex] = {
        ...ex,
        sets: [...ex.sets, {
          setNumber: ex.sets.length + 1,
          targetReps: ex.targetReps,
          actualReps: null,
          weight: lastCompleted?.weight ?? ex.startingWeight ?? null,
          completed: false,
        }],
      }
      return updated
    })
  }

  async function finishWorkout() {
    if (!sessionDbId) { router.replace('/(tabs)/'); return }
    const elapsed = Math.round((Date.now() - startTime) / 1000 / 60)
    await database.write(async () => {
      const session = await database.get<SessionModel>('sessions').find(sessionDbId)
      await session.update((record) => {
        record.completedAt = Date.now()
        record.actualJson = JSON.stringify(exercises)
        record.timeAvailable = elapsed
      })
    })
    router.replace({ pathname: '/workout/[sessionId]/summary', params: { sessionId: sessionDbId } })
  }

  const completedSets = exercises.reduce((acc, ex) => acc + ex.sets.filter(s => s.completed).length, 0)
  const totalSets = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)
  const allDone = totalSets > 0 && completedSets === totalSets

  return (
    <SafeAreaView style={styles.safe}>
      {/* Sticky header */}
      <View style={styles.stickyHeader}>
        <View style={styles.headerRow}>
          <View style={styles.headerLeft}>
            <Text style={styles.headerLabel}>DAY {sessionDay} · IN PROGRESS</Text>
            <Text style={styles.headerTitle} numberOfLines={1}>{sessionFocus}</Text>
          </View>
          <TouchableOpacity
            style={styles.endBtn}
            onPress={() =>
              Alert.alert('End workout?', 'Progress will be saved.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'End', style: 'destructive', onPress: finishWorkout },
              ])
            }
          >
            <Text style={styles.endBtnText}>End</Text>
          </TouchableOpacity>
        </View>
        <View style={styles.progressRow}>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: totalSets > 0 ? `${(completedSets / totalSets) * 100}%` : '0%' }]} />
          </View>
          <Text style={styles.progressCount}>{completedSets}/{totalSets}</Text>
        </View>
      </View>

      {/* Rest timer banner */}
      {restTimer.active && (
        <View style={styles.restBanner}>
          <View style={styles.restLeft}>
            <Text style={styles.restLabel}>REST</Text>
            <Text style={styles.restCountdown}>{restTimer.seconds}s</Text>
          </View>
          <View style={styles.restBarTrack}>
            <View style={[styles.restBarFill, { width: `${((restTimer.total - restTimer.seconds) / restTimer.total) * 100}%` }]} />
          </View>
          <TouchableOpacity onPress={skipRest} style={styles.restSkipBtn}>
            <Text style={styles.restSkipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {exercises.length === 0 && <Text style={styles.loadingText}>Loading workout...</Text>}

        {exercises.map((exercise, exIdx) => {
          const done = exercise.sets.every(s => s.completed)
          const isExpanded = expandedExercise === exercise.name
          const tagKind = exercise.category?.toLowerCase() as 'main' | 'accessory' | 'warmup'

          return (
            <View
              key={exercise.name}
              style={[styles.exerciseCard, done && styles.exerciseCardDone]}
            >
              {/* Card header — tappable to expand */}
              <TouchableOpacity
                style={styles.exerciseHeader}
                onPress={() => setExpandedExercise(isExpanded ? null : exercise.name)}
                activeOpacity={0.7}
              >
                <View style={styles.exerciseTitleRow}>
                  {/* Round index / checkmark */}
                  <View style={[styles.indexBadge, done && styles.indexBadgeDone]}>
                    <Text style={[styles.indexText, done && styles.indexTextDone]}>
                      {done ? '✓' : String(exIdx + 1).padStart(2, '0')}
                    </Text>
                  </View>

                  <View style={styles.exerciseInfo}>
                    <View style={styles.tagRow}>
                      <View style={[styles.tag, tagKind === 'main' && styles.tagMain, tagKind === 'warmup' && styles.tagWarmup]}>
                        <Text style={[styles.tagText, tagKind === 'main' && styles.tagTextMain]}>
                          {exercise.category?.toUpperCase()}
                        </Text>
                      </View>
                    </View>
                    <Text style={styles.exerciseName}>{exercise.name}</Text>
                    <Text style={styles.exerciseMeta}>
                      {exercise.sets.length} × {exercise.targetReps}{'  ·  '}{exercise.restSeconds}s rest
                    </Text>
                  </View>

                  <Text style={[styles.chevron, isExpanded && styles.chevronOpen]}>›</Text>
                </View>

                {isExpanded && exercise.cue ? (
                  <Text style={styles.cueText}>{exercise.cue}</Text>
                ) : null}
              </TouchableOpacity>

              {/* Sets section */}
              {isExpanded && (
                <View style={styles.setsSection}>
                  {/* Column headers */}
                  <View style={styles.colHeaders}>
                    <View style={styles.colIndex} />
                    <Text style={styles.colLabel}>WEIGHT</Text>
                    <Text style={styles.colLabel}>REPS</Text>
                    <View style={styles.colLog} />
                  </View>

                  {exercise.sets.map((set, setIdx) => (
                    <SetRow
                      key={setIdx}
                      set={set}
                      setIdx={setIdx}
                      isLast={setIdx === exercise.sets.length - 1}
                      onComplete={(reps, weight) => logSet(exIdx, setIdx, reps, weight, set.isEditing ? set.dbSetId : undefined)}
                      onEdit={() => startEditingSet(exIdx, setIdx)}
                      onCancelEdit={() => cancelEditingSet(exIdx, setIdx)}
                      onDelete={() => Alert.alert(
                        set.completed ? 'Delete logged set?' : 'Skip this set?',
                        'This set will be removed.',
                        [
                          { text: 'Cancel', style: 'cancel' },
                          { text: 'Delete', style: 'destructive', onPress: () => deleteSet(exIdx, setIdx) },
                        ]
                      )}
                    />
                  ))}

                  <TouchableOpacity style={styles.addSetBtn} onPress={() => addSet(exIdx)}>
                    <Text style={styles.addSetText}>+ Add Set</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          )
        })}

        {exercises.length > 0 && (
          <TouchableOpacity
            style={[styles.finishBtn, allDone && styles.finishBtnActive]}
            onPress={finishWorkout}
          >
            <Text style={[styles.finishBtnText, allDone && styles.finishBtnTextActive]}>
              {allDone ? 'Finish Workout ✓' : 'Finish Early'}
            </Text>
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function SetRow({
  set, setIdx, isLast, onComplete, onEdit, onCancelEdit, onDelete,
}: {
  set: ExerciseSet
  setIdx: number
  isLast: boolean
  onComplete: (reps: number, weight: number) => void
  onEdit: () => void
  onCancelEdit: () => void
  onDelete: () => void
}) {
  const defaultReps = parseInt(set.targetReps) || 5
  const [reps, setReps] = useState(set.isEditing ? (set.actualReps ?? defaultReps) : defaultReps)
  const [weight, setWeight] = useState(set.weight ?? 0)

  useEffect(() => {
    if (set.isEditing) {
      setReps(set.actualReps ?? defaultReps)
      setWeight(set.weight ?? 0)
    }
  }, [set.isEditing])

  const isLogged = set.completed && !set.isEditing

  return (
    <View style={[styles.setRow, !isLast && styles.setRowBorder, isLogged && styles.setRowLogged]}>
      {/* Set index */}
      <View style={styles.colIndex}>
        <Text style={styles.setIndex}>{setIdx + 1}</Text>
      </View>

      {/* Weight stepper */}
      <View style={styles.stepper}>
        <TouchableOpacity onPress={() => setWeight(w => Math.max(0, w - 5))} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.stepCenter}>
          <Text style={styles.stepValue} numberOfLines={1} adjustsFontSizeToFit>{weight}</Text>
          <Text style={styles.stepUnit}>lb</Text>
        </View>
        <TouchableOpacity onPress={() => setWeight(w => w + 5)} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Reps stepper */}
      <View style={styles.stepper}>
        <TouchableOpacity onPress={() => setReps(r => Math.max(1, r - 1))} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.stepCenter}>
          <Text style={styles.stepValue} numberOfLines={1} adjustsFontSizeToFit>{reps}</Text>
          <Text style={styles.stepUnit}>reps</Text>
        </View>
        <TouchableOpacity onPress={() => setReps(r => r + 1)} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Log / Update / ✓ */}
      <View style={styles.colLog}>
        {isLogged ? (
          <View style={styles.loggedActions}>
            {set.isPR && <Text style={styles.prBadge}>PR</Text>}
            <TouchableOpacity onPress={onEdit}>
              <Text style={styles.editBtn}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={onDelete}>
              <Text style={styles.deleteBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.logActions}>
            <TouchableOpacity
              style={[styles.logBtn, set.isEditing && styles.logBtnUpdate]}
              onPress={() => onComplete(reps, weight)}
            >
              <Text style={styles.logBtnText}>{set.isEditing ? '↑' : 'Log'}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={set.isEditing ? onCancelEdit : onDelete}>
              <Text style={styles.deleteBtn}>✕</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  stickyHeader: {
    backgroundColor: Colors.background,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  headerRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerLeft: { flex: 1, marginRight: Spacing.sm },
  headerLabel: { color: Colors.accent, fontSize: 11, fontWeight: '700', letterSpacing: 2 },
  headerTitle: { color: Colors.text, fontSize: 22, fontWeight: '600', letterSpacing: -0.4, marginTop: 4 },
  endBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 0.5,
    borderColor: Colors.lineStrong,
  },
  endBtnText: { color: Colors.text, fontSize: 12, fontWeight: '600' },
  progressRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 14 },
  progressTrack: { flex: 1, height: 2, backgroundColor: Colors.line, borderRadius: 999, overflow: 'hidden' },
  progressFill: { height: 2, backgroundColor: Colors.accent },
  progressCount: { fontFamily: 'System', fontSize: 11, color: Colors.muted, fontVariant: ['tabular-nums'] },

  restBanner: {
    backgroundColor: '#0f1a0a',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.accent,
  },
  restLeft: { alignItems: 'center', width: 44 },
  restLabel: { color: Colors.accent, fontSize: 9, fontWeight: '700', letterSpacing: 1.5 },
  restCountdown: { color: Colors.text, fontSize: 20, fontWeight: '600' },
  restBarTrack: { flex: 1, height: 3, backgroundColor: Colors.line, borderRadius: 2, overflow: 'hidden' },
  restBarFill: { height: 3, backgroundColor: Colors.accent, borderRadius: 2 },
  restSkipBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: Radius.pill, borderWidth: 0.5, borderColor: Colors.lineStrong },
  restSkipText: { color: Colors.muted, fontSize: 12, fontWeight: '600' },

  scroll: { flex: 1 },
  container: { padding: Spacing.lg, paddingTop: Spacing.md, gap: Spacing.sm },
  loadingText: { color: Colors.muted, textAlign: 'center', marginTop: 40 },

  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line,
    overflow: 'hidden',
  },
  exerciseCardDone: { borderColor: Colors.accent },

  exerciseHeader: { padding: Spacing.md, paddingBottom: Spacing.sm },
  exerciseTitleRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 12 },

  indexBadge: {
    width: 28, height: 28, borderRadius: Radius.pill,
    borderWidth: 0.5, borderColor: Colors.lineStrong,
    alignItems: 'center', justifyContent: 'center',
    flexShrink: 0, marginTop: 2,
  },
  indexBadgeDone: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  indexText: { fontFamily: 'System', fontSize: 11, fontWeight: '600', color: Colors.muted },
  indexTextDone: { color: Colors.accentInk },

  exerciseInfo: { flex: 1, minWidth: 0 },
  tagRow: { marginBottom: 4 },
  tag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5, borderColor: Colors.line,
    borderRadius: 6,
    paddingHorizontal: 7, paddingVertical: 4,
  },
  tagMain: { backgroundColor: Colors.accentSoft, borderColor: 'transparent' },
  tagWarmup: { backgroundColor: 'rgba(255,255,255,0.06)', borderColor: Colors.line },
  tagText: { fontSize: 9.5, fontWeight: '600', letterSpacing: 0.8, color: Colors.muted },
  tagTextMain: { color: Colors.accent },

  exerciseName: { color: Colors.text, fontSize: 16, fontWeight: '600', letterSpacing: -0.2 },
  exerciseMeta: { fontFamily: 'System', fontSize: 11, color: Colors.faint, marginTop: 6, letterSpacing: 0.3 },
  chevron: { color: Colors.faint, fontSize: 18, marginTop: 4 },
  chevronOpen: { transform: [{ rotate: '90deg' }] },
  cueText: { color: Colors.muted, fontSize: 12, fontStyle: 'italic', marginTop: 12, paddingLeft: 40, lineHeight: 18 },

  setsSection: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.line,
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
  },
  colHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingTop: 12,
    paddingBottom: 4,
    gap: 8,
  },
  colLabel: { flex: 1, fontSize: 9.5, fontWeight: '700', letterSpacing: 1, color: Colors.faint, textAlign: 'center' },
  colIndex: { width: 24 },
  colLog: { width: 80, alignItems: 'flex-end' },

  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingTop: 10,
  },
  setRowBorder: { borderTopWidth: 0.5, borderTopColor: Colors.line, marginTop: 2 },
  setRowLogged: { opacity: 0.55 },
  setIndex: { fontFamily: 'System', fontSize: 13, color: Colors.faint, textAlign: 'center' },

  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    height: 42,
    backgroundColor: Colors.surfaceElev,
    borderRadius: 10,
    borderWidth: 0.5,
    borderColor: Colors.line,
    overflow: 'hidden',
  },
  stepBtn: { width: 30, height: '100%', alignItems: 'center', justifyContent: 'center' },
  stepBtnText: { color: Colors.muted, fontSize: 16, fontWeight: '300' },
  stepCenter: { flex: 1, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 3 },
  stepValue: { color: Colors.text, fontSize: 15, fontWeight: '500' },
  stepUnit: { color: Colors.faint, fontSize: 10 },

  logActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  loggedActions: { flexDirection: 'row', alignItems: 'center', gap: 6 },

  logBtn: {
    height: 42, width: 52,
    backgroundColor: Colors.accent,
    borderRadius: 10,
    alignItems: 'center', justifyContent: 'center',
  },
  logBtnUpdate: { backgroundColor: Colors.success },
  logBtnText: { color: Colors.accentInk, fontSize: 13, fontWeight: '700' },

  editBtn: { color: Colors.accent, fontSize: 12, fontWeight: '600' },
  deleteBtn: { color: Colors.faint, fontSize: 13 },
  prBadge: {
    color: Colors.success,
    fontSize: 9, fontWeight: '800',
    borderWidth: 0.5, borderColor: Colors.success,
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 2,
  },

  addSetBtn: {
    marginTop: 10,
    paddingVertical: Spacing.sm,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.line,
    alignItems: 'center',
  },
  addSetText: { color: Colors.muted, fontSize: 13, fontWeight: '600' },

  finishBtn: {
    marginTop: Spacing.sm,
    height: 52,
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line,
    alignItems: 'center',
    justifyContent: 'center',
  },
  finishBtnActive: { backgroundColor: Colors.accent, borderColor: Colors.accent },
  finishBtnText: { color: Colors.muted, fontSize: 16, fontWeight: '600' },
  finishBtnTextActive: { color: Colors.accentInk },
})
