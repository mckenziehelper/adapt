import { View, Text, TouchableOpacity, StyleSheet, ScrollView } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router } from 'expo-router'
import { Colors, Spacing } from '../constants/theme'

const PRO_FEATURES = [
  { emoji: '🤖', title: 'Weekly AI Adaptation', desc: 'Your program adjusts every week based on what actually happened' },
  { emoji: '💬', title: 'Coach Chat', desc: 'Tell the AI what to change — it rewrites your program instantly' },
  { emoji: '🔄', title: 'Generate New Programs', desc: 'Start fresh anytime with a new AI-built program' },
  { emoji: '📈', title: 'Plateau Detection', desc: 'AI spots stalls before you do and intervenes automatically' },
  { emoji: '📋', title: 'Full History', desc: 'Unlimited session history and progress charts' },
]

export default function PaywallScreen() {
  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} style={styles.backBtn}>
          <Text style={styles.backText}>‹ Back</Text>
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.eyebrow}>ADAPT PRO</Text>
        <Text style={styles.headline}>Your program,{'\n'}always improving.</Text>
        <Text style={styles.sub}>
          The AI doesn't just generate your program — it manages it week by week.
        </Text>

        <View style={styles.featuresCard}>
          {PRO_FEATURES.map((f) => (
            <View key={f.title} style={styles.featureRow}>
              <Text style={styles.featureEmoji}>{f.emoji}</Text>
              <View style={styles.featureText}>
                <Text style={styles.featureTitle}>{f.title}</Text>
                <Text style={styles.featureDesc}>{f.desc}</Text>
              </View>
            </View>
          ))}
        </View>

        <View style={styles.pricingCard}>
          <Text style={styles.price}>$12.99<Text style={styles.pricePer}> / month</Text></Text>
          <Text style={styles.priceAlt}>or $79.99 / year — save 49%</Text>
          <Text style={styles.priceTagline}>Less than one personal training session.</Text>
        </View>

        {/* RevenueCat purchase buttons go here in Phase 3 */}
        <TouchableOpacity style={styles.ctaBtn}>
          <Text style={styles.ctaBtnText}>Start Free Trial — 4 Weeks Free</Text>
        </TouchableOpacity>

        <TouchableOpacity style={styles.signInRow} onPress={() => router.push('/(auth)/login')}>
          <Text style={styles.signInText}>Already have an account? <Text style={styles.signInLink}>Sign in</Text></Text>
        </TouchableOpacity>

        <Text style={styles.legal}>Cancel anytime. No commitment.</Text>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: Colors.background },
  header: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.sm,
  },
  backBtn: { alignSelf: 'flex-start', paddingVertical: 4 },
  backText: { color: Colors.accent, fontSize: 17 },

  container: { padding: Spacing.lg, paddingBottom: 40 },

  eyebrow: {
    color: Colors.accent,
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 3,
    marginBottom: Spacing.sm,
  },
  headline: {
    color: Colors.text,
    fontSize: 34,
    fontWeight: '800',
    lineHeight: 40,
    marginBottom: Spacing.sm,
  },
  sub: {
    color: Colors.muted,
    fontSize: 15,
    lineHeight: 22,
    marginBottom: Spacing.xl,
  },

  featuresCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.md,
    marginBottom: Spacing.md,
    gap: Spacing.md,
  },
  featureRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  featureEmoji: { fontSize: 22, width: 30 },
  featureText: { flex: 1 },
  featureTitle: { color: Colors.text, fontSize: 15, fontWeight: '600', marginBottom: 2 },
  featureDesc: { color: Colors.muted, fontSize: 13, lineHeight: 18 },

  pricingCard: {
    backgroundColor: Colors.surface,
    borderRadius: 16,
    padding: Spacing.lg,
    marginBottom: Spacing.lg,
    alignItems: 'center',
  },
  price: { color: Colors.text, fontSize: 36, fontWeight: '800' },
  pricePer: { fontSize: 18, fontWeight: '400', color: Colors.muted },
  priceAlt: { color: Colors.muted, fontSize: 14, marginTop: 4 },
  priceTagline: { color: Colors.accent, fontSize: 13, fontWeight: '600', marginTop: Spacing.sm },

  ctaBtn: {
    backgroundColor: Colors.accent,
    borderRadius: 14,
    paddingVertical: Spacing.md,
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  ctaBtnText: { color: Colors.text, fontSize: 16, fontWeight: '700' },

  signInRow: { alignItems: 'center', marginBottom: Spacing.md },
  signInText: { color: Colors.muted, fontSize: 14 },
  signInLink: { color: Colors.accent, fontWeight: '600' },

  legal: { color: Colors.muted, fontSize: 12, textAlign: 'center' },
})
