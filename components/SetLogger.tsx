import React, { useState } from 'react'
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native'
import { Colors, Spacing } from '../constants/theme'

type Props = {
  setNumber: number
  targetReps: string
  defaultWeight: number
  completed: boolean
  onLog: (reps: number, weight: number) => void
}

export default function SetLogger({
  setNumber,
  targetReps,
  defaultWeight,
  completed,
  onLog,
}: Props) {
  const [reps, setReps] = useState(parseInt(targetReps) || 5)
  const [weight, setWeight] = useState(defaultWeight)

  return (
    <View style={[styles.row, completed && styles.rowCompleted]}>
      <Text style={styles.setNum}>{setNumber}</Text>
      <Text style={styles.target}>{targetReps}</Text>
      <View style={styles.control}>
        <TouchableOpacity onPress={() => setWeight((w) => Math.max(0, w - 5))} style={styles.btn}>
          <Text style={styles.btnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.value}>{weight}</Text>
        <TouchableOpacity onPress={() => setWeight((w) => w + 5)} style={styles.btn}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
      <View style={styles.control}>
        <TouchableOpacity onPress={() => setReps((r) => Math.max(1, r - 1))} style={styles.btn}>
          <Text style={styles.btnText}>-</Text>
        </TouchableOpacity>
        <Text style={styles.value}>{reps}</Text>
        <TouchableOpacity onPress={() => setReps((r) => r + 1)} style={styles.btn}>
          <Text style={styles.btnText}>+</Text>
        </TouchableOpacity>
      </View>
      <TouchableOpacity
        style={[styles.logBtn, completed && styles.logBtnDone]}
        onPress={() => !completed && onLog(reps, weight)}
        disabled={completed}
      >
        <Text style={styles.logBtnText}>{completed ? 'Done' : 'Log'}</Text>
      </TouchableOpacity>
    </View>
  )
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', paddingVertical: Spacing.xs },
  rowCompleted: { opacity: 0.6 },
  setNum: { flex: 1, color: Colors.text, textAlign: 'center' },
  target: { flex: 1, color: Colors.text, textAlign: 'center' },
  control: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4 },
  btn: { padding: 4, backgroundColor: Colors.background, borderRadius: 6, width: 28, alignItems: 'center' },
  btnText: { color: Colors.text, fontSize: 16, fontWeight: '700' },
  value: { color: Colors.text, minWidth: 32, textAlign: 'center', fontWeight: '600' },
  logBtn: { flex: 1, backgroundColor: Colors.accent, borderRadius: 6, padding: 8, alignItems: 'center', marginLeft: 4 },
  logBtnDone: { backgroundColor: Colors.success },
  logBtnText: { color: Colors.text, fontWeight: '700', fontSize: 13 },
})
