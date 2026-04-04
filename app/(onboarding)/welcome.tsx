import React from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { router } from 'expo-router'
import { Colors, Spacing } from '../../constants/theme'

export default function WelcomeScreen() {
  return (
    <View style={styles.container}>
      <View style={styles.content}>
        <Text style={styles.logo}>ADAPT</Text>
        <Text style={styles.tagline}>Your program adapts to your life.</Text>
        <Text style={styles.subtext}>
          For people who are serious about lifting but not obsessed with it.
        </Text>
      </View>
      <View style={styles.actions}>
        <TouchableOpacity
          style={styles.primaryButton}
          onPress={() => router.push('/(onboarding)/questions')}
        >
          <Text style={styles.primaryButtonText}>Start Fresh</Text>
        </TouchableOpacity>
        <Text style={styles.disclaimer}>No account required to see your first workout.</Text>
      </View>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    padding: Spacing.lg,
    justifyContent: 'space-between',
  },
  content: {
    flex: 1,
    justifyContent: 'center',
  },
  logo: {
    color: Colors.accent,
    fontSize: 48,
    fontWeight: '800',
    letterSpacing: 8,
    marginBottom: Spacing.lg,
  },
  tagline: {
    color: Colors.text,
    fontSize: 28,
    fontWeight: '700',
    lineHeight: 36,
    marginBottom: Spacing.md,
  },
  subtext: {
    color: Colors.muted,
    fontSize: 16,
    lineHeight: 24,
  },
  actions: {
    gap: Spacing.sm,
  },
  primaryButton: {
    backgroundColor: Colors.accent,
    padding: Spacing.md,
    borderRadius: 12,
    alignItems: 'center',
  },
  primaryButtonText: {
    color: Colors.text,
    fontSize: 18,
    fontWeight: '700',
  },
  disclaimer: {
    color: Colors.muted,
    fontSize: 13,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
})
