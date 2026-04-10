import { useEffect, useState } from 'react'
import { Stack, router } from 'expo-router'
import { Colors } from '../constants/theme'
import { supabase } from '../lib/supabase'
import { startSyncListener } from '../lib/sync'
import { getActiveProgram } from '../lib/programs'

export default function RootLayout() {
  const [checked, setChecked] = useState(false)

  useEffect(() => {
    let unsubscribeSync: (() => void) | undefined

    async function checkSession() {
      const { data: { session } } = await supabase.auth.getSession()

      if (!session) {
        router.replace('/(auth)/login')
        setChecked(true)
        return
      }

      // Start sync listener now that we have a confirmed user
      unsubscribeSync = startSyncListener(session.user.id)

      const program = await getActiveProgram()
      if (!program) {
        router.replace('/(onboarding)/welcome')
      } else {
        router.replace('/(tabs)/')
      }

      setChecked(true)
    }

    checkSession()

    // Also listen for auth state changes (login / logout events)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      async (event, session) => {
        if (event === 'SIGNED_OUT') {
          unsubscribeSync?.()
          router.replace('/(auth)/login')
        } else if (event === 'SIGNED_IN' && session) {
          unsubscribeSync = startSyncListener(session.user.id)
          const program = await getActiveProgram()
          if (!program) {
            router.replace('/(onboarding)/welcome')
          } else {
            router.replace('/(tabs)/')
          }
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
