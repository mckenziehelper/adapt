import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'
import { getActiveProgram, updateProgram } from '../../lib/programs'
import { ProgramModel } from '../../lib/watermelon'

type Exercise = {
  name: string
  category: string
  sets: number
  reps: string
  starting_weight: number
  progression: string
  rest_seconds: number
  notes: string
}

type Session = {
  day: string
  focus: string
  exercises: Exercise[]
}

type ProgramData = {
  program_name: string
  weekly_structure: string
  coach_note: string
  sessions: Session[]
}

export default function ProgramScreen() {
  const [programRecord, setProgramRecord] = useState<ProgramModel | null>(null)
  const [draft, setDraft] = useState<ProgramData | null>(null)
  const [selectedDay, setSelectedDay] = useState<string>('A')
  const [isDirty, setIsDirty] = useState(false)
  const [saving, setSaving] = useState(false)

  useFocusEffect(
    useCallback(() => {
      // Re-fetch on focus so changes from coach chat are reflected
      if (!isDirty) {
        getActiveProgram().then((p) => {
          if (!p) return
          setProgramRecord(p)
          setDraft(JSON.parse(JSON.stringify(p.program)))
          setSelectedDay(p.program?.sessions?.[0]?.day ?? 'A')
        })
      }
    }, [isDirty])
  )

  function updateExercise(sessionIdx: number, exIdx: number, field: keyof Exercise, value: any) {
    setDraft((prev) => {
      if (!prev) return prev
      const next = JSON.parse(JSON.stringify(prev)) as ProgramData
      const ex = next.sessions[sessionIdx].exercises[exIdx] as any
      ex[field] = value
      return next
    })
    setIsDirty(true)
  }

  async function handleSave() {
    if (!programRecord || !draft) return
    setSaving(true)
    await updateProgram(programRecord.id, draft)
    setIsDirty(false)
    setSaving(false)
  }

  if (!draft) {
    return (
      <SafeAreaView style={styles.safe}>
        <ActivityIndicator color={Colors.accent} style={{ marginTop: 60 }} />
      </SafeAreaView>
    )
  }

  const sessionIdx = draft.sessions.findIndex((s) => s.day === selectedDay)
  const session = draft.sessions[sessionIdx]

  return (
    <SafeAreaView style={styles.safe}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.coachBtn}
          onPress={() => router.push('/program/coach-chat')}
        >
          <Text style={styles.coachBtnText}>Chat with Coach</Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
        {/* Program name */}
        <Text style={styles.programName}>{draft.program_name}</Text>
        <Text style={styles.programStructure}>{draft.weekly_structure}</Text>

        {/* Session tabs */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.tabsScroll}
          contentContainerStyle={styles.tabsContainer}
        >
          {draft.sessions.map((s) => (
            <TouchableOpacity
              key={s.day}
              onPress={() => setSelectedDay(s.day)}
              style={[styles.tab, selectedDay === s.day && styles.tabActive]}
            >
              <Text style={[styles.tabText, selectedDay === s.day && styles.tabTextActive]}>
                Day {s.day}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Session focus */}
        {session && (
          <>
            <Text style={styles.sessionFocus}>{session.focus}</Text>

            {/* Exercises */}
            {session.exercises.map((exercise, exIdx) => (
              <ExerciseCard
                key={exIdx}
                exercise={exercise}
                onChange={(field, value) => updateExercise(sessionIdx, exIdx, field, value)}
              />
            ))}
          </>
        )}

        {/* Coach note */}
        {draft.coach_note && (
          <View style={styles.coachNoteCard}>
            <Text style={styles.coachNoteLabel}>COACH NOTE</Text>
            <Text style={styles.coachNoteText}>{draft.coach_note}</Text>
          </View>
        )}

        {/* Save button */}
        {isDirty && (
          <TouchableOpacity
            style={styles.saveBtn}
            onPress={handleSave}
            disabled={saving}
          >
            {saving ? (
              <ActivityIndicator color={Colors.text} />
            ) : (
              <Text style={styles.saveBtnText}>Save Changes</Text>
            )}
          </TouchableOpacity>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function ExerciseCard({
  exercise,
  onChange,
}: {
  exercise: Exercise
  onChange: (field: keyof Exercise, value: any) => void
}) {
  return (
    <View style={styles.exerciseCard}>
      {/* Name row */}
      <View style={styles.exerciseNameRow}>
        <TextInput
          style={styles.exerciseNameInput}
          value={exercise.name}
          onChangeText={(v) => onChange('name', v)}
          placeholder="Exercise name"
          placeholderTextColor={Colors.muted}
        />
        <View style={[
          styles.categoryBadge,
          exercise.category === 'main' && styles.categoryMain,
          exercise.category === 'accessory' && styles.categoryAccessory,
        ]}>
          <Text style={styles.categoryText}>{exercise.category?.toUpperCase()}</Text>
        </View>
      </View>

      {/* Stats grid */}
      <View style={styles.statsGrid}>
        <StatField
          label="SETS"
          value={String(exercise.sets)}
          numeric
          onChange={(v) => onChange('sets', parseInt(v) || 1)}
        />
        <StatField
          label="REPS"
          value={exercise.reps}
          onChange={(v) => onChange('reps', v)}
        />
        <StatField
          label="WEIGHT"
          value={String(exercise.starting_weight)}
          numeric
          suffix="lbs"
          onChange={(v) => onChange('starting_weight', parseFloat(v) || 0)}
        />
        <StatField
          label="REST"
          value={String(exercise.rest_seconds)}
          numeric
          suffix="s"
          onChange={(v) => onChange('rest_seconds', parseInt(v) || 60)}
        />
      </View>

      {/* Progression */}
      <View style={styles.progressionRow}>
        <Text style={styles.progressionLabel}>PROGRESSION</Text>
        <TextInput
          style={styles.progressionInput}
          value={exercise.progression}
          onChangeText={(v) => onChange('progression', v)}
          placeholder="e.g. +5lbs per session"
          placeholderTextColor={Colors.muted}
        />
      </View>

      {/* Notes */}
      {exercise.notes ? (
        <Text style={styles.exerciseNotes}>{exercise.notes}</Text>
      ) : null}
    </View>
  )
}

function StatField({
  label,
  value,
  numeric,
  suffix,
  onChange,
}: {
  label: string
  value: string
  numeric?: boolean
  suffix?: string
  onChange: (v: string) => void
}) {
  return (
    <View style={styles.statField}>
      <Text style={styles.statLabel}>{label}</Text>
      <View style={styles.statInputRow}>
        <TextInput
          style={styles.statInput}
          value={value}
          onChangeText={onChange}
          keyboardType={numeric ? 'numeric' : 'default'}
          selectTextOnFocus
          placeholderTextColor={Colors.muted}
        />
        {suffix && <Text style={styles.statSuffix}>{suffix}</Text>}
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.surface,
  },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: Colors.accent, fontSize: 17 },
  coachBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  coachBtnText: { color: Colors.text, fontWeight: '700', fontSize: 14 },

  scroll: { flex: 1 },
  container: { padding: Spacing.md },

  programName: {
    color: Colors.text,
    fontSize: 22,
    fontWeight: '800',
    marginBottom: 4,
  },
  programStructure: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: Spacing.md,
  },

  // Session tabs
  tabsScroll: { marginBottom: Spacing.sm },
  tabsContainer: { gap: 8, paddingBottom: 4 },
  tab: {
    paddingHorizontal: 18,
    paddingVertical: 8,
    borderRadius: 20,
    backgroundColor: Colors.surface,
  },
  tabActive: { backgroundColor: Colors.accent },
  tabText: { color: Colors.muted, fontWeight: '600', fontSize: 14 },
  tabTextActive: { color: Colors.text },

  sessionFocus: {
    color: Colors.muted,
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  // Exercise card
  exerciseCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  exerciseNameRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: Spacing.sm,
    gap: 8,
  },
  exerciseNameInput: {
    flex: 1,
    color: Colors.text,
    fontSize: 17,
    fontWeight: '700',
    padding: 0,
  },
  categoryBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: Colors.background,
  },
  categoryMain: { backgroundColor: '#1E3A5F' },
  categoryAccessory: { backgroundColor: '#1A2E1A' },
  categoryText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 1,
    color: Colors.muted,
  },

  // Stats grid
  statsGrid: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.sm,
  },
  statField: {
    flex: 1,
    backgroundColor: Colors.background,
    borderRadius: 8,
    padding: 8,
    alignItems: 'center',
  },
  statLabel: {
    color: Colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    marginBottom: 4,
  },
  statInputRow: { flexDirection: 'row', alignItems: 'baseline', gap: 2 },
  statInput: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
    textAlign: 'center',
    minWidth: 28,
    padding: 0,
  },
  statSuffix: { color: Colors.muted, fontSize: 11 },

  progressionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  progressionLabel: {
    color: Colors.muted,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    width: 80,
  },
  progressionInput: {
    flex: 1,
    color: Colors.muted,
    fontSize: 13,
    padding: 0,
  },
  exerciseNotes: {
    color: Colors.muted,
    fontSize: 12,
    fontStyle: 'italic',
    marginTop: 4,
  },

  // Coach note
  coachNoteCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
  },
  coachNoteLabel: {
    color: Colors.accent,
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  coachNoteText: { color: Colors.muted, fontSize: 14, lineHeight: 20 },

  // Save button
  saveBtn: {
    backgroundColor: Colors.success,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginTop: Spacing.sm,
  },
  saveBtnText: { color: Colors.text, fontSize: 17, fontWeight: '700' },
})
