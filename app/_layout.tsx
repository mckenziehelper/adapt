import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { Colors } from '../constants/theme'
import { supabase } from '../lib/supabase'
import { startSyncListener } from '../lib/sync'
import { getActiveProgram } from '../lib/programs'

export default function RootLayout() {
  useEffect(() => {
    let unsubscribeSync: (() => void) | undefined

    async function init() {
      // Route based on local program state — no auth required
      const program = await getActiveProgram()
      router.replace(program ? '/(tabs)/' : '/(onboarding)/welcome')

      // Start sync if a session already exists (optional, best-effort)
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        unsubscribeSync = startSyncListener(session.user.id)
      }
    }

    init()

    // Wire up sync when user signs in later (e.g. from profile)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        if (event === 'SIGNED_IN' && session) {
          unsubscribeSync?.()
          unsubscribeSync = startSyncListener(session.user.id)
        } else if (event === 'SIGNED_OUT') {
          unsubscribeSync?.()
          unsubscribeSync = undefined
        }
      }
    )

    return () => {
      subscription.unsubscribe()
      unsubscribeSync?.()
    }
  }, [])

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: Colors.background },
      }}
    />
  )
}
