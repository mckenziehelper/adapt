import React, { useState, useCallback } from 'react'
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import { Colors, Spacing, Radius } from '../../constants/theme'
import { getActiveProgram, updateProgram } from '../../lib/programs'
import { ProgramModel } from '../../lib/watermelon'
import { requireAuthAndPro } from '../../lib/auth-gate'

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
        <View style={styles.headerRight}>
          {isDirty && (
            <TouchableOpacity style={styles.saveBtn} onPress={handleSave} disabled={saving}>
              <Text style={styles.saveBtnText}>{saving ? 'Saving…' : 'Save'}</Text>
            </TouchableOpacity>
          )}
          <TouchableOpacity
            style={styles.coachBtn}
            onPress={async () => {
              const allowed = await requireAuthAndPro()
              if (allowed) router.push('/program/coach-chat')
            }}
          >
            <Text style={styles.coachBtnText}>Coach</Text>
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {/* Program name */}
        <Text style={styles.programName}>{draft.program_name}</Text>
        <Text style={styles.programStructure}>{draft.weekly_structure}</Text>

        {/* Day selector — 4-column grid style */}
        <View style={styles.daySelector}>
          {draft.sessions.map((s) => (
            <TouchableOpacity
              key={s.day}
              onPress={() => setSelectedDay(s.day)}
              style={[styles.dayTab, selectedDay === s.day && styles.dayTabActive]}
            >
              <Text style={[styles.dayTabText, selectedDay === s.day && styles.dayTabTextActive]}>
                Day {s.day}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {/* Session focus */}
        {session && (
          <>
            <Text style={styles.sessionFocus}>{session.focus}</Text>

            {/* Unified exercise card with hairline dividers */}
            <View style={styles.exercisesCard}>
              {/* Column headers */}
              <View style={styles.exColHeaders}>
                <View style={styles.exNameCol} />
                <Text style={styles.exColLabel}>SETS</Text>
                <Text style={styles.exColLabel}>REPS</Text>
                <Text style={styles.exColLabel}>LBS</Text>
                <Text style={styles.exColLabel}>REST</Text>
              </View>

              {session.exercises.map((exercise, exIdx) => (
                <View
                  key={exIdx}
                  style={[styles.exerciseRow, exIdx > 0 && styles.exerciseRowBorder]}
                >
                  {/* Name + tag */}
                  <View style={styles.exNameCol}>
                    <View style={[
                      styles.tag,
                      exercise.category === 'main' && styles.tagMain,
                      exercise.category === 'warmup' && styles.tagWarmup,
                    ]}>
                      <Text style={[styles.tagText, exercise.category === 'main' && styles.tagTextMain]}>
                        {exercise.category?.toUpperCase()}
                      </Text>
                    </View>
                    <TextInput
                      style={styles.exName}
                      value={exercise.name}
                      onChangeText={(v) => updateExercise(sessionIdx, exIdx, 'name', v)}
                      placeholderTextColor={Colors.faint}
                    />
                    {exercise.notes ? (
                      <Text style={styles.exNotes} numberOfLines={2}>{exercise.notes}</Text>
                    ) : null}
                  </View>

                  {/* Stats */}
                  <StatCell
                    value={String(exercise.sets)}
                    onChangeText={(v) => updateExercise(sessionIdx, exIdx, 'sets', parseInt(v) || 1)}
                    numeric
                  />
                  <StatCell
                    value={exercise.reps}
                    onChangeText={(v) => updateExercise(sessionIdx, exIdx, 'reps', v)}
                  />
                  <StatCell
                    value={String(exercise.starting_weight)}
                    onChangeText={(v) => updateExercise(sessionIdx, exIdx, 'starting_weight', parseFloat(v) || 0)}
                    numeric
                  />
                  <StatCell
                    value={String(exercise.rest_seconds)}
                    onChangeText={(v) => updateExercise(sessionIdx, exIdx, 'rest_seconds', parseInt(v) || 60)}
                    numeric
                  />
                </View>
              ))}
            </View>
          </>
        )}

        {/* Coach note */}
        {draft.coach_note ? (
          <View style={styles.coachNoteCard}>
            <View style={styles.coachNoteDot} />
            <View style={styles.coachNoteBody}>
              <Text style={styles.coachNoteLabel}>COACH NOTE</Text>
              <Text style={styles.coachNoteText}>{draft.coach_note}</Text>
            </View>
          </View>
        ) : null}

        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  )
}

function StatCell({
  value, onChangeText, numeric,
}: {
  value: string
  onChangeText: (v: string) => void
  numeric?: boolean
}) {
  return (
    <TextInput
      style={styles.statCell}
      value={value}
      onChangeText={onChangeText}
      keyboardType={numeric ? 'numeric' : 'default'}
      selectTextOnFocus
      placeholderTextColor={Colors.faint}
    />
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },

  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  backBtn: { paddingVertical: 6, paddingRight: 12 },
  backText: { color: Colors.accent, fontSize: 17 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  saveBtn: {
    backgroundColor: Colors.success,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
  },
  saveBtnText: { color: Colors.accentInk, fontWeight: '700', fontSize: 13 },
  coachBtn: {
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: Radius.pill,
    borderWidth: 0.5,
    borderColor: Colors.accent,
  },
  coachBtnText: { color: Colors.accent, fontWeight: '600', fontSize: 13 },

  scroll: { flex: 1 },
  container: { padding: Spacing.lg },

  programName: {
    color: Colors.text,
    fontSize: 26,
    fontWeight: '600',
    letterSpacing: -0.5,
    marginBottom: 4,
  },
  programStructure: {
    color: Colors.muted,
    fontSize: 13,
    marginBottom: Spacing.lg,
  },

  daySelector: {
    flexDirection: 'row',
    gap: 8,
    marginBottom: Spacing.md,
    flexWrap: 'wrap',
  },
  dayTab: {
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: Radius.sm,
    borderWidth: 0.5,
    borderColor: Colors.line,
    backgroundColor: Colors.surface,
  },
  dayTabActive: {
    backgroundColor: Colors.accentSoft,
    borderColor: Colors.accent,
  },
  dayTabText: { color: Colors.muted, fontWeight: '600', fontSize: 13 },
  dayTabTextActive: { color: Colors.accent },

  sessionFocus: {
    color: Colors.faint,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 1.5,
    textTransform: 'uppercase',
    marginBottom: Spacing.sm,
  },

  exercisesCard: {
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  exColHeaders: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: 10,
    borderBottomWidth: 0.5,
    borderBottomColor: Colors.line,
  },
  exNameCol: { flex: 1, marginRight: 8 },
  exColLabel: {
    width: 40,
    fontSize: 9,
    fontWeight: '700',
    letterSpacing: 1,
    color: Colors.faint,
    textAlign: 'center',
  },

  exerciseRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  exerciseRowBorder: {
    borderTopWidth: 0.5,
    borderTopColor: Colors.line,
  },

  tag: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 0.5,
    borderColor: Colors.line,
    borderRadius: 4,
    paddingHorizontal: 6,
    paddingVertical: 2,
    marginBottom: 4,
  },
  tagMain: { backgroundColor: Colors.accentSoft, borderColor: 'transparent' },
  tagWarmup: { backgroundColor: 'rgba(255,255,255,0.06)' },
  tagText: { fontSize: 8, fontWeight: '700', letterSpacing: 0.8, color: Colors.muted },
  tagTextMain: { color: Colors.accent },

  exName: {
    color: Colors.text,
    fontSize: 14,
    fontWeight: '600',
    padding: 0,
    letterSpacing: -0.1,
  },
  exNotes: {
    color: Colors.faint,
    fontSize: 11,
    marginTop: 2,
    lineHeight: 15,
  },

  statCell: {
    width: 40,
    color: Colors.text,
    fontSize: 15,
    fontWeight: '500',
    textAlign: 'center',
    padding: 0,
  },

  coachNoteCard: {
    flexDirection: 'row',
    backgroundColor: Colors.surface,
    borderRadius: Radius.md,
    borderWidth: 0.5,
    borderColor: Colors.line,
    padding: Spacing.md,
    gap: 12,
    marginBottom: Spacing.md,
  },
  coachNoteDot: {
    width: 20, height: 20,
    borderRadius: Radius.pill,
    backgroundColor: Colors.accent,
    flexShrink: 0,
    marginTop: 2,
  },
  coachNoteBody: { flex: 1 },
  coachNoteLabel: {
    color: Colors.faint,
    fontSize: 10,
    fontWeight: '700',
    letterSpacing: 1.5,
    marginBottom: 6,
  },
  coachNoteText: { color: Colors.muted, fontSize: 14, lineHeight: 20 },
})
