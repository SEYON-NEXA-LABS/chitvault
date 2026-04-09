'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { APP_BRAND, APP_DEVELOPER, APP_NAME, APP_VERSION, APP_COMMIT_ID, cn } from '@/lib/utils/index'
import {
  LayoutDashboard, Users, UsersRound, Gavel, Crown,
  CreditCard, BarChart3, ClipboardList, Settings,
  LogOut, Sun, Moon, Menu, Building2, UserCog, BookOpen, Palette, Calculator, HelpCircle, Languages, Download, Lock, Monitor,
  ShieldAlert, Phone, MapPin, Search, AlertTriangle, Archive, Compass
} from 'lucide-react'
import { CommandPalette, TourProvider, useTour, NetworkStatus, BottomNav } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
import { usePinLock } from '@/lib/lock/context'
import { usePwa } from '@/lib/pwa/context'
import type { Firm, Profile, UserRole } from '@/types'

// ── Helpers ──────────────────────────────────────────────────────────────────
function TourTrigger() {
  const { startCurrentPageTour, hasTourForPage, isActive } = useTour()
  if (!hasTourForPage || isActive) return null

  return (
    <button 
      onClick={startCurrentPageTour}
      className="group flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface2)] border border-[var(--border)] hover:border-[var(--accent)] transition-all"
    >
      <Compass size={14} className="text-[var(--accent)] group-hover:rotate-45 transition-transform" />
      <span className="text-[10px] font-black uppercase tracking-widest opacity-60 group-hover:opacity-100 transition-opacity">Explore Page</span>
    </button>
  )
}

interface NavItem {
  href?: string
  label: string
  icon?: any
  divider?: boolean
  ownerOnly?: boolean
  superAdminOnly?: boolean
}

const NAV: NavItem[] = [
  { href: '/dashboard', label: 'nav_dashboard', icon: LayoutDashboard },
  { href: '/groups', label: 'nav_groups', icon: UsersRound },
  { href: '/members', label: 'nav_members', icon: Users },
  { label: 'nav_transactions', divider: true },
  { href: '/auctions', label: 'nav_auctions', icon: Gavel },
  { href: '/payments', label: 'nav_payments', icon: CreditCard },
  { label: 'nav_reports_group', divider: true },
  { href: '/reports', label: 'nav_reports', icon: BarChart3 },
  { href: '/cashbook', label: 'nav_cashbook', icon: BookOpen },
  { href: '/collection', label: 'nav_collection', icon: ClipboardList },
  { href: '/defaulters', label: 'nav_defaulters', icon: ShieldAlert },
  { href: '/settlement', label: 'nav_settlements', icon: Calculator },
  { label: 'nav_manage', divider: true },
  { href: '/team', label: 'nav_team', icon: UserCog },
  { href: '/trash', label: 'nav_trash', icon: Archive, ownerOnly: true },
  { href: '/admin/branding', label: 'Firm Identity', icon: Palette, ownerOnly: true },
  { href: '/settings', label: 'nav_settings', icon: Settings },
  { label: 'nav_help', divider: true },
  { href: '/walkthrough', label: 'nav_journey', icon: BookOpen },
  { href: '/schemes', label: 'nav_schemes', icon: HelpCircle },
  { href: '/superadmin', label: 'Control Plane', icon: Crown, superAdminOnly: true },
  { href: '/superadmin/onboard', label: 'Onboard Firm', icon: Building2, superAdminOnly: true },
]

const planColor: Record<string, string> = {
  trial: '#5b8af5', basic: '#2563eb', pro: '#3ecf8e'
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = createClient()
  const { role, firm } = useFirm()
  const isOwner = role === 'owner' || role === 'superadmin'
  const { lang, setLang, t } = useI18n()
  const { isLocked, lock, hasPin, isElectron } = usePinLock()
  const { install, isInstallable } = usePwa()
  const { switchedFirmId, setSwitchedFirmId } = useFirm()
  const [firms, setFirms] = useState<Firm[]>([])

  const [userEmail, setUserEmail] = useState('')
  const [theme, setTheme] = useState<'light' | 'dark' | 'system' | 'monochrome'>('light')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [monochrome, setMonochrome] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => setUserEmail(res.data.user?.email || ''))
    const savedTheme = (localStorage.getItem('theme') || 'light') as 'light' | 'dark' | 'system' | 'monochrome'
    setTheme(savedTheme as any)

    const apply = (t: string) => {
      document.documentElement.setAttribute('data-theme', t)
    }

    apply(savedTheme)

    // Listen for system changes if mode is system
    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const listener = () => {
      if (localStorage.getItem('theme') === 'system') apply('system')
    }
    media.addEventListener('change', listener)

    const savedSize = parseInt(localStorage.getItem('fontSize') || '16')
    setFontSize(savedSize)
    document.documentElement.style.setProperty('--font-size-base', `${savedSize}px`)

    const savedMono = localStorage.getItem('monochrome') === 'true'
    setMonochrome(savedMono)
    document.documentElement.classList.toggle('grayscale-mode', savedMono)

    if (role === 'superadmin') {
      supabase.from('firms').select('*').order('name').then((res: { data: Firm[] | null }) => setFirms(res.data || []))
    }

    if (firm?.name) {
      document.title = `${firm.name} | ${APP_BRAND} ${APP_NAME}`
    } else {
      document.title = (switchedFirmId === 'all') ? `Platform Admin | ${APP_BRAND}` : `${APP_BRAND} ${APP_NAME}`
    }
    return () => {
      media.removeEventListener('change', listener)
    }
  }, [firm, supabase, role, switchedFirmId])

  // Suspended check
  if (firm?.plan_status === 'suspended') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⏸️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--danger)', marginBottom: 10 }}>Account Suspended</h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 20 }}>
            {firm.name}&apos;s account has been suspended. Contact us to renew.
          </p>
          <a href="mailto:seyonnexalabs@gmail.com" style={{ color: 'var(--accent)', fontSize: 14 }}>seyonnexalabs@gmail.com</a>
          <br />
          <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
            style={{ marginTop: 16, background: 'var(--surface2)', border: '1px solid var(--border)', color: 'var(--text2)', borderRadius: 8, padding: '8px 18px', cursor: 'pointer', fontSize: 13 }}>
            Sign Out
          </button>
        </div>
      </div>
    )
  }

  function toggleTheme() {
    const modes = ['light', 'dark', 'system', 'monochrome'] as const
    const next = modes[(modes.indexOf(theme as any) + 1) % modes.length]
    setTheme(next)
    localStorage.setItem('theme', next)
    document.documentElement.setAttribute('data-theme', next)
  }

  function adjustFont(delta: number) {
    const next = Math.min(20, Math.max(12, fontSize + delta))
    setFontSize(next)
    localStorage.setItem('fontSize', String(next))
    document.documentElement.style.setProperty('--font-size-base', `${next}px`)
  }

  function toggleMono() {
    const next = !monochrome
    setMonochrome(next)
    localStorage.setItem('monochrome', String(next))
    document.documentElement.classList.toggle('grayscale-mode', next)
  }

  const trialDaysLeft = firm?.trial_ends
    ? Math.max(0, Math.ceil((new Date(firm.trial_ends).getTime() - Date.now()) / 86400000))
    : null

  return (
    <TourProvider>
      <NetworkStatus />
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <aside className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-60 flex flex-col transition-transform duration-300 border-r no-print',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )} style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: 'var(--border)' }}>
            <Link href="/dashboard" className="flex items-center gap-3 group">
              <Image src="/icons/icon-512.png" alt={APP_NAME} width={42} height={42} className="w-[42px] h-[42px] object-contain transition-transform group-hover:scale-110 duration-500" />
              <span className="font-bold tracking-tight uppercase" style={{ color: 'var(--text)' }}>{APP_NAME}</span>
            </Link>
          </div>
          
          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-1">
            {NAV.map((item, i) => {
              if (item.divider) {
                return (
                  <div key={i} className="pt-6 pb-2 px-3">
                    <div className="text-[10px] font-black uppercase tracking-[0.2em] opacity-30 select-none">
                      {t(item.label)}
                    </div>
                  </div>
                )
              }
              if (item.ownerOnly && !isOwner) return null
              if (item.superAdminOnly && role !== 'superadmin') return null
              
              const Icon = item.icon
              const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href!))
              
              return (
                <Link
                  key={i}
                  href={item.href!}
                  className={cn(
                    'flex items-center gap-3 px-3 py-2.5 rounded-xl text-[13px] font-medium transition-all',
                    active 
                      ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-dim)]' 
                      : 'text-[var(--text2)] hover:bg-[var(--surface2)]'
                  )}
                  onClick={() => setSidebarOpen(false)}
                >
                  <Icon size={18} />
                  {t(item.label)}
                </Link>
              )
            })}
          </nav>

          <div className="p-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-2">
              <button 
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-[var(--surface2)] text-[var(--text2)]"
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => adjustFont(-1)} className="p-1 text-xs opacity-50 hover:opacity-100">A-</button>
                <button onClick={() => adjustFont(1)} className="p-1 text-base opacity-50 hover:opacity-100">A+</button>
              </div>
              <button 
                onClick={toggleMono}
                className={cn('p-2 rounded-lg hover:bg-[var(--surface2)]', monochrome ? 'text-[var(--accent)]' : 'text-[var(--text2)]')}
              >
                <Palette size={18} />
              </button>
            </div>
            
            <div className="p-3 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-[var(--surface3)] text-[var(--text2)]">
                  <UserCog size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-bold truncate" style={{ color: 'var(--text)' }}>{userEmail}</p>
                  <div className="flex items-center justify-between mt-0.5">
                    <p className="text-[10px] opacity-60 uppercase font-black">{role}</p>
                    <p className="text-[9px] opacity-30 font-mono">v{APP_VERSION} ({APP_COMMIT_ID})</p>
                  </div>
                </div>
              </div>
              <button 
                onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
                className="w-full py-2 rounded-xl bg-[var(--danger-dim)] text-[var(--danger)] text-xs font-bold hover:opacity-80 transition-opacity"
              >
                {t('sign_out')}
              </button>

              {isInstallable && (
                <button 
                  onClick={install}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] text-xs font-bold border border-[var(--accent-border)] hover:bg-[var(--accent)] hover:text-white transition-all shadow-sm"
                >
                  <Download size={14} />
                  Install App
                </button>
              )}
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col lg:ml-60">
          <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 border-b no-print"
            style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
            <div className="flex items-center gap-3">
              <button className="lg:hidden" onClick={() => setSidebarOpen(true)}
                style={{ color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer' }}>
                <Menu size={20} />
              </button>
              <h1 className="text-sm font-bold tracking-tight text-[var(--text2)] uppercase">
                {t(NAV.find(n => n.href === pathname)?.label || '') || firm?.name || APP_NAME}
              </h1>
            </div>
            <div className="flex items-center gap-4">
              {isInstallable && (
                <button 
                  onClick={install}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-border)] text-xs font-bold transition-all hover:bg-[var(--accent)] hover:text-white lg:hidden"
                >
                  <Download size={14} />
                  Install
                </button>
              )}
              {hasPin ? (
                <button 
                  onClick={lock}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-[var(--surface2)] text-[var(--text2)] border border-[var(--border)] text-xs font-bold transition-all hover:bg-[var(--accent)] hover:text-white"
                  title="Lock Vault"
                >
                  <Lock size={14} />
                  <span className="hidden sm:inline">Lock</span>
                </button>
              ) : (
                <Link 
                  href="/settings#lock-config"
                  className="flex items-center gap-2 px-3 py-1.5 rounded-xl bg-orange-500/10 text-orange-500 border border-orange-500/20 text-xs font-bold transition-all hover:bg-orange-500 hover:text-white shadow-sm"
                  title="Secure Your Vault"
                >
                  <ShieldAlert size={14} />
                  <span className="hidden sm:inline">Set Lock</span>
                </Link>
              )}
              <TourTrigger />
              {firm?.plan === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 10 && (
                <div className="hidden sm:block text-xs px-3 py-1 rounded-full font-medium"
                  style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                  ⚠ Trial: {trialDaysLeft}d left
                </div>
              )}
            </div>
          </header>
          <main className="flex-1 p-5 overflow-auto pb-24 lg:pb-5">{children}</main>
          <BottomNav onMenuClick={() => setSidebarOpen(true)} />
          <CommandPalette />
        </div>
      </div>
    </TourProvider>
  )
}
