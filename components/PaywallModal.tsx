import React from 'react'
import { Modal, View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type Props = {
  visible: boolean
  onDismiss: () => void
  onUpgrade: () => void
}

export default function PaywallModal({ visible, onDismiss, onUpgrade }: Props) {
  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onDismiss}>
      <View style={styles.overlay}>
        <View style={styles.sheet}>
          <Text style={styles.title}>Adapt Pro</Text>
          <Text style={styles.subtitle}>Less than one personal training session, every month.</Text>

          <View style={styles.features}>
            {[
              'Full AI adaptation engine',
              'Weekly coach message',
              'Pre-workout adjustments',
              'Plateau detection',
              'Full HealthKit integration',
            ].map((f) => (
              <Text key={f} style={styles.feature}>
                {f}
              </Text>
            ))}
          </View>

          <TouchableOpacity style={styles.upgradeBtn} onPress={onUpgrade}>
            <Text style={styles.upgradeBtnText}>$12.99 / month</Text>
          </TouchableOpacity>

          <TouchableOpacity style={styles.yearlyBtn} onPress={onUpgrade}>
            <Text style={styles.yearlyBtnText}>$79.99 / year — save 49%</Text>
          </TouchableOpacity>

          <TouchableOpacity onPress={onDismiss} style={styles.dismissBtn}>
            <Text style={styles.dismissText}>Maybe later</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  )
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    justifyContent: 'flex-end',
  },
  sheet: {
    backgroundColor: Colors.surface,
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  title: { color: Colors.text, fontSize: 28, fontWeight: '800', textAlign: 'center' },
  subtitle: { color: Colors.muted, fontSize: 15, textAlign: 'center', marginTop: Spacing.sm, marginBottom: Spacing.lg },
  features: { gap: Spacing.sm, marginBottom: Spacing.xl },
  feature: { color: Colors.text, fontSize: 15 },
  upgradeBtn: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  upgradeBtnText: { color: Colors.text, fontSize: 18, fontWeight: '700' },
  yearlyBtn: {
    backgroundColor: Colors.success,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  yearlyBtnText: { color: Colors.background, fontSize: 16, fontWeight: '700' },
  dismissBtn: { alignItems: 'center', padding: Spacing.sm },
  dismissText: { color: Colors.muted, fontSize: 15 },
})
