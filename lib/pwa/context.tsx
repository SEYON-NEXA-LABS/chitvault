'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface PwaContextType {
  deferredPrompt: any
  install: () => void
  isInstallable: boolean
}

const PwaContext = createContext<PwaContextType | null>(null)

export function PwaProvider({ children }: { children: React.ReactNode }) {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null)

  useEffect(() => {
    // 1. Check if it was already caught by layout script
    if ((window as any).deferredPrompt) {
      setDeferredPrompt((window as any).deferredPrompt)
    }

    // 2. Also listen for any future events
    const handler = (e: any) => {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  const install = async () => {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const { outcome } = await deferredPrompt.userChoice
    if (outcome === 'accepted') {
      setDeferredPrompt(null)
    }
  }

  return (
    <PwaContext.Provider value={{ deferredPrompt, install, isInstallable: !!deferredPrompt }}>
      {children}
    </PwaContext.Provider>
  )
}

export function usePwa() {
  const ctx = useContext(PwaContext)
  if (!ctx) throw new Error('usePwa must be used within PwaProvider')
  return ctx
}
