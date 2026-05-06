'use client'

import React, { createContext, useContext, useState, useEffect, useRef } from 'react'
import { PinOverlay } from '@/components/ui'
import { cn } from '@/lib/utils'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

interface PinLockContextType {
  isLocked: boolean
  hasPin: boolean
  lock: () => void
  unlock: (pin: string) => boolean
  setPin: (newPin: string | null) => void
  clearLock: () => Promise<void>
  isElectron: boolean
  lockTimeout: number
  updateLockTimeout: (ms: number) => void
}

const PinLockContext = createContext<PinLockContextType | null>(null)

// Ideal security model: 5 minutes of total idle, or immediate lock when backgrounded
const INACTIVITY_TIMEOUT = 5 * 60 * 1000 

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false)
  const [hasPin, setHasPin] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const [lockTimeout, setLockTimeoutState] = useState(5 * 60 * 1000) // Default 5 mins
  const timerRef = useRef<NodeJS.Timeout | null>(null)
  
  const supabase = createClient()
  const router = useRouter()
  const pathname = usePathname()
  const isPublicPage = ['/login', '/register', '/reset-password', '/onboarding'].includes(pathname)
 
  // 1. Initial State & PIN Check
  useEffect(() => {
    const electron = (window as any).electronAPI?.isElectron === true
    setIsElectron(electron)
 
    const savedPin = localStorage.getItem('desktop_pin')
    if (savedPin) {
      setHasPin(true)
      setIsLocked(true) // Auto-lock on startup if PIN is set
    }

    const savedTimeout = localStorage.getItem('lock_timeout')
    if (savedTimeout) {
      setLockTimeoutState(parseInt(savedTimeout))
    }
  }, [])
 
  // 2. Inactivity Logic
  useEffect(() => {
    if (!hasPin || isLocked || isPublicPage) return
 
    const resetTimer = () => {
      if (timerRef.current) clearTimeout(timerRef.current)
      timerRef.current = setTimeout(() => {
        setIsLocked(true)
      }, lockTimeout)
    }
 
    const events = ['mousedown', 'mousemove', 'keypress', 'scroll', 'touchstart']
    events.forEach(name => document.addEventListener(name, resetTimer))
    resetTimer()
 
    return () => {
      events.forEach(name => document.removeEventListener(name, resetTimer))
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [hasPin, isLocked, isPublicPage, lockTimeout])
 
  // 3. Background/Visibility Logic (Mobile "App Switch" Lock)
  useEffect(() => {
    if (!hasPin || isPublicPage) return
 
    let bgTimeout: NodeJS.Timeout | null = null
 
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Wait for the configured lockTimeout before locking when backgrounded
        // This prevents immediate locking during window/tab switching
        bgTimeout = setTimeout(() => {
          setIsLocked(true)
        }, lockTimeout)
      } else {
        // If user returns within 30s, cancel the pending lock
        if (bgTimeout) clearTimeout(bgTimeout)
      }
    }
 
    document.addEventListener('visibilitychange', handleVisibilityChange)
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange)
      if (bgTimeout) clearTimeout(bgTimeout)
    }
  }, [hasPin, isPublicPage])
 
  const lock = () => {
    if (hasPin) setIsLocked(true)
  }
 
  const unlock = (pin: string) => {
    const savedPin = localStorage.getItem('desktop_pin')
    if (pin === savedPin) {
      setIsLocked(false)
      return true
    }
    return false
  }
 
  const setPin = (newPin: string | null) => {
    if (newPin) {
      localStorage.setItem('desktop_pin', newPin)
      setHasPin(true)
    } else {
      localStorage.removeItem('desktop_pin')
      setHasPin(false)
      setIsLocked(false)
    }
  }

  const updateLockTimeout = (ms: number) => {
    setLockTimeoutState(ms)
    localStorage.setItem('lock_timeout', ms.toString())
  }
  
  const clearLock = async () => {
    try {
      localStorage.removeItem('desktop_pin')
      localStorage.removeItem('lock_timeout')
      setHasPin(false)
      setIsLocked(false)
      // Attempt a clean logout but don't hang if it fails
      await supabase.auth.signOut().catch(() => {})
    } finally {
      // Force a full page reload to the login screen for maximum security
      window.location.href = '/login'
    }
  }
 
  const showOverlay = isLocked && !isPublicPage
 
  return (
    <PinLockContext.Provider value={{ 
      isLocked, 
      hasPin, 
      lock, 
      unlock, 
      setPin, 
      clearLock, 
      isElectron,
      lockTimeout,
      updateLockTimeout
    }}>
      {showOverlay && <PinOverlay onUnlock={unlock} />}
      <div className={cn(
        "transition-all duration-300",
        showOverlay ? "opacity-0 pointer-events-none scale-95" : "opacity-100 scale-100"
      )}>
        {children}
      </div>
    </PinLockContext.Provider>
  )
}

export function usePinLock() {
  const ctx = useContext(PinLockContext)
  if (!ctx) throw new Error('usePinLock must be used within PinLockProvider')
  return ctx
}
