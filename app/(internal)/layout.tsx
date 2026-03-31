'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { APP_BRAND, APP_NAME, cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, UsersRound, Gavel,
  CreditCard, BarChart3, ClipboardList, Settings,
  LogOut, Sun, Moon, Menu, Building2, UserCog, BookOpen, Palette, Calculator, HelpCircle, Languages, Download, Lock
} from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { usePinLock } from '@/lib/lock/context'
import { usePwa } from '@/lib/pwa/context'

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
  { href: '/settlement', label: 'nav_settlements', icon: Calculator },
  { label: 'nav_manage', divider: true },
  { href: '/team', label: 'nav_team', icon: UserCog },
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

  const [userEmail, setUserEmail] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>('dark')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [fontSize, setFontSize] = useState(14)
  const [monochrome, setMonochrome] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => setUserEmail(res.data.user?.email || ''))
    const savedTheme = (localStorage.getItem('theme') || 'dark') as 'dark' | 'light'
    setTheme(savedTheme)
    document.documentElement.classList.toggle('dark', savedTheme === 'dark')

    const savedSize = parseInt(localStorage.getItem('fontSize') || '16')
    setFontSize(savedSize)
    document.documentElement.style.setProperty('--font-size-base', `${savedSize}px`)

    const savedMono = localStorage.getItem('monochrome') === 'true'
    setMonochrome(savedMono)
    document.documentElement.classList.toggle('grayscale-mode', savedMono)

    if (firm?.name) {
      document.title = `${firm.name} | ${APP_BRAND} ${APP_NAME}`
    } else {
      document.title = `${APP_BRAND} ${APP_NAME}`
    }
  }, [firm, supabase.auth])

  // Suspended check
  if (firm?.plan_status === 'suspended') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⏸️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)', marginBottom: 10 }}>Account Suspended</h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 20 }}>
            {firm.name}&apos;s account has been suspended. Contact us to renew.
          </p>
          <a href="mailto:seyonnexalabs@gmail.com" style={{ color: 'var(--gold)', fontSize: 14 }}>seyonnexalabs@gmail.com</a>
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
    const next = theme === 'dark' ? 'light' : 'dark'
    setTheme(next); localStorage.setItem('theme', next)
    document.documentElement.classList.toggle('dark', next === 'dark')
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
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <Link href="/dashboard" className="flex items-center gap-2 mb-2.5 hover:opacity-80 transition-opacity overflow-hidden">
            {firm?.logo_url ? (
              <img src={firm.logo_url} alt="Logo" style={{ height: 20, width: 'auto', maxWidth: 110, objectFit: 'contain', flexShrink: 0, borderRadius: 2 }} />
            ) : (
              <Building2 size={16} style={{ color: 'var(--gold)', flexShrink: 0 }} />
            )}
            <div className="flex flex-col truncate">
              <span className="text-[10px] font-black tracking-[0.3em] uppercase opacity-40 leading-none mb-1" style={{ color: 'var(--text)' }}>
                {APP_BRAND}
              </span>
              <div className="font-bold text-base leading-none" style={{ color: 'var(--gold)' }}>
                {firm?.name || APP_NAME}
              </div>
            </div>
          </Link>
          <div className="flex items-center gap-2">
            {firm && (
              <span className="text-xs px-2 py-0.5 rounded-full font-bold"
                style={{ background: planColor[firm.plan] + '22', color: planColor[firm.plan] }}>
                {firm.plan.charAt(0).toUpperCase() + firm.plan.slice(1)}
              </span>
            )}
            {/* Role badge */}
            <span className="text-xs px-2 py-0.5 rounded-full font-medium"
              style={{ background: isOwner ? 'rgba(201,168,76,0.1)' : 'var(--blue-dim)', color: isOwner ? 'var(--gold)' : 'var(--blue)' }}>
              {role === 'superadmin' ? '👑 Superadmin' : (isOwner ? '👑 Firm Admin' : '👤 Staff')}
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
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all"
                style={active ? { background: 'var(--gold-dim)', color: 'var(--gold)' } : { color: 'var(--text2)' }}>
                <Icon size={15} />
                {t(item.label)}
              </Link>
            )
          })}
        </nav>

        {isInstallable && (
          <div className="px-3 pb-3">
            <button onClick={install}
              className="w-full flex items-center gap-2.5 px-3 py-2.5 rounded-lg text-sm font-bold transition-all"
              style={{ background: 'var(--gold)', color: 'white', boxShadow: '0 4px 12px var(--gold-border)' }}>
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
              style={{ background: 'var(--green)', color: 'white', boxShadow: '0 4px 12px var(--green-dim)' }}>
              <Lock size={14} />
              Lock Session
            </button>
          </div>
        )}

        <div className="mt-auto border-t p-4" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3 p-2 rounded-xl transition-colors hover:bg-[var(--surface2)] group relative">
            <div className="w-8 h-8 rounded-full flex items-center justify-center font-bold text-[10px] shrink-0"
              style={{ background: 'var(--gold-dim)', color: 'var(--gold)', border: '1px solid var(--gold-border)' }}>
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
                className="p-1.5 rounded-lg hover:bg-[var(--red-dim)] hover:text-[var(--red)] shrink-0"
                style={{ color: 'var(--text3)' }}>
                <LogOut size={14} />
              </button>
            </div>
          </div>
          <div className="mt-3 flex items-center justify-between px-2">
            <div className="text-[10px] font-bold tracking-[0.2em] opacity-20 uppercase">
              {APP_NAME} v{process.env.NEXT_PUBLIC_APP_VERSION}
            </div>
          </div>
          <div className="mt-2 px-2">
             <div className="text-[9px] font-medium opacity-20 uppercase tracking-widest">
               Powered by SEYON NEXA LABS
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
            <h1 className="font-display text-lg" style={{ color: 'var(--text)' }}>
              {t(NAV.find(n => 'href' in n && n.href === pathname)?.label || '') || firm?.name || APP_NAME}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {firm?.plan === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 10 && (
              <div className="hidden sm:block text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
                ⚠ Trial: {trialDaysLeft}d left
              </div>
            )}
            <div className="flex items-center gap-1.5 p-1 rounded-full border" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
              {/* Monochrome */}
              <button onClick={toggleMono} title="Monochrome Mode"
                className="p-1 rounded-full hover:bg-[var(--surface3)] transition-colors"
                style={{ color: monochrome ? 'var(--gold)' : 'var(--text3)' }}>
                <Palette size={13} />
              </button>
              <div className="w-[1px] h-3 bg-[var(--border)] mx-0.5" />
              {/* Font Size */}
              <button onClick={() => adjustFont(-1)} title="Decrease Font"
                className="text-[10px] font-black w-5 h-5 flex items-center justify-center hover:bg-[var(--surface3)] rounded-full"
                style={{ color: 'var(--text2)' }}>
                A-
              </button>
              <button onClick={() => adjustFont(1)} title="Increase Font"
                className="text-[12px] font-black w-5 h-5 flex items-center justify-center hover:bg-[var(--surface3)] rounded-full"
                style={{ color: 'var(--text2)' }}>
                A+
              </button>
              <div className="w-[1px] h-3 bg-[var(--border)] mx-0.5" />
              {/* Language Switch */}
              <button onClick={() => setLang(lang === 'en' ? 'ta' : 'en')} title="Switch Language"
                className="flex items-center gap-1 px-2 py-0.5 rounded-full hover:bg-[var(--surface3)] transition-colors text-[10px] font-bold"
                style={{ color: 'var(--gold)', border: '1px solid var(--gold-dim)' }}>
                <Languages size={12} />
                {lang === 'en' ? 'தமிழ்' : 'EN'}
              </button>
              <div className="w-[1px] h-3 bg-[var(--border)] mx-0.5" />
              {/* Theme */}
              <button onClick={toggleTheme} className="p-1 rounded-full hover:bg-[var(--surface3)] transition-colors" style={{ color: 'var(--text2)' }}>
                {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
              </button>
              {/* Quick Lock */}
              {hasPin && (
                <>
                  <div className="w-[1px] h-3 bg-[var(--border)] mx-0.5" />
                  <button onClick={lock} title="Lock Session" className="p-1 rounded-full hover:bg-[var(--gold-dim)] hover:text-[var(--gold)] transition-colors">
                    <Lock size={13} />
                  </button>
                </>
              )}
            </div>
          </div>
        </header>
        <main className="flex-1 p-5 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
