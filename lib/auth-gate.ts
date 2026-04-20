import { router } from 'expo-router'
import { supabase } from './supabase'

/**
 * Check that the user is signed in and has an active Pro subscription.
 * Redirects to login or paywall if not. Returns true if access is granted.
 */
export async function requireAuthAndPro(): Promise<boolean> {
  const { data: { session } } = await supabase.auth.getSession()

  if (!session) {
    router.push('/(auth)/login')
    return false
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('is_pro')
    .eq('id', session.user.id)
    .single()

  if (!profile?.is_pro) {
    router.push('/paywall')
    return false
  }

  return true
}
