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
import { Colors, Spacing } from '../../../constants/theme'
import { database, SessionModel, SetModel } from '../../../lib/watermelon'
import { getActiveProgram } from '../../../lib/programs'

type ExerciseSet = {
  setNumber: number
  targetReps: string
  actualReps: number | null
  weight: number | null
  completed: boolean
  isPR?: boolean
}

type ExerciseState = {
  name: string
  category: string
  sets: ExerciseSet[]
  restSeconds: number
  notes: string
  howTo: string
}

export default function ActiveWorkoutScreen() {
  const { sessionId, sessionDay, adjustedSession, energyCheckin, soreAreas, timeAvailable } =
    useLocalSearchParams<{
      sessionId: string
      sessionDay: string
      adjustedSession?: string      // JSON string of AI-adjusted session, if any
      energyCheckin?: string        // '1'–'5'
      soreAreas?: string            // JSON string array, e.g. '["Lower back"]'
      timeAvailable?: string        // '30', '45', or '60'
    }>()

  const [exercises, setExercises] = useState<ExerciseState[]>([])
  const [sessionDbId, setSessionDbId] = useState<string | null>(null)
  const [sessionFocus, setSessionFocus] = useState<string>('')
  const [sessionDescription, setSessionDescription] = useState<string>('')
  const [showDescription, setShowDescription] = useState(false)
  const [expandedExercise, setExpandedExercise] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const [restTimer, setRestTimer] = useState<{
    active: boolean
    seconds: number
    total: number
  }>({ active: false, seconds: 0, total: 0 })
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    initSession()
    return () => {
      if (timerRef.current) clearInterval(timerRef.current)
    }
  }, [])

  async function initSession() {
    const program = await getActiveProgram()
    if (!program) return

    // Use AI-adjusted session if provided, otherwise fall back to program plan
    let session: any
    if (adjustedSession) {
      try {
        session = JSON.parse(adjustedSession)
      } catch {
        // fall through to program lookup
      }
    }
    if (!session) {
      const parsed = program.program
      session = parsed.sessions?.find((s: any) => s.day === sessionDay)
    }
    if (!session) return

    setSessionFocus(session.focus ?? '')
    setSessionDescription(session.description ?? '')

    const exerciseStates: ExerciseState[] = session.exercises.map((ex: any) => ({
      name: ex.name,
      category: ex.category,
      restSeconds: ex.rest_seconds ?? 90,
      notes: ex.notes ?? '',
      howTo: ex.how_to ?? '',
      sets: Array.from({ length: ex.sets }, (_: unknown, i: number) => ({
        setNumber: i + 1,
        targetReps: ex.reps,
        actualReps: null,
        weight: ex.starting_weight || null,
        completed: false,
      })),
    }))

    setExercises(exerciseStates)

    const dbSession = await database.write(async () => {
      return database.get<SessionModel>('sessions').create((record) => {
        record.programId = program.id
        record.sessionDay = sessionDay
        record.plannedJson = JSON.stringify(session)
        record.synced = false
        // Write check-in data if provided
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

  async function logSet(exerciseIndex: number, setIndex: number, reps: number, weight: number) {
    if (!sessionDbId) return

    // Check if this weight is a PR (beats all previous sets for this exercise in other sessions)
    const exerciseName = exercises[exerciseIndex].name
    const allPreviousSets = await database.get<SetModel>('sets').query().fetch()
    const previousBest = allPreviousSets
      .filter(s => s.exerciseName === exerciseName && s.sessionId !== sessionDbId)
      .reduce((max, s) => Math.max(max, s.weight ?? 0), 0)
    const isPR = weight > 0 && weight > previousBest

    setExercises((prev) => {
      const updated = [...prev]
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: updated[exerciseIndex].sets.map((s, i) =>
          i === setIndex ? { ...s, actualReps: reps, weight, completed: true, isPR } : s
        ),
      }
      return updated
    })

    await database.write(async () => {
      await database.get<SetModel>('sets').create((record) => {
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

    startRestTimer(exercises[exerciseIndex].restSeconds)
  }

  async function finishWorkout() {
    if (!sessionDbId) {
      router.replace('/(tabs)/')
      return
    }

    const elapsed = Math.round((Date.now() - startTime) / 1000 / 60)

    await database.write(async () => {
      const session = await database.get<SessionModel>('sessions').find(sessionDbId)
      await session.update((record) => {
        record.completedAt = Date.now()
        record.actualJson = JSON.stringify(exercises)
        record.timeAvailable = elapsed
      })
    })

    router.replace({
      pathname: '/workout/[sessionId]/summary',
      params: { sessionId: sessionDbId },
    })
  }

  const allSetsCompleted =
    exercises.length > 0 && exercises.every((ex) => ex.sets.every((s) => s.completed))

  const completedSetsCount = exercises.reduce(
    (acc, ex) => acc + ex.sets.filter((s) => s.completed).length,
    0
  )
  const totalSetsCount = exercises.reduce((acc, ex) => acc + ex.sets.length, 0)

  return (
    <SafeAreaView style={styles.safe}>
      {restTimer.active && (
        <View style={styles.restBanner}>
          <View style={styles.restLeft}>
            <Text style={styles.restLabel}>REST</Text>
            <Text style={styles.restCountdown}>{restTimer.seconds}s</Text>
          </View>
          <View style={styles.restBarTrack}>
            <View
              style={[
                styles.restBarFill,
                { width: `${((restTimer.total - restTimer.seconds) / restTimer.total) * 100}%` },
              ]}
            />
          </View>
          <TouchableOpacity onPress={skipRest} style={styles.restSkipBtn}>
            <Text style={styles.restSkipText}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.headerLeft}
            onPress={() => sessionDescription ? setShowDescription(v => !v) : null}
            activeOpacity={sessionDescription ? 0.7 : 1}
          >
            <Text style={styles.headerDay}>DAY {sessionDay}</Text>
            {sessionFocus ? (
              <Text style={styles.headerFocus}>
                {sessionFocus}{sessionDescription ? (showDescription ? '  ▲' : '  ▼') : ''}
              </Text>
            ) : null}
            <Text style={styles.headerProgress}>
              {completedSetsCount} / {totalSetsCount} sets
            </Text>
            {showDescription ? (
              <Text style={styles.headerDescription}>{sessionDescription}</Text>
            ) : null}
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('End workout?', 'Progress will be saved.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'End', style: 'destructive', onPress: finishWorkout },
              ])
            }
            style={styles.endBtn}
          >
            <Text style={styles.endBtnText}>End</Text>
          </TouchableOpacity>
        </View>

        {exercises.length === 0 && (
          <Text style={styles.loadingText}>Loading workout...</Text>
        )}

        {exercises.map((exercise, exIdx) => {
          const setsComplete = exercise.sets.filter((s) => s.completed).length
          const allComplete = setsComplete === exercise.sets.length
          return (
            <View key={exercise.name} style={styles.exerciseCard}>
              {/* Exercise header */}
              <TouchableOpacity
                style={styles.exerciseHeader}
                onPress={() =>
                  exercise.howTo
                    ? setExpandedExercise(prev =>
                        prev === exercise.name ? null : exercise.name
                      )
                    : null
                }
                activeOpacity={exercise.howTo ? 0.7 : 1}
              >
                <View style={styles.exerciseTitleRow}>
                  <Text style={styles.exerciseName}>{exercise.name}</Text>
                  <View
                    style={[
                      styles.categoryBadge,
                      exercise.category === 'main' && styles.categoryMain,
                      exercise.category === 'accessory' && styles.categoryAccessory,
                    ]}
                  >
                    <Text style={styles.categoryText}>
                      {exercise.category?.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <Text style={styles.exerciseMeta}>
                  {exercise.sets.length} sets · {exercise.sets[0]?.targetReps} reps ·{' '}
                  {exercise.restSeconds}s rest
                  {exercise.howTo ? (expandedExercise === exercise.name ? '  ▲' : '  ▼') : ''}
                </Text>
                {expandedExercise === exercise.name && exercise.howTo ? (
                  <Text style={styles.exerciseHowTo}>{exercise.howTo}</Text>
                ) : null}
                {exercise.notes ? (
                  <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
                ) : null}
              </TouchableOpacity>

              {/* Completion bar */}
              <View style={styles.progressTrack}>
                <View
                  style={[
                    styles.progressFill,
                    { width: `${(setsComplete / exercise.sets.length) * 100}%` },
                    allComplete && styles.progressFillDone,
                  ]}
                />
              </View>

              {/* Sets */}
              <View style={styles.setsContainer}>
                {exercise.sets.map((set, setIdx) => (
                  <SetRow
                    key={setIdx}
                    set={set}
                    setIdx={setIdx}
                    onComplete={(reps, weight) => logSet(exIdx, setIdx, reps, weight)}
                  />
                ))}
              </View>
            </View>
          )
        })}

        {exercises.length > 0 && (
          <TouchableOpacity
            style={[styles.finishBtn, allSetsCompleted && styles.finishBtnActive]}
            onPress={finishWorkout}
          >
            <Text style={styles.finishBtnText}>
              {allSetsCompleted ? 'Finish Workout ✓' : 'Finish Early'}
            </Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  )
}

function SetRow({
  set,
  setIdx,
  onComplete,
}: {
  set: ExerciseSet
  setIdx: number
  onComplete: (reps: number, weight: number) => void
}) {
  const defaultReps = parseInt(set.targetReps) || 5
  const [reps, setReps] = useState(defaultReps)
  const [weight, setWeight] = useState(set.weight ?? 0)

  if (set.completed) {
    return (
      <View style={styles.setRowDone}>
        <View style={styles.setNumBadgeDone}>
          <Text style={styles.setNumTextDone}>{setIdx + 1}</Text>
        </View>
        <Text style={styles.setDoneDetail}>{weight} lbs</Text>
        <Text style={styles.setDoneSep}>×</Text>
        <Text style={styles.setDoneDetail}>{set.actualReps} reps</Text>
        {set.isPR && <Text style={styles.prBadge}>PR</Text>}
        <View style={[styles.setDoneCheck, !set.isPR && { marginLeft: 'auto' }]}>
          <Text style={styles.setDoneCheckText}>✓</Text>
        </View>
      </View>
    )
  }

  return (
    <View style={styles.setRow}>
      {/* Set number */}
      <View style={styles.setNumBadge}>
        <Text style={styles.setNumText}>{setIdx + 1}</Text>
      </View>

      {/* Weight stepper */}
      <View style={styles.stepper}>
        <TouchableOpacity
          onPress={() => setWeight((w) => Math.max(0, w - 5))}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.stepValueWrap}>
          <Text style={styles.stepValue}>{weight}</Text>
          <Text style={styles.stepUnit}>lbs</Text>
        </View>
        <TouchableOpacity onPress={() => setWeight((w) => w + 5)} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Reps stepper */}
      <View style={styles.stepper}>
        <TouchableOpacity
          onPress={() => setReps((r) => Math.max(1, r - 1))}
          style={styles.stepBtn}
        >
          <Text style={styles.stepBtnText}>−</Text>
        </TouchableOpacity>
        <View style={styles.stepValueWrap}>
          <Text style={styles.stepValue}>{reps}</Text>
          <Text style={styles.stepUnit}>reps</Text>
        </View>
        <TouchableOpacity onPress={() => setReps((r) => r + 1)} style={styles.stepBtn}>
          <Text style={styles.stepBtnText}>+</Text>
        </TouchableOpacity>
      </View>

      {/* Log button */}
      <TouchableOpacity style={styles.logBtn} onPress={() => onComplete(reps, weight)}>
        <Text style={styles.logBtnText}>Log</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  // Rest banner
  restBanner: {
    backgroundColor: '#1D2D44',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.accent,
  },
  restLeft: { alignItems: 'center', width: 44 },
  restLabel: { color: Colors.accent, fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  restCountdown: { color: Colors.text, fontSize: 20, fontWeight: '800' },
  restBarTrack: {
    flex: 1,
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: 2,
    overflow: 'hidden',
  },
  restBarFill: { height: 4, backgroundColor: Colors.accent, borderRadius: 2 },
  restSkipBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
    borderColor: Colors.muted,
  },
  restSkipText: { color: Colors.muted, fontSize: 13, fontWeight: '600' },

  // Layout
  scroll: { flex: 1 },
  container: { padding: Spacing.md, paddingBottom: 40 },

  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: Spacing.lg,
  },
  headerLeft: { flex: 1, marginRight: Spacing.sm },
  headerDay: { color: Colors.text, fontSize: 24, fontWeight: '800', letterSpacing: 0.5 },
  headerFocus: { color: Colors.accent, fontSize: 13, fontWeight: '600', marginTop: 3 },
  headerProgress: { color: Colors.muted, fontSize: 13, marginTop: 2 },
  headerDescription: {
    color: Colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.sm,
  },
  endBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: Colors.surface,
  },
  endBtnText: { color: Colors.muted, fontSize: 14, fontWeight: '600' },
  loadingText: { color: Colors.muted, textAlign: 'center', marginTop: 40 },

  // Exercise card
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    marginBottom: Spacing.md,
    overflow: 'hidden',
  },
  exerciseHeader: {
    padding: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  exerciseTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  exerciseName: {
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    flex: 1,
    marginRight: 8,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  categoryMain: { backgroundColor: '#1E3A5F' },
  categoryAccessory: { backgroundColor: '#1A2E1A' },
  categoryText: { fontSize: 10, fontWeight: '800', letterSpacing: 1, color: Colors.muted },
  exerciseMeta: { color: Colors.muted, fontSize: 12, marginBottom: 4 },
  exerciseHowTo: {
    color: Colors.muted,
    fontSize: 13,
    lineHeight: 19,
    marginTop: Spacing.sm,
    marginBottom: 2,
  },
  exerciseNotes: {
    color: Colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 2,
  },

  // Progress bar
  progressTrack: {
    height: 2,
    backgroundColor: Colors.background,
  },
  progressFill: {
    height: 2,
    backgroundColor: Colors.accent,
  },
  progressFillDone: { backgroundColor: Colors.success },

  // Sets
  setsContainer: { padding: Spacing.sm, gap: 6 },

  // Active set row
  setRow: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.background,
    borderRadius: 10,
    padding: 10,
    gap: 6,
  },
  setNumBadge: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumText: { color: Colors.muted, fontSize: 13, fontWeight: '700' },

  // Stepper
  stepper: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 8,
    paddingHorizontal: 4,
    paddingVertical: 6,
  },
  stepBtn: {
    width: 32,
    height: 32,
    alignItems: 'center',
    justifyContent: 'center',
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  stepBtnText: { color: Colors.text, fontSize: 20, fontWeight: '300', lineHeight: 22 },
  stepValueWrap: { alignItems: 'center', flex: 1 },
  stepValue: { color: Colors.text, fontSize: 17, fontWeight: '700' },
  stepUnit: { color: Colors.muted, fontSize: 9, marginTop: -2 },

  // Log button
  logBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 0,
    height: 44,
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: 52,
  },
  logBtnText: { color: Colors.text, fontSize: 14, fontWeight: '700' },

  // Completed set row
  setRowDone: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 8,
    opacity: 0.7,
  },
  setNumBadgeDone: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: Colors.success + '33',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setNumTextDone: { color: Colors.success, fontSize: 13, fontWeight: '700' },
  setDoneDetail: { color: Colors.muted, fontSize: 14, fontWeight: '600' },
  setDoneSep: { color: Colors.muted, fontSize: 12 },
  setDoneCheck: {
    marginLeft: 'auto',
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: Colors.success + '22',
    alignItems: 'center',
    justifyContent: 'center',
  },
  setDoneCheckText: { color: Colors.success, fontSize: 13 },
  prBadge: {
    color: Colors.success,
    fontSize: 10,
    fontWeight: '800',
    borderWidth: 1,
    borderColor: Colors.success,
    borderRadius: 4,
    paddingHorizontal: 5,
    paddingVertical: 2,
    marginLeft: 'auto',
  },

  // Finish button
  finishBtn: {
    backgroundColor: Colors.surface,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  finishBtnActive: { backgroundColor: Colors.success },
  finishBtnText: { color: Colors.text, fontSize: 17, fontWeight: '700' },
})
