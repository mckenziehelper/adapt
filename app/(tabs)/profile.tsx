import { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'
import { runWeeklyAdaptation } from '../../lib/adaptation'

export default function ProfileScreen() {
  const [adapting, setAdapting] = useState(false)

  async function handleWeeklyReview() {
    setAdapting(true)
    try {
      // goal and weeksOnApp are hardcoded here; extend with user profile store when available.
      await runWeeklyAdaptation('build strength', 1)
      Alert.alert(
        'Adaptation complete',
        'Your program has been updated. Check the home screen for your coach message.',
        [{ text: 'View', onPress: () => router.replace('/(tabs)/') }],
      )
    } catch (err: any) {
      Alert.alert('Adaptation failed', err?.message ?? 'Something went wrong. Try again.')
    } finally {
      setAdapting(false)
    }
  }

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.heading}>Profile</Text>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/program')}>
          <View>
            <Text style={styles.rowTitle}>My Program</Text>
            <Text style={styles.rowSub}>View, edit, or chat with your coach</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity
          style={[styles.row, adapting && styles.rowDisabled]}
          onPress={handleWeeklyReview}
          disabled={adapting}
        >
          <View style={styles.rowContent}>
            <Text style={styles.rowTitle}>Weekly Review</Text>
            <Text style={styles.rowSub}>Adapt your program based on this week</Text>
          </View>
          {adapting
            ? <ActivityIndicator color={Colors.accent} />
            : <Text style={styles.rowArrow}>›</Text>
          }
        </TouchableOpacity>

        <View style={styles.divider} />

        <TouchableOpacity style={styles.row} onPress={() => router.push('/(onboarding)/welcome')}>
          <View>
            <Text style={styles.rowTitle}>Generate New Program</Text>
            <Text style={styles.rowSub}>Start fresh with updated goals</Text>
          </View>
          <Text style={styles.rowArrow}>›</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  container: { padding: Spacing.lg },
  heading: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '800',
    marginBottom: Spacing.lg,
  },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  rowDisabled: { opacity: 0.5 },
  rowContent: { flex: 1 },
  rowTitle: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: Colors.muted, fontSize: 13, marginTop: 2 },
  rowArrow: { color: Colors.muted, fontSize: 22 },
  divider: { height: 1, backgroundColor: Colors.surface, marginVertical: Spacing.sm },
})
