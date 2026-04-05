'use client'

import { useState, useEffect } from 'react'
import { WifiOff, Wifi, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export function NetworkStatus() {
  const [isOnline, setIsOnline] = useState(true)
  const [showBackOnline, setShowBackOnline] = useState(false)

  useEffect(() => {
    // Initial check
    setIsOnline(navigator.onLine)

    const handleOnline = () => {
      setIsOnline(true)
      setShowBackOnline(true)
      // Hide the "Back Online" message after 3 seconds
      setTimeout(() => setShowBackOnline(false), 3000)
    }

    const handleOffline = () => {
      setIsOnline(false)
      setShowBackOnline(false)
    }

    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)

    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  // 1. Offline Banner: Slides in from top
  // 2. Back Online Banner: Brief green flash
  return (
    <>
      {/* Offline Alert */}
      {!isOnline && (
        <div className="fixed top-0 left-0 right-0 z-[10000] animate-in slide-in-from-top duration-500">
          <div className="bg-amber-600/90 backdrop-blur-md text-white py-2 px-4 shadow-lg border-b border-amber-400/20 flex items-center justify-center gap-3">
             <WifiOff size={16} className="animate-pulse" />
             <span className="text-xs font-black uppercase tracking-widest">
                Offline Mode <span className="opacity-60 font-normal normal-case ml-1">— Viewing cached version</span>
             </span>
          </div>
        </div>
      )}

      {/* Back Online Alert */}
      {showBackOnline && (
        <div className="fixed top-0 left-0 right-0 z-[10000] animate-in slide-in-from-top fade-out-to-top fill-mode-forwards duration-500 delay-[2500ms]">
          <div className="bg-emerald-600/90 backdrop-blur-md text-white py-2 px-4 shadow-lg border-b border-emerald-400/20 flex items-center justify-center gap-3">
             <Wifi size={16} />
             <span className="text-xs font-black uppercase tracking-widest">
                Back Online <span className="opacity-60 font-normal normal-case ml-1">— Updating Latest Data...</span>
             </span>
          </div>
        </div>
      )}
    </>
  )
}
