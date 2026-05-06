'use client'

import React, { useState, useEffect, useCallback } from 'react'
import { Lock, Delete, ArrowRight, ShieldCheck, AlertCircle } from 'lucide-react'
import { cn } from '@/lib/utils'
import { usePinLock } from '@/lib/lock/context'
import { useFirm } from '@/lib/firm/context'
import Image from 'next/image'

interface PinOverlayProps {
  onUnlock: (pin: string) => boolean
}

export function PinOverlay({ onUnlock }: PinOverlayProps) {
  const [pin, setPin] = useState('')
  const [error, setError] = useState(false)
  const [resetting, setResetting] = useState(false)
  const { clearLock } = usePinLock()
  const { email } = useFirm()

  const maskedEmail = React.useMemo(() => {
    if (!email) return '...'
    const [user, domain] = email.split('@')
    if (!domain) return user.slice(0, 3) + '***'
    if (user.length <= 2) return `${user[0]}*@${domain}`
    return `${user[0]}${'*'.repeat(Math.min(user.length - 2, 8))}${user[user.length - 1]}@${domain}`
  }, [email])

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
    <div className="fixed inset-0 z-[9999] flex items-center justify-center bg-slate-950/40 backdrop-blur-3xl overflow-hidden selection:bg-[var(--accent)] selection:text-white transition-all duration-700 animate-in fade-in">
      
      {/* Background Decor */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] bg-[var(--accent)]/10 rounded-full blur-[120px] pointer-events-none" />

      {/* Visual Context */}
      <div className="absolute top-10 left-10 hidden lg:flex items-center gap-3">
        <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur-xl border border-white/20 flex items-center justify-center overflow-hidden">
          <Image src="/icons/icon-512.png" alt="Logo" width={32} height={32} className="object-cover opacity-80" />
        </div>
        <span className="text-xl font-black tracking-tighter text-white/80 uppercase italic">ChitVault</span>
      </div>

      <div id="pin-card" className={cn(
        "w-full max-w-[380px] p-12 rounded-[3.5rem] bg-white/[0.03] backdrop-blur-2xl border border-white/10 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.5)] flex flex-col items-center relative transition-all duration-500 animate-in zoom-in-95 slide-in-from-bottom-8",
        error ? "border-red-500/40 shadow-[0_0_80px_rgba(239,68,68,0.15)]" : ""
      )}>
        
        {/* Shimmering Lock Icon */}
        <div className="relative group mb-10">
          <div className="absolute inset-0 bg-[var(--accent)]/20 rounded-full blur-2xl group-hover:bg-[var(--accent)]/30 transition-all duration-500" />
          <div className="relative w-20 h-20 rounded-[2rem] bg-white/[0.05] border border-white/10 flex items-center justify-center shadow-xl">
            <Lock className={cn("transition-all duration-500", error ? "text-red-400 scale-110" : "text-[var(--accent)]")} size={36} strokeWidth={2.5} />
          </div>
        </div>

        <div className="text-center mb-10">
          <h2 className="text-3xl font-black text-white mb-2 tracking-tight">Security Access</h2>
          <div className="flex flex-col items-center gap-2">
            <p className="text-[10px] font-black uppercase tracking-[0.4em] text-white/30">Verify Vault PIN</p>
            <div className="px-4 py-1.5 rounded-full bg-white/[0.05] border border-white/10 text-[11px] font-bold text-white/60">
              {maskedEmail}
            </div>
          </div>
        </div>

        {/* Dynamic 4-Digit Indicators */}
        <div className="flex gap-6 mb-14">
          {[1, 2, 3, 4].map((i) => (
            <div key={i} 
              className={cn(
                "w-3.5 h-3.5 rounded-full border-2 transition-all duration-500",
                pin.length >= i 
                  ? "bg-[var(--accent)] border-[var(--accent)] scale-125 shadow-[0_0_25px_var(--accent)]" 
                  : "bg-white/5 border-white/10"
              )}
            />
          ))}
        </div>

        {/* Premium Tactile Keypad */}
        <div className="grid grid-cols-3 gap-6 w-full mb-10">
          {[1, 2, 3, 4, 5, 6, 7, 8, 9].map((num) => (
            <button
              key={num}
              className="w-full aspect-square text-3xl font-black rounded-3xl bg-white/[0.03] text-white/90 hover:bg-white/[0.08] hover:scale-105 active:scale-90 transition-all border border-white/5 shadow-lg flex items-center justify-center"
              onClick={() => handleKey(num.toString())}
            >
              {num}
            </button>
          ))}
          <button
            className="w-full aspect-square text-white/40 hover:text-red-400 hover:bg-red-400/10 active:scale-90 transition-all flex items-center justify-center rounded-3xl"
            onClick={handleBackspace}
          >
            <Delete size={32} />
          </button>
          <button
            className="w-full aspect-square text-3xl font-black rounded-3xl bg-white/[0.03] text-white/90 hover:bg-white/[0.08] hover:scale-105 active:scale-90 transition-all border border-white/5 shadow-lg flex items-center justify-center"
            onClick={() => handleKey('0')}
          >
            0
          </button>
          <div className="w-full aspect-square flex items-center justify-center opacity-20">
             <ShieldCheck size={36} className="text-white" />
          </div>
        </div>

        <p className="text-[10px] font-black uppercase tracking-[0.5em] text-white/20">
          ChitVault Cryptography
        </p>

        {error && (
          <div className="absolute -bottom-16 left-0 right-0 text-center text-red-400 text-[11px] font-black uppercase tracking-[0.2em] animate-bounce">
            Incorrect PIN. Access Denied.
          </div>
        )}

        <div className="absolute -bottom-14 left-0 right-0 text-center">
            <button 
              onClick={async () => {
                if (confirm('For security, this will sign you out and clear local device settings. You will need to log in again to set a new PIN. Continue?')) {
                  setResetting(true)
                  await clearLock()
                }
              }}
              disabled={resetting}
              className="group flex items-center justify-center gap-2 mx-auto text-[10px] font-bold uppercase tracking-widest text-white/30 hover:text-[var(--accent)] transition-all"
            >
              <AlertCircle size={14} className="opacity-40 group-hover:opacity-100" />
              {resetting ? 'Resetting...' : 'Forgot PIN? Reset Vault'}
            </button>
        </div>

        {/* ── Hidden Shadow Form for Password Manager Integration ── */}
        <form 
          className="sr-only" 
          aria-hidden="true"
          onSubmit={(e) => { e.preventDefault(); handleSubmit(); }}
        >
          <input 
            type="text" 
            name="username" 
            autoComplete="username" 
            readOnly 
            value="chitvault-user"
          />
          <input 
            type="password" 
            name="password" 
            autoComplete="current-password" 
            value={pin}
            onChange={(e) => {
              if (e.target.value.length <= 4) setPin(e.target.value)
            }}
          />
          <button type="submit">Unlock</button>
        </form>
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
