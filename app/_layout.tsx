import { useEffect } from 'react'
import { Stack, router } from 'expo-router'
import { Colors } from '../constants/theme'
import { supabase } from '../lib/supabase'
import { startSyncListener } from '../lib/sync'
import { getActiveProgram } from '../lib/programs'

export default function RootLayout() {
  useEffect(() => {
    let unsubscribeSync: (() => void) | undefined

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'INITIAL_SESSION') {
          if (!session) {
            router.replace('/(auth)/login')
          } else {
            unsubscribeSync?.()
            unsubscribeSync = startSyncListener(session.user.id)
            const program = await getActiveProgram()
            router.replace(program ? '/(tabs)/' : '/(onboarding)/welcome')
          }
        } else if (event === 'SIGNED_OUT') {
          unsubscribeSync?.()
          unsubscribeSync = undefined
          router.replace('/(auth)/login')
        } else if (event === 'SIGNED_IN' && session) {
          unsubscribeSync?.()
          unsubscribeSync = startSyncListener(session.user.id)
          const program = await getActiveProgram()
          router.replace(program ? '/(tabs)/' : '/(onboarding)/welcome')
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
