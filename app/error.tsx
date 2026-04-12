'use client'

import { RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'
import { isVersionMismatch, getAutoRecoveryAction, handleHardReset } from '@/lib/utils/recovery'
import { useState, useEffect } from 'react'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isSyncNeeded = isVersionMismatch(error)
  const [isUpdating, setIsUpdating] = useState(false)
  const [progress, setProgress] = useState(0)

  useEffect(() => {
    const action = getAutoRecoveryAction(error)
    if (action === 'HARD_RESET') {
      handleHardReset()
    } else if (action === 'RELOAD') {
      window.location.reload()
    }
  }, [error])

  const handleUpdate = () => {
    setIsUpdating(true)
    let p = 0
    const interval = setInterval(() => {
      p += Math.random() * 10
      if (p >= 100) {
        setProgress(100)
        clearInterval(interval)
        setTimeout(() => {
          if (isSyncNeeded) handleHardReset()
          else reset()
        }, 500)
      } else {
        setProgress(p)
      }
    }, 150)
  }

  const getStatusMessage = (pct: number) => {
    if (pct < 30) return 'Cleaning data layers...'
    if (pct < 70) return 'Downloading vault manifest...'
    if (pct < 95) return 'Finalizing secure setup...'
    return 'Reconnecting...'
  }

  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)] selection:bg-[var(--accent-dim)]">
      <div className="max-w-md w-full space-y-10 text-center">

        {/* Error Visual */}
        <div className="relative inline-block scale-110">
          <div className="w-24 h-24 rounded-3xl bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] border border-[var(--accent-border)] mx-auto relative z-10 shadow-2xl">
            <RefreshCcw size={48} strokeWidth={2.5} className="animate-spin-slow" />
          </div>
          <div className="absolute inset-0 rounded-3xl bg-[var(--accent)] opacity-10 blur-2xl animate-pulse" />
        </div>

        <div className="space-y-4 px-4">
          <h1 className="text-4xl font-black tracking-tighter italic" style={{ color: 'var(--text)' }}>
            Refresh Required
          </h1>
          <p className="text-sm opacity-50 leading-relaxed max-w-sm mx-auto font-medium">
            We&apos;re syncing your vault with the latest optimizations. Just a quick refresh and you&apos;ll be back in.
          </p>
        </div>

        {/* Technical Hint */}
        <div className="p-5 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] font-mono text-[10px] break-all opacity-30 shadow-inner">
          {error.message || 'Syncing secure audit layers...'}
        </div>

        <div className="grid grid-cols-1 gap-6 px-6">
          {isUpdating ? (
            <div className="space-y-4 animate-in fade-in duration-500">
              <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                <span>{getStatusMessage(progress)}</span>
                <span className="font-mono text-xs">{Math.round(progress)}%</span>
              </div>
              <div className="h-1.5 w-full bg-[var(--surface2)] rounded-full overflow-hidden border border-[var(--border)]">
                <div 
                  className="h-full bg-[var(--accent)] transition-all duration-300 ease-out shadow-[0_0_15px_var(--accent-dim)]"
                  style={{ width: `${progress}%` }}
                />
              </div>
            </div>
          ) : (
            <button
              onClick={handleUpdate}
              className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-[var(--accent)] text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-[0_10px_20px_-5px_var(--accent-dim)]"
            >
              <RefreshCcw size={18} />
              {isSyncNeeded ? 'Switch to Latest Version' : 'Sync & Resume Now'}
            </button>
          )}
          
          <Link
            href="/dashboard"
            className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] font-bold text-xs uppercase tracking-widest text-[var(--text2)] hover:bg-[var(--surface3)] transition-colors"
          >
            <Home size={14} />
            Back to Vault
          </Link>
        </div>

        <div className="pt-8 opacity-20 text-[9px] font-black uppercase tracking-[0.3em]">
          ChitVault Error Layer • ID: {error.digest || 'ANONYMOUS'}
        </div>
      </div>
    </div>
  )
}
