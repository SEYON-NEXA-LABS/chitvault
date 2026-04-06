'use client'
 
import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  AlertCircle, ChevronLeft, Home, 
  Search, LifeBuoy, Gavel, 
  UsersRound, Settings 
} from 'lucide-react'
 
export default function NotFound() {
  const pathname = usePathname()
 
  const QuickLink = ({ href, icon: Icon, label }: any) => (
    <Link href={href} className="group flex items-center gap-3 p-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] hover:border-[var(--accent-border)] hover:bg-[var(--surface3)] transition-all">
      <div className="w-10 h-10 rounded-xl bg-[var(--surface)] border border-[var(--border)] flex items-center justify-center text-[var(--text2)] group-hover:text-[var(--accent)] group-hover:border-[var(--accent-border)] transition-colors">
        <Icon size={18} />
      </div>
      <span className="text-sm font-bold text-[var(--text2)] group-hover:text-[var(--text)] transition-colors">{label}</span>
      <ChevronLeft size={16} className="ml-auto opacity-0 group-hover:opacity-40 rotate-180 transition-all" />
    </Link>
  )
 
  return (
    <div className="min-h-screen flex items-center justify-center p-6 relative overflow-hidden"
      style={{ background: 'var(--bg)' }}>
 
      {/* Immersive Background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full opacity-20 blur-[120px] animate-pulse"
        style={{ background: 'var(--accent)' }} />
      <div className="absolute bottom-[-10%] right-[-10%] w-[50%] h-[50%] rounded-full opacity-10 blur-[120px]"
        style={{ background: 'var(--danger)' }} />
 
      <div className="relative z-10 w-full max-w-3xl">
        <div className="bg-[var(--surface)] border border-[var(--border)] rounded-[48px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5)] overflow-hidden backdrop-blur-3xl">
          <div className="flex flex-col md:flex-row">
            
            {/* Left: Branding & Message */}
            <div className="flex-1 p-8 md:p-16 border-b md:border-b-0 md:border-r border-[var(--border)] space-y-8">
              <div className="relative inline-block scale-110">
                <div className="w-20 h-20 rounded-[28px] bg-[var(--danger-dim)] flex items-center justify-center text-[var(--danger)] border border-[var(--danger-border)] shadow-xl relative z-10">
                  <AlertCircle size={40} strokeWidth={2.5} />
                </div>
                <div className="absolute inset-0 rounded-[28px] bg-[var(--danger)] opacity-20 blur-2xl animate-pulse" />
              </div>
 
              <div className="space-y-4">
                <h1 className="text-5xl md:text-7xl font-black tracking-tighter leading-none" style={{ color: 'var(--text)' }}>
                  Lost in <br />
                  <span className="text-transparent bg-clip-text bg-gradient-to-r from-[var(--danger)] to-[var(--accent)]">Transit.</span>
                </h1>
                <p className="text-base md:text-lg font-medium opacity-50 max-w-sm leading-relaxed">
                  The resource at <span className="text-[var(--danger)] font-bold">{pathname}</span> could not be audited or found in our active workspace.
                </p>
              </div>
 
              <Link href="/dashboard"
                className="inline-flex items-center justify-center gap-3 px-10 py-5 rounded-[24px] bg-[var(--accent)] text-white font-black text-sm transition-all hover:scale-[1.05] hover:shadow-[0_20px_40px_-12px_var(--accent-dim)] active:scale-[0.98]">
                <Home size={20} />
                Return to Command Center
              </Link>
            </div>
 
            {/* Right: Quick Navigation */}
            <div className="w-full md:w-80 p-8 md:p-12 bg-[var(--surface2)]/30 space-y-6">
               <div className="space-y-1">
                 <h3 className="text-xs font-black uppercase tracking-[0.2em] opacity-40">Quick Audit</h3>
                 <p className="text-[10px] opacity-30">Alternative safe destinations</p>
               </div>
 
               <div className="space-y-3">
                 <QuickLink href="/dashboard" icon={Home} label="Dashboard" />
                 <QuickLink href="/groups" icon={UsersRound} label="Groups" />
                 <QuickLink href="/auctions" icon={Gavel} label="Auctions" />
                 <QuickLink href="/settings" icon={Settings} label="Settings" />
               </div>
 
               <div className="pt-8 space-y-4">
                  <div className="p-4 rounded-2xl bg-[var(--surface)] border border-[var(--border)] shadow-sm">
                     <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-widest text-[var(--accent)] mb-2">
                        <LifeBuoy size={12} /> Need Assistance?
                     </div>
                     <p className="text-[10px] opacity-40 leading-relaxed">
                        If you believe this is a system fault, please contact the audit layer.
                     </p>
                  </div>
                  
                  <div className="flex items-center justify-center gap-6 opacity-20 text-[8px] font-bold uppercase tracking-[0.4em]">
                     <span>ChitVault Core v2.5</span>
                  </div>
               </div>
            </div>
          </div>
        </div>
 
        <div className="mt-8 flex justify-center items-center gap-4 text-xs font-bold opacity-30">
           <span>Error Ref: {Math.random().toString(36).substring(7).toUpperCase()}</span>
           <div className="w-1.5 h-1.5 rounded-full bg-[var(--border)]" />
           <span>Secure Audit Active</span>
        </div>
      </div>
    </div>
  )
}
