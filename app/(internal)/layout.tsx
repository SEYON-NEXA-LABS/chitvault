'use client'

import { useState, useEffect, useMemo } from 'react'
import Link from 'next/link'
import Image from 'next/image'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { APP_BRAND, APP_DEVELOPER, APP_NAME, APP_VERSION, APP_COMMIT_ID, cn } from '@/lib/utils/index'
import {
  ChevronDown,
  LayoutDashboard, Users, UsersRound, Gavel, Crown,
  CreditCard, BarChart3, ClipboardList, Settings,
  LogOut, Sun, Moon, Menu, Building2, UserCog, BookOpen, Palette, Calculator, HelpCircle, Languages, Download, Lock, Monitor,
  ShieldAlert, Phone, MapPin, Search, AlertTriangle, Archive, Compass
} from 'lucide-react'
import { CommandPalette, TourProvider, useTour, NetworkStatus, BottomNav } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
import { usePinLock } from '@/lib/lock/context'
import { IdleTimeout } from '@/components/features/IdleTimeout'
import type { Firm, Profile, UserRole } from '@/types'
import { useTheme } from '@/lib/theme/context'

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
  ownerOnly?: boolean
  superAdminOnly?: boolean
  items?: {
    href: string
    label: string
    icon?: any
    ownerOnly?: boolean
  }[]
}

const NAV: NavItem[] = [
  {
    label: 'nav_operations',
    icon: LayoutDashboard,
    items: [
      { href: '/dashboard', label: 'nav_dashboard', icon: LayoutDashboard },
      { href: '/groups', label: 'nav_groups', icon: UsersRound },
      { href: '/members', label: 'nav_members', icon: Users },
    ]
  },
  {
    label: 'nav_transactions',
    icon: Gavel,
    items: [
      { href: '/auctions', label: 'nav_auctions', icon: Gavel },
      { href: '/payments', label: 'nav_payments', icon: CreditCard },
      { href: '/settlement', label: 'nav_settlements', icon: Calculator },
    ]
  },
  {
    label: 'nav_reports_group',
    icon: BarChart3,
    items: [
      { href: '/reports', label: 'nav_reports', icon: BarChart3 },
      { href: '/cashbook', label: 'nav_cashbook', icon: BookOpen },
      { href: '/collection', label: 'nav_collection', icon: ClipboardList },
      { href: '/defaulters', label: 'nav_defaulters', icon: ShieldAlert },
    ]
  },
  {
    label: 'nav_manage',
    icon: Settings,
    items: [
      { href: '/team', label: 'nav_team', icon: UserCog },
      { href: '/trash', label: 'nav_trash', icon: Archive, ownerOnly: true },
      { href: '/admin/branding', label: 'nav_branding', icon: Palette, ownerOnly: true },
      { href: '/settings', label: 'nav_settings', icon: Settings },
      { href: '/usage', label: 'nav_usage_hub', icon: BarChart3, ownerOnly: true },
    ]
  },
  {
    label: 'nav_help',
    icon: HelpCircle,
    items: [
      { href: '/walkthrough', label: 'nav_journey', icon: BookOpen },
      { href: '/schemes', label: 'nav_schemes', icon: HelpCircle },
    ]
  },
  {
    label: 'Control Plane',
    icon: Crown,
    superAdminOnly: true,
    items: [
      { href: '/superadmin', label: 'Overview', icon: Crown },
      { href: '/superadmin/onboard', label: 'Onboard Firm', icon: Building2 },
    ]
  }
]

const planColor: Record<string, string> = {
  trial: '#5b8af5', basic: '#2563eb', pro: '#3ecf8e'
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { role, firm } = useFirm()
  const isOwner = role === 'owner' || role === 'superadmin'
  const { lang, setLang, t } = useI18n()
  const { isLocked, lock, hasPin, isElectron } = usePinLock()
  const { switchedFirmId, setSwitchedFirmId } = useFirm()
  const [firms, setFirms] = useState<Firm[]>([])

  const { theme, toggleTheme, adjustFont } = useTheme()

  const [userEmail, setUserEmail] = useState('')
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [expanded, setExpanded] = useState<Record<string, boolean>>({
    nav_operations: true, nav_transactions: true, nav_reports_group: true, nav_manage: true, nav_help: true, 'Control Plane': true
  })

  useEffect(() => {
    supabase.auth.getUser().then((res: any) => setUserEmail(res.data.user?.email || ''))

    if (role === 'superadmin') {
      supabase.from('firms').select('id, name, slug').order('name').then((res: { data: Firm[] | null }) => setFirms(res.data || []))
    }

    if (firm?.name) {
      document.title = `${firm.name} (${firm.slug}) | ${APP_BRAND}`
    } else {
      document.title = (switchedFirmId === 'all') ? `${APP_BRAND} Control Center` : `${APP_BRAND} ${APP_NAME}`
    }
  }, [firm?.id, supabase, role, switchedFirmId])

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

  const trialDaysLeft = firm?.trial_ends
    ? Math.max(0, Math.ceil((new Date(firm.trial_ends).getTime() - Date.now()) / 86400000))
    : null

  return (
    <TourProvider>
      <NetworkStatus />
      <IdleTimeout />
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

          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-4">
            {NAV.map((group, i) => {
              if (group.superAdminOnly && role !== 'superadmin') return null
              if (group.ownerOnly && !isOwner) return null

              const isExp = expanded[group.label]
              const Icon = group.icon

              return (
                <div key={i} className="space-y-1">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [group.label]: !e[group.label] }))}
                    className="w-full flex items-center justify-between px-3 py-2 rounded-xl text-[10px] font-black uppercase tracking-[0.2em] opacity-40 hover:opacity-100 transition-opacity"
                  >
                    <div className="flex items-center gap-2">
                      {Icon && <Icon size={14} className="opacity-50" />}
                      {t(group.label)}
                    </div>
                    <ChevronDown size={14} className={cn("transition-transform duration-300", !isExp && "-rotate-90")} />
                  </button>

                  <div className={cn("space-y-1 overflow-hidden transition-all duration-300", isExp ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0")}>
                    {group.items?.map((item, j) => {
                      if (item.ownerOnly && !isOwner) return null
                      const SIcon = item.icon
                      const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))

                      return (
                        <Link
                          key={j}
                          href={item.href}
                          className={cn(
                            'flex items-center gap-3 px-3 py-2 rounded-xl text-[12px] font-medium transition-all ml-2',
                            active
                              ? 'bg-[var(--accent)] text-white shadow-lg shadow-[var(--accent-dim)]'
                              : 'text-[var(--text2)] hover:bg-[var(--surface2)]'
                          )}
                          onClick={() => setSidebarOpen(false)}
                        >
                          {SIcon && <SIcon size={16} />}
                          {t(item.label)}
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="p-4 border-t space-y-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex items-center justify-between px-2">
              <button
                onClick={toggleTheme}
                className="p-2 rounded-lg hover:bg-[var(--surface2)] text-[var(--text2)]"
                title={theme === 'dark' ? 'Switch to Light' : 'Switch to Dark'}
              >
                {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
              </button>
              <div className="flex items-center gap-1">
                <button onClick={() => adjustFont(-1)} className="p-1 text-xs opacity-50 hover:opacity-100">A-</button>
                <button onClick={() => adjustFont(1)} className="p-1 text-base opacity-50 hover:opacity-100">A+</button>
              </div>
              <div className="w-8" /> {/* Spacer for symmetry since mono is removed */}
            </div>

            <div className="p-3 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] space-y-3">
              <div className="flex items-center gap-3">
                <div className="p-1.5 rounded-lg bg-[var(--surface3)] text-[var(--text2)]">
                  <UserCog size={16} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-[11px] font-black truncate uppercase" style={{ color: 'var(--text)' }}>
                    {firm?.name || APP_BRAND}
                  </p>
                  <p className="text-[9px] opacity-40 font-mono truncate">
                    ID: {firm?.slug || 'GLOBAL'}
                  </p>
                  <div className="flex items-center justify-between mt-1 pt-1 border-t border-white/5">
                    <p className="text-[9px] opacity-60 uppercase font-black">{role}</p>
                    <p className="text-[9px] opacity-30 font-mono">v{APP_VERSION}</p>
                  </div>
                </div>
              </div>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
                className="w-full py-2 rounded-xl bg-[var(--danger-dim)] text-[var(--danger)] text-xs font-bold hover:opacity-80 transition-opacity"
              >
                {t('sign_out')}
              </button>
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
