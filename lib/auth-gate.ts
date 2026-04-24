import { Alert } from 'react-native'
import { router } from 'expo-router'
import { supabase } from './supabase'
import { getDeviceId } from './device'

const TRIAL_WEEKS = 4

export async function userHasPro(userId: string, userCreatedAt?: string): Promise<boolean> {
  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro, created_at')
    .eq('id', userId)
    .single()

  // No profile row yet — use auth created_at if available, otherwise grant trial
  if (!profile) {
    if (!userCreatedAt) return true
    const weeksOnApp = (Date.now() - new Date(userCreatedAt).getTime()) / (1000 * 60 * 60 * 24 * 7)
    return weeksOnApp < TRIAL_WEEKS
  }

  if (profile.is_pro) return true

  const weeksOnApp = (Date.now() - new Date(profile.created_at).getTime()) / (1000 * 60 * 60 * 24 * 7)
  if (weeksOnApp >= TRIAL_WEEKS) return false

  const deviceId = await getDeviceId()
  const { data: trialUsed } = await supabase.rpc('check_device_trial_used', {
    p_device_id: deviceId,
    p_user_id: userId,
  })
  return !trialUsed
}

/**
 * Check that the user is signed in and has Pro access (subscription or trial).
 * Shows an explanatory alert before redirecting — never silently drops the user
 * onto a login screen without context.
 */
export async function requireAuthAndPro(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    return new Promise((resolve) => {
      Alert.alert(
        'Start Your Free Trial',
        'This feature is part of Adapt Pro. Create a free account to unlock AI coaching, weekly adaptation, and coach chat for 4 weeks — no credit card required.',
        [
          {
            text: 'Create Account',
            onPress: () => { router.push('/(auth)/signup'); resolve(false) },
          },
          {
            text: 'Sign In',
            onPress: () => { router.push('/(auth)/login'); resolve(false) },
          },
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false),
          },
        ]
      )
    })
  }

  const hasPro = await userHasPro(session.user.id, session.user.created_at)
  if (!hasPro) {
    return new Promise((resolve) => {
      Alert.alert(
        'Upgrade to Adapt Pro',
        'Your 4-week trial has ended. Subscribe to keep getting weekly AI adaptation, coach chat, and plateau detection.',
        [
          {
            text: 'See Plans',
            onPress: () => { router.push('/paywall'); resolve(false) },
          },
          {
            text: 'Not Now',
            style: 'cancel',
            onPress: () => resolve(false),
          },
        ]
      )
    })
  }

  return true
}
