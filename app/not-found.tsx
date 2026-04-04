'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { AlertCircle, ChevronLeft, Home, Search, LifeBuoy } from 'lucide-react'
import { cn } from '@/lib/utils'

export default function NotFound() {
  const pathname = usePathname()

  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}>

      {/* Decorative Orbs */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full opacity-20 blur-[120px] animate-pulse"
        style={{ background: 'var(--accent)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full opacity-10 blur-[120px]"
        style={{ background: 'var(--danger)' }} />

      <div className="relative z-10 w-full max-w-2xl text-center">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[40px] shadow-2xl overflow-hidden backdrop-blur-xl">
          <div className="p-8 md:p-16 space-y-8">

            {/* Visual Header */}
            <div className="relative inline-block scale-110 mb-2">
              <div className="w-24 h-24 rounded-3xl bg-[var(--danger-dim)] flex items-center justify-center text-[var(--danger)] mb-6 mx-auto relative z-10 border border-[var(--danger-border)]">
                <AlertCircle size={48} strokeWidth={2.5} />
              </div>
              <div className="absolute inset-0 rounded-3xl bg-[var(--danger)] opacity-20 blur-2xl animate-pulse" />
            </div>

            <div className="space-y-3">
              <h1 className="text-4xl md:text-5xl font-black tracking-tight" style={{ color: 'var(--text)' }}>
                404 <span className="opacity-30">/</span> Page Not Found
              </h1>
              <p className="text-base md:text-lg font-medium opacity-50 max-w-md mx-auto leading-relaxed">
                The page you are looking for does not exist or has been moved to a new workspace.
              </p>
            </div>

            {/* Path Diagnostic */}
            <div className="inline-flex items-center gap-3 px-5 py-3 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] text-xs font-mono opacity-80 shadow-inner">
              <Search size={14} className="opacity-40" />
              <span className="opacity-40">Failed Path:</span>
              <span className="font-bold text-[var(--danger)] break-all">{pathname}</span>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-6">
              <Link href="/dashboard"
                className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-[var(--accent)] text-white font-bold text-sm transition-all hover:scale-[1.02] hover:shadow-xl active:scale-[0.98]">
                <Home size={18} />
                Back to Dashboard
              </Link>
              <Link href="/schemes"
                className="flex items-center justify-center gap-3 px-8 py-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] font-bold text-sm transition-all hover:bg-[var(--surface3)]"
                style={{ color: 'var(--text)' }}>
                <LifeBuoy size={18} className="opacity-50" />
                Help & Support
              </Link>
            </div>

            <div className="mt-8 pt-8 flex flex-col md:flex-row justify-center items-center gap-4 md:gap-8 border-t border-[var(--border)] opacity-30 text-[9px] font-black uppercase tracking-[0.3em]">
              <span className="flex items-center gap-2">
                <div className="w-1 h-1 rounded-full bg-[var(--danger)] animate-pulse" />
                ID: {Math.random().toString(36).substring(7).toUpperCase()}
              </span>
              <span className="hidden md:inline opacity-20">•</span>
              <span>Audit Layer Alpha-9</span>
              <span className="hidden md:inline opacity-20">•</span>
              <span>ChitVault Core v{process.env.NEXT_PUBLIC_APP_VERSION}</span>
            </div>
          </div>
        </div>

        {/* Home Link */}
        <Link href="/" className="mt-8 flex items-center justify-center gap-2 text-sm font-bold opacity-40 hover:opacity-100 transition-opacity" style={{ color: 'var(--text)' }}>
          <ChevronLeft size={16} />
          Return Target
        </Link>
      </div>
    </div>
  )
}
