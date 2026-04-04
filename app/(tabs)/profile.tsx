import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'

export default function ProfileScreen() {
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
  rowTitle: { color: Colors.text, fontSize: 16, fontWeight: '600' },
  rowSub: { color: Colors.muted, fontSize: 13, marginTop: 2 },
  rowArrow: { color: Colors.muted, fontSize: 22 },
  divider: { height: 1, backgroundColor: Colors.surface, marginVertical: Spacing.sm },
})
