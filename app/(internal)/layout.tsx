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
  ShieldAlert, Phone, MapPin, Search, AlertTriangle, Archive,
  ShieldCheck, Scale
} from 'lucide-react'
import { CommandPalette, NetworkStatus, BottomNav } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
import { usePinLock } from '@/lib/lock/context'
import { IdleTimeout } from '@/components/features/IdleTimeout'
import type { Firm, Profile, UserRole } from '@/types'
import { useTheme } from '@/lib/theme/context'

// ── Helpers ──────────────────────────────────────────────────────────────────

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
      { href: '/members', label: 'nav_members', icon: Users },
      { href: '/groups', label: 'nav_groups', icon: UsersRound },
    ]
  },
  {
    label: 'nav_transactions',
    icon: Gavel,
    items: [
      { href: '/auctions', label: 'nav_auctions', icon: Gavel },
      { href: '/collection', label: 'nav_collection', icon: ClipboardList },
      { href: '/settlement', label: 'nav_settlements', icon: Calculator },
    ]
  },
  {
    label: 'nav_reports_group',
    icon: BarChart3,
    items: [
      { href: '/cashbook', label: 'nav_cashbook', icon: BookOpen },
      { href: '/defaulters', label: 'nav_defaulters', icon: ShieldAlert },
      { href: '/reports', label: 'nav_reports', icon: BarChart3 },
    ]
  },
  {
    label: 'nav_manage',
    icon: Settings,
    items: [
      { href: '/team', label: 'nav_team', icon: UserCog },
      { href: '/settings', label: 'nav_settings', icon: Settings },
      { href: '/admin/branding', label: 'nav_branding', icon: Palette, ownerOnly: true },
      { href: '/usage', label: 'nav_usage_hub', icon: BarChart3, ownerOnly: true },
      { href: '/trash', label: 'nav_trash', icon: Archive, ownerOnly: true },
    ]
  },
  {
    label: 'nav_help',
    icon: HelpCircle,
    items: [
      { href: '/help', label: 'nav_journey', icon: BookOpen },
      { href: '/legal', label: 'nav_legal', icon: Scale },
      { href: '/schemes', label: 'nav_schemes', icon: HelpCircle },
    ]
  },
  {
    label: 'Control Plane',
    icon: Crown,
    superAdminOnly: true,
    items: [
      { href: '/superadmin/dashboard', label: 'Overview', icon: Crown },
      { href: '/superadmin/onboard', label: 'Onboard Firm', icon: Building2 },
      { href: '/superadmin/integrity', label: 'Database Integrity', icon: ShieldCheck },
    ]
  }
]

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { role, firm, profile, loading } = useFirm()
  const isOwner = role === 'owner' || role === 'superadmin'
  const { lang, setLang, t } = useI18n()
  const { isLocked, lock, hasPin, isElectron } = usePinLock()
  const { switchedFirmId, setSwitchedFirmId } = useFirm()
  const [firms, setFirms] = useState<Firm[]>([])

  const { theme, toggleTheme, adjustFont } = useTheme()
  const { status } = useFirm()

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
      document.title = (switchedFirmId === 'all') ? `${APP_NAME} Control Center` : `${APP_NAME} ${APP_BRAND}`
    }
  }, [firm?.id, supabase, role, switchedFirmId])

  // Hard Lockout check
  if (status === 'locked' && role !== 'superadmin') {
    return (
      <div className="min-h-screen flex items-center justify-center p-5 bg-[var(--bg)]">
        <div className="max-w-md w-full bg-white border border-red-100 rounded-[2.5rem] p-12 text-center space-y-6 shadow-2xl shadow-red-500/5">
          <div className="w-20 h-20 bg-red-50 text-red-600 rounded-3xl flex items-center justify-center mx-auto text-4xl">
            🔒
          </div>
          <div className="space-y-2">
            <h2 className="text-2xl font-black text-[var(--text)] uppercase tracking-tight">Access Locked</h2>
            <p className="text-sm text-[var(--text2)] leading-relaxed">
              Subscription for <strong>{firm?.name}</strong> has expired. To maintain your instance and access your data, please renew your plan.
            </p>
          </div>
          <div className="pt-4 flex flex-col gap-3">
             <a href={`https://wa.me/917397503761?text=Renew%20ChitVault%20for%20${firm?.name}`} target="_blank" className="w-full py-4 rounded-2xl bg-slate-900 text-white font-bold hover:bg-slate-800 transition-all">
                Renew via WhatsApp
             </a>
             <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
               className="text-xs font-bold text-[var(--text3)] uppercase tracking-widest hover:text-[var(--text)] transition-colors">
               Sign Out
             </button>
          </div>
        </div>
      </div>
    )
  }

  const trialDaysLeft = firm?.trial_ends
    ? Math.max(0, Math.ceil((new Date(firm.trial_ends).getTime() - Date.now()) / 86400000))
    : null

  // Public access check: If not logged in and on a public-allowed page, render without sidebar
  const isPublicRoute = pathname.startsWith('/legal') || pathname.startsWith('/schemes')
  if (!loading && !profile && isPublicRoute) {
    return <main className="flex-1 p-8 sm:p-20 bg-white min-h-screen text-sm">{children}</main>
  }

  return (
    <>
      <NetworkStatus />
      <IdleTimeout />
      <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
        {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

        <aside className={cn(
          'fixed top-0 left-0 bottom-0 z-50 w-64 flex flex-col transition-transform duration-300 border-r no-print bg-[#FAFAFA]',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
        )} style={{ borderColor: '#E4E4E7' }}>
          <div className="p-6 border-b flex items-center justify-between" style={{ borderColor: '#E4E4E7' }}>
            <Link href="/dashboard" className="flex items-center gap-2.5 group">
              <Image src="/icons/icon-512.png" alt={APP_NAME} width={28} height={28} className="w-7 h-7 object-contain transition-transform group-hover:rotate-12 duration-500" />
              <span className="font-bold text-xl tracking-tight text-[#09090B] font-brand">{APP_NAME}</span>
            </Link>
          </div>

          <nav className="flex-1 overflow-y-auto py-6 px-4 space-y-6">
            {NAV.map((group, i) => {
              if (group.superAdminOnly && role !== 'superadmin') return null
              if (group.ownerOnly && !isOwner) return null

              const isExp = expanded[group.label]
              const Icon = group.icon

              return (
                <div key={i} className="space-y-1">
                  <button
                    onClick={() => setExpanded(e => ({ ...e, [group.label]: !e[group.label] }))}
                    className="w-full flex items-center justify-between px-3 py-1 text-xs font-black uppercase tracking-widest text-[var(--text3)] hover:text-[var(--text)] transition-colors"
                  >
                    <div className="flex items-center gap-2">
                      {Icon && <Icon size={14} className="opacity-40" />}
                      {t(group.label)}
                    </div>
                    <ChevronDown size={14} className={cn("transition-transform duration-300 opacity-40", !isExp && "-rotate-90")} />
                  </button>

                  <div className={cn("space-y-1 overflow-hidden transition-all duration-300", isExp ? "max-h-[500px] opacity-100" : "max-h-0 opacity-0")}>
                    {group.items?.map((item, j) => {
                      if (item.ownerOnly && !isOwner) return null
                      const SIcon = item.icon
                      const effectiveHref = item.href === '/dashboard' && role === 'superadmin' ? '/superadmin/dashboard' : item.href
                      const active = pathname === effectiveHref || (effectiveHref !== '/dashboard' && pathname.startsWith(effectiveHref))

                      return (
                        <Link
                          key={j}
                          href={effectiveHref}
                          className={cn(
                            'flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-all',
                            active
                              ? 'bg-[#F4F4F5] text-[#09090B] font-bold shadow-none'
                              : 'text-slate-600 hover:text-[#09090B] hover:bg-[#F4F4F5]/50'
                          )}
                          onClick={() => setSidebarOpen(false)}
                        >
                          {SIcon && <SIcon size={16} className={cn(active ? "text-[#155DFC]" : "text-slate-400")} />}
                          <span>{t(item.label)}</span>
                        </Link>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </nav>

          <div className="p-6 border-t space-y-6" style={{ borderColor: '#E4E4E7' }}>
            <div className="flex items-center justify-between px-2">
              <div className="flex items-center gap-1">
                <button
                  onClick={toggleTheme}
                  className="p-2 rounded-xl hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] transition-colors"
                  title="Toggle Theme"
                >
                  {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
                </button>

                <div className="h-4 w-[1px] bg-[var(--border)] mx-1" />

                <button
                  onClick={() => adjustFont(-1)}
                  className="w-8 h-8 rounded-lg hover:bg-[var(--surface2)] text-[10px] font-bold text-[var(--text3)] hover:text-[var(--text)] transition-colors border border-transparent hover:border-[var(--border)]"
                  title="Decrease Font"
                >
                  A-
                </button>
                <button
                  onClick={() => adjustFont(1)}
                  className="w-8 h-8 rounded-lg hover:bg-[var(--surface2)] text-sm font-bold text-[var(--text3)] hover:text-[var(--text)] transition-colors border border-transparent hover:border-[var(--border)]"
                  title="Increase Font"
                >
                  A+
                </button>
              </div>
              
              <button
                onClick={() => setLang(lang === 'en' ? 'ta' : 'en')}
                className="px-3 py-1 rounded-xl border border-slate-200 bg-[var(--surface2)] text-xs font-bold uppercase tracking-widest text-slate-600"
              >
                {lang === 'en' ? 'EN' : 'தமிழ்'}
              </button>
            </div>

            <div className="p-4 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] space-y-3">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-white border border-slate-200 flex items-center justify-center text-[var(--text3)] shrink-0">
                  <UserCog size={18} />
                </div>
                <div className="flex-1 min-w-0">
                  {loading ? (
                    <div className="space-y-2">
                      <div className="h-3 w-20 bg-slate-200 rounded animate-pulse" />
                      <div className="h-2 w-24 bg-slate-100 rounded animate-pulse" />
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-bold text-[var(--text)] truncate">
                        {profile?.full_name || userEmail.split('@')[0] || 'Account'}
                      </p>
                      <p className="text-xs text-[var(--text3)] truncate uppercase tracking-widest">
                        {firm?.name || (role === 'superadmin' ? 'Control Plane' : 'Global')}
                      </p>
                    </>
                  )}
                </div>
              </div>
              <button
                onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
                className="w-full py-2 rounded-xl bg-white border border-slate-200 text-red-600 text-xs font-bold uppercase tracking-widest hover:bg-red-50 transition-colors"
              >
                {t('sign_out')}
              </button>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col lg:ml-64">
          <header className="sticky top-0 z-30 flex items-center justify-between px-6 py-3 border-b no-print bg-white/80 backdrop-blur-md"
            style={{ borderColor: '#E4E4E7' }}>
            <div className="flex items-center gap-4">
              <button className="lg:hidden p-2 -ml-2 text-slate-400 hover:text-slate-900" onClick={() => setSidebarOpen(true)}>
                <Menu size={20} />
              </button>
              <h2 className="text-sm font-bold text-[#09090B] uppercase tracking-tight">
                {t(NAV.find(n => n.href === pathname)?.label || '') || firm?.name || APP_NAME}
              </h2>
            </div>
            <div className="flex items-center gap-3">
              {hasPin ? (
                <button onClick={lock} className="px-4 py-2 rounded-xl bg-slate-900 text-white text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Lock size={14} /> Lock
                </button>
              ) : (
                <Link href="/settings#lock-config" className="px-4 py-2 rounded-xl bg-orange-50 text-orange-600 border border-orange-200 text-xs font-bold uppercase tracking-widest flex items-center gap-2">
                  <Lock size={14} /> Security
                </Link>
              )}
            </div>
          </header>

          {status === 'restricted' && role !== 'superadmin' && (
            <div className="bg-red-50 border-b border-red-100 px-6 py-3 flex flex-col sm:flex-row items-center justify-between gap-4 no-print">
               <div className="flex items-center gap-3 text-red-600">
                  <AlertTriangle size={18} className="shrink-0" />
                  <div className="text-xs font-bold uppercase tracking-widest leading-tight">
                    <div>View-Only Mode Active</div>
                    <div className="opacity-60 text-[9px] mt-0.5">Please renew your AMC to enable data entry</div>
                  </div>
               </div>
               <a href={`https://wa.me/917397503761?text=Renew%20ChitVault%20for%20${firm?.name}`} target="_blank" className="px-4 py-2 bg-red-600 text-white text-[10px] font-black uppercase tracking-[0.2em] rounded-lg shadow-lg shadow-red-500/20 hover:scale-105 active:scale-95 transition-all">
                  Renew via WhatsApp
               </a>
            </div>
          )}

          <main className="flex-1 p-6 overflow-auto pb-24 lg:pb-6 text-sm">{children}</main>
          <BottomNav onMenuClick={() => setSidebarOpen(true)} />
          <CommandPalette />
        </div>
      </div>
    </>
  )
}
