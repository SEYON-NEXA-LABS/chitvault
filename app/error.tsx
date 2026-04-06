'use client'
 
import React, { useEffect } from 'react'
import { AlertTriangle, RefreshCcw, Home } from 'lucide-react'
import Link from 'next/link'
 
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error
    console.error('APP_ERROR:', error)

    // Automatic recovery for ChunkLoadError
    const isChunkError = 
      error.message?.includes('ChunkLoadError') || 
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch dynamically imported module')

    if (isChunkError) {
      const storageKey = 'chitvault_chunk_reload_count'
      const reloadCount = parseInt(sessionStorage.getItem(storageKey) || '0', 10)

      if (reloadCount < 2) {
        sessionStorage.setItem(storageKey, (reloadCount + 1).toString())
        console.warn(`ChunkLoadError detected. Attempting recovery (Attempt ${reloadCount + 1})...`)
        window.location.reload()
      } else {
        console.error('ChunkLoadError recovery failed after multiple attempts.')
        // We stop reloading to avoid infinite loops and let the user see the error UI
      }
    }
  }, [error])
 
  return (
    <div className="min-h-screen flex items-center justify-center p-6 bg-[var(--bg)]">
      <div className="max-w-md w-full space-y-8 text-center">
        
        {/* Error Visual */}
        <div className="relative inline-block scale-110">
          <div className="w-24 h-24 rounded-3xl bg-[var(--danger-dim)] flex items-center justify-center text-[var(--danger)] border border-[var(--danger-border)] mx-auto relative z-10 shadow-2xl">
            <AlertTriangle size={48} strokeWidth={2.5} />
          </div>
          <div className="absolute inset-0 rounded-3xl bg-[var(--danger)] opacity-20 blur-2xl animate-pulse" />
        </div>
 
        <div className="space-y-3 px-4">
          <h1 className="text-3xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
            Something went wrong
          </h1>
          <p className="text-base opacity-50 leading-relaxed max-w-sm mx-auto font-medium">
            Our audit layer detected an unexpected state. This incident has been logged for review.
          </p>
        </div>
 
        {/* Technical Hint */}
        <div className="p-5 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] font-mono text-[10px] break-all opacity-40 shadow-inner">
           {error.message || 'Fatal Execution Error (ERR_APP_FAULT)'}
        </div>
 
        <div className="grid grid-cols-1 gap-3 px-6">
           <button
             onClick={() => reset()}
             className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-[var(--accent)] text-white font-bold text-sm hover:scale-[1.02] active:scale-[0.98] transition-all shadow-lg shadow-[var(--accent-dim)]"
           >
             <RefreshCcw size={18} />
             Reload Component
           </button>
           <Link
             href="/dashboard"
             className="flex items-center justify-center gap-3 w-full py-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] font-bold text-sm text-[var(--info)] hover:bg-[var(--surface3)] transition-colors"
           >
             <Home size={18} />
             Return to Dashboard
           </Link>
        </div>
 
        <div className="pt-8 opacity-20 text-[9px] font-black uppercase tracking-[0.3em]">
           ChitVault Error Layer • ID: {error.digest || 'ANONYMOUS'}
        </div>
      </div>
    </div>
  )
}
