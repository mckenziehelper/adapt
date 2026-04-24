import { useState, useCallback } from 'react'
import { View, Text, TouchableOpacity, StyleSheet, Alert, ActivityIndicator } from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { router, useFocusEffect } from 'expo-router'
import AsyncStorage from '@react-native-async-storage/async-storage'
import { Colors, Spacing } from '../../constants/theme'
import { supabase } from '../../lib/supabase'
import { runWeeklyAdaptation } from '../../lib/adaptation'
import { requireAuthAndPro, userHasPro } from '../../lib/auth-gate'

const TRIAL_WEEKS = 4

type AuthStatus = 'loading' | 'signed-out' | 'trial' | 'pro' | 'expired'

function getTrialWeeksLeft(createdAt: string): number {
  const weeks = (Date.now() - new Date(createdAt).getTime()) / (1000 * 60 * 60 * 24 * 7)
  return Math.max(0, Math.ceil(TRIAL_WEEKS - weeks))
}

export default function ProfileScreen() {
  const [adapting, setAdapting] = useState(false)
  const [authStatus, setAuthStatus] = useState<AuthStatus>('loading')
  const [userEmail, setUserEmail] = useState<string | null>(null)
  const [createdAt, setCreatedAt] = useState<string | null>(null)

  useFocusEffect(
    useCallback(() => {
      loadAuthStatus()
    }, [])
  )

  async function loadAuthStatus() {
    setAuthStatus('loading')
    const { data: { session } } = await supabase.auth.getSession()
    if (!session) {
      setAuthStatus('signed-out')
      setUserEmail(null)
      return
    }

    setUserEmail(session.user.email ?? null)
    setCreatedAt(session.user.created_at)

    const { data: profile } = await supabase
      .from('profiles')
      .select('is_pro, created_at')
      .eq('id', session.user.id)
      .single()

    if (profile?.is_pro) {
      setAuthStatus('pro')
      return
    }

    const refDate = profile?.created_at ?? session.user.created_at
    const weeks = (Date.now() - new Date(refDate).getTime()) / (1000 * 60 * 60 * 24 * 7)
    if (weeks < TRIAL_WEEKS) {
      setAuthStatus('trial')
      setCreatedAt(refDate)
    } else {
      setAuthStatus('expired')
    }
  }

  async function handleSignOut() {
    Alert.alert('Sign out?', 'You can sign back in anytime.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Sign Out',
        style: 'destructive',
        onPress: async () => {
          await supabase.auth.signOut()
          setAuthStatus('signed-out')
          setUserEmail(null)
        },
      },
    ])
  }

  async function handleWeeklyReview() {
    const allowed = await requireAuthAndPro()
    if (!allowed) return
    setAdapting(true)
    try {
      const result = await runWeeklyAdaptation('build strength', 1)
      await AsyncStorage.setItem('pending_adaptation', JSON.stringify(result))
      router.push('/review-adaptation')
    } catch (err: any) {
      Alert.alert('Adaptation failed', err?.message ?? 'Something went wrong. Try again.')
    } finally {
      setAdapting(false)
    }
  }

  const weeksLeft = createdAt ? getTrialWeeksLeft(createdAt) : 0

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.container}>
        <Text style={styles.heading}>Profile</Text>

        {/* Account status card */}
        <View style={styles.accountCard}>
          {authStatus === 'loading' && (
            <ActivityIndicator color={Colors.accent} />
          )}

          {authStatus === 'signed-out' && (
            <View style={styles.accountRow}>
              <View>
                <Text style={styles.accountLabel}>NOT SIGNED IN</Text>
                <Text style={styles.accountSub}>Sign in to unlock Pro features</Text>
              </View>
              <TouchableOpacity style={styles.signInBtn} onPress={() => router.push('/(auth)/login')}>
                <Text style={styles.signInBtnText}>Sign In</Text>
              </TouchableOpacity>
            </View>
          )}

          {(authStatus === 'trial' || authStatus === 'pro' || authStatus === 'expired') && (
            <>
              <View style={styles.accountRow}>
                <View style={styles.accountInfo}>
                  <Text style={styles.accountEmail} numberOfLines={1}>{userEmail}</Text>
                  {authStatus === 'pro' && (
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusBadgeText}>PRO</Text>
                    </View>
                  )}
                  {authStatus === 'trial' && (
                    <View style={[styles.statusBadge, styles.statusTrial]}>
                      <Text style={styles.statusBadgeText}>
                        TRIAL · {weeksLeft} {weeksLeft === 1 ? 'WEEK' : 'WEEKS'} LEFT
                      </Text>
                    </View>
                  )}
                  {authStatus === 'expired' && (
                    <View style={[styles.statusBadge, styles.statusExpired]}>
                      <Text style={styles.statusBadgeText}>TRIAL ENDED</Text>
                    </View>
                  )}
                </View>
                <TouchableOpacity onPress={handleSignOut}>
                  <Text style={styles.signOutText}>Sign out</Text>
                </TouchableOpacity>
              </View>

              {(authStatus === 'trial' || authStatus === 'expired') && (
                <TouchableOpacity style={styles.upgradeBtn} onPress={() => router.push('/paywall')}>
                  <Text style={styles.upgradeBtnText}>Upgrade to Pro →</Text>
                </TouchableOpacity>
              )}
            </>
          )}
        </View>

        <TouchableOpacity style={styles.row} onPress={() => router.push('/program')}>
          <View>
            <Text style={styles.rowTitle}>My Program</Text>
            <Text style={styles.rowSub}>View or edit your program</Text>
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

        <TouchableOpacity style={styles.row} onPress={async () => {
          const allowed = await requireAuthAndPro()
          if (allowed) router.push('/(onboarding)/welcome')
        }}>
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

  accountCard: {
    backgroundColor: Colors.surface,
    borderRadius: 12,
    padding: Spacing.md,
    marginBottom: Spacing.lg,
  },
  accountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  accountInfo: { flex: 1, marginRight: Spacing.sm },
  accountEmail: { color: Colors.text, fontSize: 14, fontWeight: '600', marginBottom: 6 },
  accountLabel: { color: Colors.muted, fontSize: 13, fontWeight: '600' },
  accountSub: { color: Colors.muted, fontSize: 12, marginTop: 2 },

  statusBadge: {
    alignSelf: 'flex-start',
    backgroundColor: Colors.accent + '33',
    borderRadius: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
  },
  statusTrial: { backgroundColor: Colors.success + '33' },
  statusExpired: { backgroundColor: Colors.muted + '33' },
  statusBadgeText: { color: Colors.text, fontSize: 10, fontWeight: '800', letterSpacing: 1 },

  signInBtn: {
    backgroundColor: Colors.accent,
    paddingHorizontal: 16,
    paddingVertical: 8,
    borderRadius: 8,
  },
  signInBtnText: { color: Colors.text, fontSize: 14, fontWeight: '700' },
  signOutText: { color: Colors.muted, fontSize: 13 },

  upgradeBtn: {
    marginTop: Spacing.sm,
    backgroundColor: Colors.accent,
    borderRadius: 8,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  upgradeBtnText: { color: Colors.text, fontSize: 14, fontWeight: '700' },

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
