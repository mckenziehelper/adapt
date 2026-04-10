import { useEffect, useState } from 'react'
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors, Spacing } from '../constants/theme'
import { AdaptationResult, applyAdaptation, saveCoachMessageOnly } from '../lib/adaptation'

export default function ReviewAdaptationScreen() {
  const [result, setResult] = useState<AdaptationResult | null>(null)
  const [applying, setApplying] = useState(false)

  useEffect(() => {
    async function load() {
      const raw = await AsyncStorage.getItem('pending_adaptation')
      if (raw) {
        try {
          setResult(JSON.parse(raw))
        } catch {
          router.replace('/(tabs)/')
        }
      } else {
        router.replace('/(tabs)/')
      }
    }
    load()
  }, [])

  async function handleAccept() {
    if (!result) return
    setApplying(true)
    try {
      await applyAdaptation(result)
      await AsyncStorage.removeItem('pending_adaptation')
      router.replace('/(tabs)/')
    } catch (err: any) {
      Alert.alert('Could not apply changes', err?.message ?? 'Try again.')
      setApplying(false)
    }
  }

  async function handleKeep() {
    if (!result) return
    await saveCoachMessageOnly(result)
    await AsyncStorage.removeItem('pending_adaptation')
    router.replace('/(tabs)/')
  }

  if (!result) {
    return (
      <SafeAreaView style={styles.safe}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.accent} size="large" />
        </View>
      </SafeAreaView>
    )
  }

  return (
    <SafeAreaView style={styles.safe}>
      <ScrollView style={styles.scroll} contentContainerStyle={styles.container}>
        {/* Coach message */}
        <View style={styles.section}>
          <Text style={styles.sectionLabel}>FROM YOUR COACH</Text>
          <Text style={styles.coachMessage}>{result.weekly_coach_message}</Text>
        </View>

        {/* Next week focus */}
        {result.next_week_focus ? (
          <View style={styles.focusCard}>
            <Text style={styles.focusLabel}>NEXT WEEK'S FOCUS</Text>
            <Text style={styles.focusText}>{result.next_week_focus}</Text>
          </View>
        ) : null}

        {/* Changes */}
        {result.changes && result.changes.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PROPOSED CHANGES</Text>
            {result.changes.map((change, i) => (
              <View key={i} style={styles.changeRow}>
                <View style={styles.changeDot} />
                <View style={styles.changeContent}>
                  <Text style={styles.changeExercise}>{change.exercise}</Text>
                  <Text style={styles.changeReason}>{change.reason}</Text>
                  {change.old_value && change.new_value ? (
                    <Text style={styles.changeValues}>
                      {change.old_value} → {change.new_value}
                    </Text>
                  ) : null}
                </View>
              </View>
            ))}
          </View>
        ) : (
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>PROPOSED CHANGES</Text>
            <Text style={styles.noChanges}>No structural changes this week — your program is working well.</Text>
          </View>
        )}

        {/* Plateau alert */}
        {result.plateau_detected?.detected ? (
          <View style={styles.plateauCard}>
            <Text style={styles.plateauLabel}>PLATEAU DETECTED</Text>
            <Text style={styles.plateauExercise}>{result.plateau_detected.exercise}</Text>
            <Text style={styles.plateauIntervention}>{result.plateau_detected.intervention}</Text>
          </View>
        ) : null}

        {/* Actions */}
        <View style={styles.actions}>
          <TouchableOpacity
            style={[styles.acceptBtn, applying && styles.btnDisabled]}
            onPress={handleAccept}
            disabled={applying}
          >
            {applying
              ? <ActivityIndicator color={Colors.text} />
              : <Text style={styles.acceptBtnText}>Accept Changes</Text>
            }
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.keepBtn, applying && styles.btnDisabled]}
            onPress={handleKeep}
            disabled={applying}
          >
            <Text style={styles.keepBtnText}>Keep Current Program</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  scroll: { flex: 1 },
  container: { padding: Spacing.lg, paddingBottom: 40 },

  section: { marginBottom: Spacing.lg },
  sectionLabel: {
    color: Colors.muted,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: Spacing.sm,
  },

  coachMessage: {
    color: Colors.text,
    fontSize: 16,
    lineHeight: 24,
  },

  focusCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: Colors.accent,
    marginBottom: Spacing.lg,
  },
  focusLabel: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  focusText: { color: Colors.text, fontSize: 15, fontWeight: '600' },

  changeRow: {
    flexDirection: 'row',
    marginBottom: Spacing.md,
  },
  changeDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.accent,
    marginTop: 6,
    marginRight: Spacing.sm,
    flexShrink: 0,
  },
  changeContent: { flex: 1 },
  changeExercise: { color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  changeReason: { color: Colors.muted, fontSize: 13, lineHeight: 18, marginBottom: 2 },
  changeValues: { color: Colors.accent, fontSize: 13, fontWeight: '600' },

  noChanges: { color: Colors.muted, fontSize: 14, lineHeight: 20 },

  plateauCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: '#F59E0B',
    marginBottom: Spacing.lg,
  },
  plateauLabel: {
    color: '#F59E0B',
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 2,
    marginBottom: 4,
  },
  plateauExercise: { color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 4 },
  plateauIntervention: { color: Colors.muted, fontSize: 13, lineHeight: 18 },

  actions: { gap: 12, marginTop: Spacing.md },
  acceptBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  keepBtn: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  btnDisabled: { opacity: 0.5 },
  acceptBtnText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  keepBtnText: { color: Colors.muted, fontSize: 16, fontWeight: '600' },
})
