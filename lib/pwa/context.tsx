'use client'

import React, { createContext, useContext, useState, useEffect } from 'react'

interface PwaContextType {
  deferredPrompt: any
  install: () => void
  isInstallable: boolean
}

const PwaContext = createContext<PwaContextType | null>(null)

export function PwaProvider({ children }: { children: React.ReactNode }) {
  // PWA Disabled for stability
  const [deferredPrompt] = useState<any>(null)

  const install = async () => {
    console.log('PWA installation is currently disabled.')
  }

  return (
    <PwaContext.Provider value={{ deferredPrompt, install, isInstallable: false }}>
      {children}
    </PwaContext.Provider>
  )
}

export function usePwa() {
  const ctx = useContext(PwaContext)
  if (!ctx) throw new Error('usePwa must be used within PwaProvider')
  return ctx
}
