import React, { useState, useEffect, useRef } from 'react'
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  SafeAreaView,
  Alert,
} from 'react-native'
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
}

type ExerciseState = {
  name: string
  category: string
  sets: ExerciseSet[]
  restSeconds: number
  notes: string
}

export default function ActiveWorkoutScreen() {
  const { sessionId, sessionDay } = useLocalSearchParams<{
    sessionId: string
    sessionDay: string
  }>()

  const [exercises, setExercises] = useState<ExerciseState[]>([])
  const [sessionDbId, setSessionDbId] = useState<string | null>(null)
  const [startTime] = useState(Date.now())
  const [restTimer, setRestTimer] = useState<{
    active: boolean
    seconds: number
    exerciseIndex: number
  }>({
    active: false,
    seconds: 0,
    exerciseIndex: -1,
  })
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

    const parsed = program.program
    const session = parsed.sessions?.find((s: any) => s.day === sessionDay)
    if (!session) return

    const exerciseStates: ExerciseState[] = session.exercises.map((ex: any) => ({
      name: ex.name,
      category: ex.category,
      restSeconds: ex.rest_seconds ?? 90,
      notes: ex.notes ?? '',
      sets: Array.from({ length: ex.sets }, (_: unknown, i: number) => ({
        setNumber: i + 1,
        targetReps: ex.reps,
        actualReps: null,
        weight: ex.starting_weight || null,
        completed: false,
      })),
    }))

    setExercises(exerciseStates)

    // Create session record in WatermelonDB — works offline
    const dbSession = await database.write(async () => {
      return database.get<SessionModel>('sessions').create((record) => {
        record.programId = program.id
        record.sessionDay = sessionDay
        record.plannedJson = JSON.stringify(session)
        record.synced = false
      })
    })

    setSessionDbId(dbSession.id)
  }

  function startRestTimer(seconds: number, exerciseIndex: number) {
    if (timerRef.current) clearInterval(timerRef.current)
    setRestTimer({ active: true, seconds, exerciseIndex })

    timerRef.current = setInterval(() => {
      setRestTimer((prev) => {
        if (prev.seconds <= 1) {
          clearInterval(timerRef.current!)
          return { active: false, seconds: 0, exerciseIndex: -1 }
        }
        return { ...prev, seconds: prev.seconds - 1 }
      })
    }, 1000)
  }

  async function logSet(
    exerciseIndex: number,
    setIndex: number,
    reps: number,
    weight: number
  ) {
    if (!sessionDbId) return

    setExercises((prev) => {
      const updated = [...prev]
      updated[exerciseIndex] = {
        ...updated[exerciseIndex],
        sets: updated[exerciseIndex].sets.map((s, i) =>
          i === setIndex ? { ...s, actualReps: reps, weight, completed: true } : s
        ),
      }
      return updated
    })

    // Write to WatermelonDB — works completely offline
    await database.write(async () => {
      await database.get<SetModel>('sets').create((record) => {
        record.sessionId = sessionDbId
        record.exerciseName = exercises[exerciseIndex].name
        record.setNumber = setIndex + 1
        record.targetReps = exercises[exerciseIndex].sets[setIndex].targetReps
        record.actualReps = reps
        record.weight = weight
        record.isPR = false
        record.completedAt = Date.now()
        record.synced = false
      })
    })

    startRestTimer(exercises[exerciseIndex].restSeconds, exerciseIndex)
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

  return (
    <SafeAreaView style={styles.safe}>
      {restTimer.active && (
        <View style={styles.restBanner}>
          <Text style={styles.restText}>Rest — {restTimer.seconds}s</Text>
          <TouchableOpacity
            onPress={() => {
              if (timerRef.current) clearInterval(timerRef.current)
              setRestTimer({ active: false, seconds: 0, exerciseIndex: -1 })
            }}
          >
            <Text style={styles.restSkip}>Skip</Text>
          </TouchableOpacity>
        </View>
      )}

      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        <View style={styles.header}>
          <Text style={styles.headerTitle}>Day {sessionDay}</Text>
          <TouchableOpacity
            onPress={() =>
              Alert.alert('End workout?', 'Progress will be saved.', [
                { text: 'Cancel', style: 'cancel' },
                { text: 'End', style: 'destructive', onPress: finishWorkout },
              ])
            }
          >
            <Text style={styles.endButton}>End</Text>
          </TouchableOpacity>
        </View>

        {exercises.length === 0 && (
          <Text style={{ color: Colors.muted, textAlign: 'center', marginTop: Spacing.xl }}>
            Loading workout...
          </Text>
        )}

        {exercises.map((exercise, exIdx) => (
          <View key={exercise.name} style={styles.exerciseBlock}>
            <View style={styles.exerciseHeader}>
              <Text style={styles.exerciseName}>{exercise.name}</Text>
              <Text style={styles.exerciseCategory}>{exercise.category}</Text>
            </View>
            {exercise.notes ? (
              <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
            ) : null}

            <View style={styles.setsHeader}>
              <Text style={styles.setHeaderCell}>SET</Text>
              <Text style={styles.setHeaderCell}>TARGET</Text>
              <Text style={styles.setHeaderCell}>WEIGHT</Text>
              <Text style={styles.setHeaderCell}>REPS</Text>
              <Text style={styles.setHeaderCell}></Text>
            </View>

            {exercise.sets.map((set, setIdx) => (
              <SetRow
                key={setIdx}
                set={set}
                setIdx={setIdx}
                onComplete={(reps, weight) => logSet(exIdx, setIdx, reps, weight)}
              />
            ))}
          </View>
        ))}

        {exercises.length > 0 && (
          <TouchableOpacity
            style={[styles.finishButton, !allSetsCompleted && styles.finishButtonMuted]}
            onPress={finishWorkout}
          >
            <Text style={styles.finishButtonText}>
              {allSetsCompleted ? 'Finish Workout' : 'Finish Early'}
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

  return (
    <View style={[styles.setRow, set.completed && styles.setRowCompleted]}>
      <Text style={styles.setCell}>{setIdx + 1}</Text>
      <Text style={styles.setCell}>{set.targetReps}</Text>
      <View style={styles.setCellControl}>
        <TouchableOpacity
          onPress={() => setWeight((w) => Math.max(0, w - 5))}
          style={styles.adjBtn}
        >
          <Text style={styles.adjText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.adjValue}>{weight}</Text>
        <TouchableOpacity onPress={() => setWeight((w) => w + 5)} style={styles.adjBtn}>
          <Text style={styles.adjText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.setCellControl}>
        <TouchableOpacity
          onPress={() => setReps((r) => Math.max(1, r - 1))}
          style={styles.adjBtn}
        >
          <Text style={styles.adjText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.adjValue}>{reps}</Text>
        <TouchableOpacity onPress={() => setReps((r) => r + 1)} style={styles.adjBtn}>
          <Text style={styles.adjText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.logBtn, set.completed && styles.logBtnDone]}
        onPress={() => !set.completed && onComplete(reps, weight)}
        disabled={set.completed}
      >
        <Text style={styles.logBtnText}>{set.completed ? 'Done' : 'Log'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  restBanner: {
    backgroundColor: Colors.accent,
    padding: Spacing.sm,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
  },
  restText: { color: Colors.text, fontWeight: '700', fontSize: 16 },
  restSkip: { color: Colors.text, fontSize: 14 },
  scroll: { flex: 1 },
  container: { padding: Spacing.md, paddingBottom: Spacing.xxl },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  headerTitle: { color: Colors.text, fontSize: 22, fontWeight: '700' },
  endButton: { color: Colors.muted, fontSize: 16 },
  exerciseBlock: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.md,
  },
  exerciseHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 4,
  },
  exerciseName: { color: Colors.text, fontSize: 18, fontWeight: '700', flex: 1 },
  exerciseCategory: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  exerciseNotes: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: Spacing.sm,
    fontStyle: 'italic',
  },
  setsHeader: {
    flexDirection: 'row',
    marginBottom: 4,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: Colors.background,
  },
  setHeaderCell: {
    flex: 1,
    color: Colors.muted,
    fontSize: 10,
    fontWeight: '700',
    textAlign: 'center',
  },
  setRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs, borderRadius: 8 },
  setRowCompleted: { opacity: 0.6 },
  setCell: { flex: 1, color: Colors.text, fontSize: 15, textAlign: 'center' },
  setCellControl: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  adjBtn: {
    padding: 4,
    backgroundColor: Colors.background,
    borderRadius: 6,
    width: 28,
    alignItems: 'center',
  },
  adjText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  adjValue: {
    color: Colors.text,
    fontSize: 15,
    fontWeight: '600',
    minWidth: 32,
    textAlign: 'center',
  },
  logBtn: {
    flex: 1,
    backgroundColor: Colors.accent,
    borderRadius: 6,
    padding: 8,
    alignItems: 'center',
    marginLeft: 4,
  },
  logBtnDone: { backgroundColor: Colors.success },
  logBtnText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
  finishButton: {
    backgroundColor: Colors.success,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.md,
  },
  finishButtonMuted: { backgroundColor: Colors.surface },
  finishButtonText: { color: Colors.text, fontSize: 18, fontWeight: '700' },
})
