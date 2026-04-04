import React, { useEffect, useRef, useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type Props = {
  seconds: number
  onDone?: () => void
  onSkip?: () => void
}

export default function RestTimer({ seconds, onDone, onSkip }: Props) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current!)
          onDone?.()
          return 0
        }
        return r - 1
      })
    }, 1000)

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Rest</Text>
      <Text style={styles.time}>{remaining}s</Text>
      <TouchableOpacity
        onPress={() => {
          if (intervalRef.current) clearInterval(intervalRef.current)
          onSkip?.()
        }}
        style={styles.skipBtn}
      >
        <Text style={styles.skipText}>Skip</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.accent,
    padding: Spacing.sm,
    paddingHorizontal: Spacing.md,
    justifyContent: 'space-between',
  },
  label: { color: Colors.text, fontWeight: '700', fontSize: 16 },
  time: { color: Colors.text, fontWeight: '800', fontSize: 20 },
  skipBtn: { padding: Spacing.xs },
  skipText: { color: Colors.text, fontSize: 14 },
})
