'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Lock, Delete, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePinLock } from '@/lib/lock/context'
import Image from 'next/image'

interface PinOverlayProps {
  onUnlock: (pin: string) => boolean
}

export function PinOverlay({ onUnlock }: PinOverlayProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [resetting, setResetting] = useState(false)
  const { clearLock } = usePinLock()

  const handleKey = useCallback((num: string) => {
    if (pin.length >= 4) return
    setError(false)
    setPin(prev => prev + num)
  }, [pin])

  const handleBackspace = useCallback(() => {
    setPin(prev => prev.slice(0, -1))
    setError(false)
  }, [])

  const handleSubmit = useCallback((manualPin?: string) => {
    const target = manualPin || pin
    if (onUnlock(target)) {
      setPin('')
    } else {
      setError(true)
      setPin('')
      // Haptic shake effect (visual)
      const el = document.getElementById('pin-card')
      el?.classList.add('animate-shake')
      setTimeout(() => el?.classList.remove('animate-shake'), 400)
    }
  }, [pin, onUnlock])

  // Auto-submit when 4 digits are entered
  useEffect(() => {
    if (pin.length === 4) {
      const timer = setTimeout(() => {
        handleSubmit()
      }, 150) // Tiny delay for visual feedback of the 4th dot
      return () => clearTimeout(timer)
    }
  }, [pin, handleSubmit])

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key >= '0' && e.key <= '9') {
        handleKey(e.key)
      } else if (e.key === 'Backspace') {
        handleBackspace()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [handleKey, handleBackspace])

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center mesh-gradient overflow-hidden selection:bg-[var(--accent)] selection:text-white">
      
      {/* Visual Context (Matches Login Sidebar Style) */}
      <div className="absolute top-10 left-10 hidden lg:flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/20 backdrop-blur-xl border border-white/30 flex items-center justify-center overflow-hidden">
          <Image src="/icons/icon-512.png" alt="Logo" width={32} height={32} className="object-cover" />
        </div>
        <span className="text-xl font-black tracking-tighter text-white uppercase italic">ChitVault</span>
      </div>

      <div id="pin-card" className={cn(
        "w-full max-w-[340px] p-10 rounded-[40px] glass-card border-white/20 flex flex-col items-center relative transition-all duration-300",
        error ? "border-red-500/50 shadow-[0_0_40px_rgba(239,68,68,0.2)]" : ""
      )}>
        
        <div className="w-20 h-20 rounded-3xl bg-white/10 backdrop-blur-xl flex items-center justify-center mb-8 border border-white/20 shadow-2xl">
          <Lock className={cn("transition-colors duration-300", error ? "text-red-500" : "text-[var(--accent)]")} size={32} />
        </div>

        <h2 className="text-2xl font-black text-white mb-2 tracking-tight">Vault Locked</h2>
        <p className="text-[10px] font-black uppercase tracking-[0.3em] text-white opacity-90 mb-10">Verification Required</p>

        {/* 4-Digit Indicators */}
        <div className="flex gap-5 mb-12">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} 
              className={cn(
                "w-4 h-4 rounded-full border-2 transition-all duration-300",
                pin.length >= i 
                  ? "bg-white border-white scale-125 shadow-[0_0_15px_rgba(255,255,255,0.8)]" 
                  : "bg-transparent border-white/20"
              )}
            />
          ))}
        </div>

        {/* Numeric Keypad */}
        <div className="grid grid-cols-3 gap-6 w-full mb-8">
          {['1', '2', '3', '4', '5', '6', '7', '8', '9'].map((num) => (
            <button key={num} onClick={() => handleKey(num)}
              className="w-full aspect-square rounded-2xl flex items-center justify-center text-2xl font-black text-white hover:bg-white/10 active:scale-90 transition-all border border-transparent hover:border-white/20 bg-white/5">
              {num}
            </button>
          ))}
          <button onClick={handleBackspace}
            className="w-full aspect-square rounded-2xl flex items-center justify-center text-white/40 hover:text-white hover:bg-white/10 active:scale-90 transition-all">
            <Delete size={24} />
          </button>
          <button onClick={() => handleKey('0')}
            className="w-full aspect-square rounded-2xl flex items-center justify-center text-2xl font-black text-white hover:bg-white/10 active:scale-90 transition-all border border-transparent hover:border-white/20 bg-white/5">
            0
          </button>
          <div className="w-full aspect-square flex items-center justify-center">
             <ShieldCheck size={24} className="text-white/20" />
          </div>
        </div>

        <p className="text-[9px] font-black uppercase tracking-widest text-white/30">
          ChitVault &bull; Secure PIN Entry
        </p>

        {error && (
          <div className="absolute -bottom-16 left-0 right-0 text-center text-red-500 text-[10px] font-black uppercase tracking-widest animate-bounce">
            Invalid Entry. Access Denied.
          </div>
        )}

        <div className="absolute -bottom-12 left-0 right-0 text-center">
            <button 
              onClick={async () => {
                if (confirm('For security, this will sign you out and clear local device settings. You will need to log in again to set a new PIN. Continue?')) {
                  setResetting(true)
                  await clearLock()
                }
              }}
              disabled={resetting}
              className="group flex items-center justify-center gap-1.5 mx-auto text-[10px] font-bold uppercase tracking-wider text-white/40 hover:text-white transition-colors"
            >
              <AlertCircle size={12} className="opacity-50 group-hover:opacity-100" />
              {resetting ? 'Resetting...' : 'Forgot PIN? Reset Private Vault'}
            </button>
        </div>
      </div>

      {/* Re-use the shake animation from Global or add local inline */}
      <style jsx>{`
        @keyframes shake {
          0%, 100% { transform: translateX(0); }
          25% { transform: translateX(-8px); }
          75% { transform: translateX(8px); }
        }
        .animate-shake {
          animation: shake 0.2s cubic-bezier(.36,.07,.19,.97) both;
        }
      `}</style>
    </div>
  )
}
