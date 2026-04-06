'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'
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
}

const PinLockContext = createContext<PinLockContextType | null>(null)

export function PinLockProvider({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false)
  const [hasPin, setHasPin] = useState(false)
  const [isElectron, setIsElectron] = useState(false)
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    const electron = (window as any).electronAPI?.isElectron === true
    setIsElectron(electron)

    const savedPin = localStorage.getItem('desktop_pin')
    if (savedPin) {
      setHasPin(true)
      setIsLocked(true) // Auto-lock on startup if PIN is set
    }
  }, [])

  const pathname = usePathname()
  const isPublicPage = ['/login', '/register', '/reset-password', '/onboarding'].includes(pathname)

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
  
  const clearLock = async () => {
    localStorage.removeItem('desktop_pin')
    setHasPin(false)
    setIsLocked(false)
    await supabase.auth.signOut()
    router.push('/login')
  }

  const showOverlay = isLocked && !isPublicPage

  return (
    <PinLockContext.Provider value={{ isLocked, hasPin, lock, unlock, setPin, clearLock, isElectron }}>
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
