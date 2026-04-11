'use client'

import { useEffect, useState } from 'react'
import { RefreshCw, Zap } from 'lucide-react'
import { Btn } from './index'

export function UpdateNotification() {
  const [show, setShow] = useState(false)

  useEffect(() => {
    const handleUpdate = () => {
      setShow(true)
    }

    window.addEventListener('app-update-available', handleUpdate)
    return () => window.removeEventListener('app-update-available', handleUpdate)
  }, [])

  const handleReload = async () => {
    try {
      // 1. Clear all caches
      if ('caches' in window) {
        const names = await caches.keys()
        await Promise.all(names.map(name => caches.delete(name)))
      }
      
      // 2. Unregister all service workers
      if ('serviceWorker' in navigator) {
        const registrations = await navigator.serviceWorker.getRegistrations()
        await Promise.all(registrations.map(reg => reg.unregister()))
      }
    } catch (e) {
      console.error('Manual reload preparation failed', e)
    } finally {
      // 3. Force full reload from server
      window.location.reload()
    }
  }

  if (!show) return null

  return (
    <div className="fixed bottom-6 right-6 z-[20000] animate-in slide-in-from-bottom-10 fade-in duration-500">
      <div className="glass-card p-5 rounded-[2rem] border-2 border-[var(--accent)] shadow-2xl flex items-center gap-6 max-w-sm">
        <div className="w-12 h-12 rounded-full bg-[var(--accent-dim)] flex items-center justify-center text-[var(--accent)] shrink-0">
          <Zap size={24} className="animate-pulse" />
        </div>
        
        <div className="flex-1 min-w-0">
          <h4 className="text-sm font-black text-[var(--text)] uppercase tracking-tight">App Update Available</h4>
          <p className="text-[11px] text-[var(--text2)] leading-relaxed mt-1">
            A new version of ChitVault is ready. Refresh now to get the latest features and optimizations.
          </p>
        </div>

        <button 
          onClick={handleReload}
          className="bg-[var(--accent)] text-white p-3 rounded-full hover:scale-110 active:scale-95 transition-all shadow-lg hover:shadow-[var(--accent-dim)]"
          title="Refresh Now"
        >
          <RefreshCw size={20} />
        </button>
      </div>
    </div>
  )
}
