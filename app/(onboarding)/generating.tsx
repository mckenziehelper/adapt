import React, { useEffect, useRef } from 'react'
import { View, Text, ActivityIndicator, StyleSheet } from 'react-native'
import { router, useLocalSearchParams } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { saveProgram } from '../../lib/programs'

export default function GeneratingScreen() {
  const params = useLocalSearchParams<{
    training_history: string
    goal: string
    equipment: string
    days_per_week: string
    session_time: string
    notes: string
  }>()

  const called = useRef(false)

  useEffect(() => {
    if (called.current) return
    called.current = true
    generateProgram()
  }, [])

  async function generateProgram() {
    try {
      const { data, error } = await supabase.functions.invoke('generate-program', {
        body: {
          training_history: params.training_history,
          goal: params.goal,
          equipment: params.equipment,
          days_per_week: parseInt(params.days_per_week, 10),
          squat: '0',
          bench: '0',
          deadlift: '0',
          watch_summary: null,
          session_time: parseInt(params.session_time, 10),
          notes: params.notes || null,
        },
      })

      if (error) throw error
      if (!data?.program) throw new Error('No program returned')

      await saveProgram(data.program, data.program.coach_note ?? '')

      router.replace('/(onboarding)/ready')
    } catch (err) {
      console.error('Program generation failed:', err)
      // On failure, redirect anyway — user can regenerate from profile
      router.replace('/(onboarding)/ready')
    }
  }

  return (
    <View style={styles.container}>
      <ActivityIndicator size="large" color={Colors.accent} />
      <Text style={styles.title}>Building your program...</Text>
      <Text style={styles.subtitle}>Your AI coach is designing something for you.</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
    padding: Spacing.lg,
  },
  title: { color: Colors.text, fontSize: 24, fontWeight: '700', textAlign: 'center' },
  subtitle: { color: Colors.muted, fontSize: 16, textAlign: 'center' },
})
