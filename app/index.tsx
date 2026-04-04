import { useEffect, useState } from 'react'
import { Redirect } from 'expo-router'
import { getActiveProgram } from '../lib/programs'

export default function Index() {
  const [hasProgram, setHasProgram] = useState<boolean | null>(null)

  useEffect(() => {
    getActiveProgram().then((p) => setHasProgram(!!p))
  }, [])

  if (hasProgram === null) return null
  return <Redirect href={hasProgram ? '/(tabs)/' : '/(onboarding)/welcome'} />
}
