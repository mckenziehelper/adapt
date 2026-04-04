import { View, Text, StyleSheet } from 'react-native'
import { Colors } from '../../constants/theme'

export default function SignupScreen() {
  return (
    <View style={styles.container}>
      <Text style={styles.text}>Signup — Phase 2</Text>
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: { color: Colors.muted, fontSize: 16 },
})
