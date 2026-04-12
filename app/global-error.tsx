'use client'
 
import React, { useEffect, useMemo } from 'react'
import { RefreshCw } from 'lucide-react'
import { isVersionMismatch, handleHardReset, getAutoRecoveryAction } from '@/lib/utils/recovery'
 
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  const isSyncNeeded = useMemo(() => isVersionMismatch(error), [error])
  const [isUpdating, setIsUpdating] = React.useState(false)
  const [progress, setProgress] = React.useState(0)

  useEffect(() => {
    // Log for audit but don't alarm the user
    console.error('VAULT_SYNC_REQUIRED:', error)

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
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0b] text-white selection:bg-[#2563eb]/30">
        <div className="max-w-md w-full text-center space-y-10">
           <div className="relative inline-block">
              <div className="w-24 h-24 rounded-3xl bg-[#2563eb]/10 flex items-center justify-center text-[#2563eb] border border-[#2563eb]/20 mx-auto relative z-10">
                <RefreshCw size={44} className="animate-spin-slow" />
              </div>
              <div className="absolute inset-0 rounded-3xl bg-[#2563eb] opacity-20 blur-3xl animate-pulse" />
           </div>
           
           <div className="space-y-4">
              <h1 className="text-4xl font-black tracking-tighter italic">Vault Update in Progress</h1>
              <p className="text-sm opacity-50 leading-relaxed max-w-sm mx-auto font-medium text-balance">
                We&apos;re optimizing your secure vault environment. This usually happens after an update.
              </p>
           </div>

           <div className="p-5 rounded-2xl bg-white/5 border border-white/10 font-mono text-[10px] break-all opacity-30 shadow-inner">
             {error.message || 'Optimizing vault secure layers...'}
           </div>

           <div className="grid grid-cols-1 gap-6 px-4">
              {isUpdating ? (
                <div className="space-y-4 animate-in fade-in duration-500">
                  <div className="flex justify-between items-end text-[10px] font-black uppercase tracking-[0.2em] opacity-40">
                    <span>{getStatusMessage(progress)}</span>
                    <span className="font-mono text-xs">{Math.round(progress)}%</span>
                  </div>
                  <div className="h-1.5 w-full bg-white/5 rounded-full overflow-hidden border border-white/10">
                    <div 
                      className="h-full bg-[#2563eb] transition-all duration-300 ease-out shadow-[0_0_15px_rgba(37,99,235,0.4)]"
                      style={{ width: `${progress}%` }}
                    />
                  </div>
                </div>
              ) : (
                <button
                  onClick={handleUpdate}
                  className="flex items-center justify-center gap-3 w-full py-5 rounded-2xl bg-[#2563eb] text-white font-bold text-sm hover:bg-[#2563eb]/90 active:scale-[0.98] transition-all shadow-xl shadow-[#2563eb]/20"
                >
                  <RefreshCw size={18} />
                  {isSyncNeeded ? 'Switch to Latest Version' : 'Ready to Resume'}
                </button>
              )}

              <div className="p-5 rounded-2xl bg-white/5 border border-white/10 font-mono text-[10px] break-all opacity-30 shadow-inner">
                {error.message || 'Optimizing vault secure layers...'}
              </div>
           </div>
        </div>
      </body>
    </html>
  )
}

