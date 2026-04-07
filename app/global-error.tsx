'use client'
 
import React, { useEffect } from 'react'
import { AlertTriangle, RefreshCw } from 'lucide-react'
 
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log error to an observability service
    console.error('GLOBAL_ERROR:', error)

    // Automatic recovery for ChunkLoadError
    const isChunkError = 
      error.message?.includes('ChunkLoadError') || 
      error.message?.includes('Loading chunk') ||
      error.message?.includes('Failed to fetch') ||
      error.message?.includes('Unexpected token \'<\'')

    if (isChunkError) {
      const storageKey = 'chitvault_chunk_reload_count'
      const reloadData = JSON.parse(sessionStorage.getItem(storageKey) || '{"count":0, "last":0}')
      const now = Date.now()

      if (now - reloadData.last > 60000) reloadData.count = 0

      if (reloadData.count < 3) {
        reloadData.count++
        reloadData.last = now
        sessionStorage.setItem(storageKey, JSON.stringify(reloadData))
        console.warn(`System: Global Recovery Attempt ${reloadData.count}...`)
        window.location.reload()
      }
    }
  }, [error])
 
  return (
    <html lang="en">
      <body className="min-h-screen flex items-center justify-center p-6 bg-[#0a0a0b] text-white">
        <div className="max-w-md w-full text-center space-y-8">
           <div className="relative inline-block">
              <div className="w-20 h-20 rounded-2xl bg-danger-500/10 flex items-center justify-center text-danger-500 border border-danger-500/20 mx-auto animate-bounce">
                <AlertTriangle size={40} />
              </div>
           </div>
           
           <div className="space-y-4">
              <h1 className="text-3xl font-black tracking-tight">System Fault</h1>
              <p className="text-sm opacity-50 leading-relaxed">
                A critical error occurred in the application root. Our audit layer has been notified.
              </p>
           </div>
 
           <div className="p-4 rounded-xl bg-white/5 border border-white/10 font-mono text-[10px] break-all opacity-40">
             {error.message || 'Unknown Root Failure'}
           </div>
 
           <button
             onClick={() => reset()}
             className="flex items-center justify-center gap-2 w-full py-4 rounded-2xl bg-white text-black font-bold hover:bg-white/90 active:scale-[0.98] transition-all"
           >
             <RefreshCw size={18} />
             Attempt System Recovery
           </button>
        </div>
      </body>
    </html>
  )
}
