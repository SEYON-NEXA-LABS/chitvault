'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { APP_BRAND, APP_DEVELOPER, APP_NAME, cn } from '@/lib/utils/index'
import {
  LayoutDashboard, Users, UsersRound, Gavel,
  CreditCard, BarChart3, ClipboardList, Settings,
  LogOut, Sun, Moon, Menu, Building2, UserCog, BookOpen, Palette, Calculator, HelpCircle, Languages, Download, Lock, Monitor,
  ShieldAlert, Phone, MapPin, Search, AlertTriangle, Archive
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { usePinLock } from '@/lib/lock/context'
import { usePwa } from '@/lib/pwa/context'
import type { Firm, Profile, UserRole } from '@/types'

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
  { href: '/settings', label: 'nav_settings', icon: Settings },
  { label: 'nav_help', divider: true },
  { href: '/walkthrough', label: 'nav_journey', icon: BookOpen },
  { href: '/schemes', label: 'nav_help', icon: HelpCircle },
  { href: '/admin', label: 'Platform Admin', icon: Settings, superAdminOnly: true },
  { href: '/admin?create=true', label: 'Register Firm', icon: Building2, superAdminOnly: true },
  { href: '/admin/branding', label: 'Branding', icon: Palette, superAdminOnly: true },
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
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={cn(
        'fixed top-0 left-0 bottom-0 z-50 w-60 flex flex-col transition-transform duration-300 border-r no-print',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )} style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

        {/* Firm header */}
        <div className="px-4 py-4 border-b space-y-3" style={{ borderColor: 'var(--border)' }}>
          {/* Superadmin Firm Switcher */}
          {role === 'superadmin' && (
            <div className="space-y-1.5">
              <label className="text-[9px] font-black uppercase tracking-[0.2em] opacity-40 px-1">Active Workspace</label>
              <select
                value={switchedFirmId}
                onChange={(e) => setSwitchedFirmId(e.target.value as any)}
                className="w-full bg-[var(--surface2)] border border-[var(--border)] rounded-lg px-2 py-1.5 text-xs font-bold transition-all focus:ring-1 focus:ring-[var(--accent)] outline-none"
                style={{ color: switchedFirmId === 'all' ? 'var(--text)' : 'var(--accent)' }}
              >
                <option value="all">🌐 Platform Overview</option>
                <optgroup label="Manage Firms">
                  {firms.map(f => (
                    <option key={f.id} value={f.id}>🏢 {f.name}</option>
                  ))}
                </optgroup>
              </select>
            </div>
          )}

          <Link href="/dashboard" className="flex items-center gap-3.5 mb-2 group">
            <div className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0 overflow-hidden bg-[var(--surface2)] border border-[var(--border)] group-hover:border-[var(--accent-border)] transition-all">
              <img src="/icons/icon-192.png" alt="Logo" className="w-full h-full object-cover transition-all opacity-90 group-hover:opacity-100" />
            </div>
            <div className="flex flex-col truncate">
              <div className="font-extrabold text-base tracking-tight leading-tight group-hover:text-[var(--accent)] transition-colors">
                {firm?.name || (switchedFirmId === 'all' ? APP_NAME : APP_NAME)}
              </div>
            </div>
          </Link>

          <div className="flex items-center gap-2">
            {role === 'superadmin' && switchedFirmId === 'all' ? (
              <span className="text-[10px] px-2 py-0.5 rounded-md font-bold bg-[var(--accent-dim)] text-[var(--accent)] border border-[var(--accent-border)] uppercase tracking-wider">
                GLOBAL
              </span>
            ) : (
              firm && (
                <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider border"
                  style={{ background: planColor[firm.plan] + '11', color: planColor[firm.plan], borderColor: planColor[firm.plan] + '44' }}>
                  {firm.plan}
                </span>
              )
            )}
            <span className="text-[10px] px-2 py-0.5 rounded-md font-bold uppercase tracking-wider bg-[var(--surface2)] border border-[var(--border)] text-[var(--text2)]">
              {role === 'superadmin' ? 'Superadmin' : (isOwner ? 'Manager' : 'Staff')}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV.map((item, i) => {
            // Dividers
            if ('divider' in item && item.divider) {
              return (
                <div key={i} className="text-xs uppercase tracking-widest px-2 pt-4 pb-1" style={{ color: 'var(--text3)' }}>{t(item.label)}</div>
              )
            }

            if (!('href' in item)) return null

            const isSuper = role === 'superadmin'

            // Visibility Logic
            if (item.superAdminOnly && !isSuper) return null // Hide superadmin-only from others
            if (item.ownerOnly && !isOwner && !isSuper) return null // Hide owner-only from staff (unless superadmin)

            // Note: Superadmin sees everything, so we don't return null for them here
            const Icon = item.icon!
            const href = item.href as string;
            const active = pathname === href || (href !== '/dashboard' && pathname.startsWith(href))
            return (
              <Link key={href} href={href} onClick={() => setSidebarOpen(false)}
                className={cn(
                  "group flex items-center gap-3.5 px-4 py-2.5 rounded-[12px] mb-1.5 text-sm font-semibold transition-all relative overflow-hidden",
                  active
                    ? "bg-[var(--accent)] text-white shadow-[0_4px_12px_rgba(var(--accent-rgb),0.25)]"
                    : "text-[var(--text2)] hover:bg-[var(--surface3)] hover:text-[var(--text)]"
                )}>
                <Icon size={18} className={cn("transition-transform duration-300", active ? "scale-110" : "opacity-70 group-hover:opacity-100 group-hover:scale-110")} />
                <span className="relative z-10 flex-1">{t(item.label)}</span>
                {active && (
                  <span className="w-1.5 h-1.5 rounded-full bg-white opacity-80" />
                )}
              </Link>
            )
          })}
        </nav>

        {isInstallable && (
          <div className="px-3 pb-3">
            <button onClick={install}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: 'var(--accent)', color: 'white', boxShadow: '0 4px 12px var(--accent-border)' }}>
              <Download size={15} />
              Install App
            </button>
          </div>
        )}

        {hasPin && (
          <div className="px-3 pb-3">
            <button onClick={lock}
              title="Lock Session"
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: 'var(--success)', color: 'white', boxShadow: '0 4px 12px var(--success-dim)' }}>
              <Lock size={14} />
              Lock Session
            </button>
          </div>
        )}

        <div className="mt-auto border-t p-4 space-y-4" style={{ borderColor: 'var(--border)' }}>
          {/* Customization Quick Tools (Moved from Header) */}
          <div className="flex items-center justify-between gap-1 p-1 rounded-xl bg-[var(--surface2)] border" style={{ borderColor: 'var(--border)' }}>
            {/* Theme Cycle */}
            <button onClick={toggleTheme} className="p-1.5 rounded-lg hover:bg-[var(--surface3)] transition-colors"
              style={{ color: theme === 'system' ? 'var(--accent)' : 'var(--text2)' }}
              title={`Theme: ${theme.toUpperCase()}`}>
              {theme === 'light' && <Sun size={14} />}
              {theme === 'dark' && <Moon size={14} />}
              {theme === 'system' && <Monitor size={14} />}
            </button>

            <div className="w-[1px] h-4 bg-[var(--border)]" />

            {/* Language Switch */}
            <button onClick={() => setLang(lang === 'en' ? 'ta' : 'en')} title="Switch Language"
              className="px-2 py-1 rounded-lg hover:bg-[var(--surface3)] transition-colors text-[10px] font-bold"
              style={{ color: 'var(--accent)' }}>
              {lang === 'en' ? 'தமிழ்' : 'EN'}
            </button>

            <div className="w-[1px] h-4 bg-[var(--border)]" />

            {/* Font Size */}
            <div className="flex items-center">
              <button onClick={() => adjustFont(-1)} title="Smaller font" className="w-6 h-6 flex items-center justify-center text-[10px] font-bold hover:bg-[var(--surface3)] rounded-lg" style={{ color: 'var(--text2)' }}>A-</button>
              <button onClick={() => adjustFont(1)} title="Larger font" className="w-6 h-6 flex items-center justify-center text-[12px] font-bold hover:bg-[var(--surface3)] rounded-lg" style={{ color: 'var(--text2)' }}>A+</button>
            </div>

            <div className="w-[1px] h-4 bg-[var(--border)]" />

            {/* Monochrome */}
            <button onClick={toggleMono} title="Monochrome Mode"
              className="p-1.5 rounded-lg hover:bg-[var(--surface3)] transition-colors"
              style={{ color: monochrome ? 'var(--accent)' : 'var(--text3)' }}>
              <Palette size={14} />
            </button>
          </div>

          <div className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-[var(--surface2)] group relative border"
            style={{ borderColor: 'rgba(0,0,0,0)', background: 'transparent' }}>
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0"
              style={{ background: 'var(--accent-dim)', color: 'var(--accent)', border: '1px solid var(--accent-border)' }}>
              {userEmail ? userEmail.substring(0, 2).toUpperCase() : '??'}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-[12px] font-bold uppercase tracking-wider opacity-40 mb-0.5">{role === 'superadmin' ? 'Platform' : (isOwner ? 'Manager' : 'Staff')}</div>
              <div className="text-[12px] font-bold uppercase truncate" style={{ color: 'var(--text)' }}>
                {userEmail}
              </div>
            </div>
            <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-all">
              <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
                title={t('sign_out')}
                className="p-1.5 rounded-lg hover:bg-[var(--danger-dim)] hover:text-[var(--danger)] shrink-0"
                style={{ color: 'var(--text3)' }}>
                <LogOut size={14} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between px-2">
            <div className="text-[10px] font-bold tracking-[0.2em] opacity-40 uppercase">
              {APP_NAME} v{process.env.NEXT_PUBLIC_APP_VERSION}
            </div>
          </div>
          <div className="mt-2 px-2">
            <div className="text-[9px] font-black opacity-40 uppercase tracking-widest">
              Powered by {APP_DEVELOPER}
            </div>
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
          <div className="flex items-center gap-2">
            {firm?.plan === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 10 && (
              <div className="hidden sm:block text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: 'var(--danger-dim)', color: 'var(--danger)' }}>
                ⚠ Trial: {trialDaysLeft}d left
              </div>
            )}
            {/* Options toolstrip moved to sidebar footer */}
          </div>
        </header>
        <main className="flex-1 p-5 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
