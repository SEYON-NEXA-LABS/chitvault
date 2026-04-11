'use client'

import { useEffect, useCallback, useRef } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { useRouter } from 'next/navigation'

const IDLE_TIMEOUT = 30 * 60 * 1000 // 30 minutes

export function IdleTimeout() {
  const supabase = createClient()
  const router = useRouter()
  const { profile } = useFirm()
  const timerRef = useRef<NodeJS.Timeout | null>(null)

  const logout = useCallback(async () => {
    console.log('Idle timeout reached. Logging out...')
    await supabase.auth.signOut()
    router.push('/login?reason=idle')
  }, [supabase.auth, router])

  const resetTimer = useCallback(() => {
    if (timerRef.current) clearTimeout(timerRef.current)
    if (profile) {
      timerRef.current = setTimeout(logout, IDLE_TIMEOUT)
    }
  }, [logout, profile])

  useEffect(() => {
    if (!profile) return

    // Events to watch for activity
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    
    // Set initial timer
    resetTimer()

    // Add listeners
    events.forEach(evt => window.addEventListener(evt, resetTimer))

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      events.forEach(evt => window.removeEventListener(evt, resetTimer))
    }
  }, [profile, resetTimer])

  return null // This is a logic-only component
}
