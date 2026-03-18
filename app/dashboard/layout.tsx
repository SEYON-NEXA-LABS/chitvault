'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { APP_NAME, cn } from '@/lib/utils'
import {
  LayoutDashboard, Users, UsersRound, Gavel,
  CreditCard, BarChart3, ClipboardList, Settings,
  LogOut, Sun, Moon, Menu, Building2, UserCog, BookOpen
} from 'lucide-react'

const NAV = [
  { href: '/dashboard',  label: 'Dashboard',        icon: LayoutDashboard },
  { href: '/groups',     label: 'Chit Groups',       icon: UsersRound      },
  { href: '/members',    label: 'Members',           icon: Users           },
  { label: 'Transactions', divider: true },
  { href: '/auctions',   label: 'Auctions',          icon: Gavel           },
  { href: '/payments',   label: 'Payments',          icon: CreditCard      },
  { href: '/cashbook',   label: 'Daily Cash',         icon: BookOpen        },
  { label: 'Reports', divider: true },
  { href: '/reports',    label: 'Reports',           icon: BarChart3       },
  { href: '/collection', label: 'Collection Report', icon: ClipboardList   },
  { label: 'Manage', divider: true },
  { href: '/team',       label: 'Team',              icon: UserCog, ownerOnly: true },
  { href: '/settings',   label: 'Settings',          icon: Settings, ownerOnly: true },
]

const planColor: Record<string, string> = {
  trial: '#5b8af5', basic: '#c9a84c', pro: '#3ecf8e'
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const pathname  = usePathname()
  const router    = useRouter()
  const supabase  = createClient()
  const { firm, role } = useFirm()
  const [userEmail, setUserEmail] = useState('')
  const [theme,     setTheme]     = useState<'dark'|'light'>('light')
  const [sidebarOpen, setSidebarOpen] = useState(false)

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email || ''))
    const saved = (localStorage.getItem('theme') || 'light') as 'dark'|'light'
    setTheme(saved)
    document.documentElement.classList.toggle('light', saved === 'light')
  }, [])

  // Suspended check
  if (firm?.plan_status === 'suspended') {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 20, background: 'var(--bg)' }}>
        <div style={{ maxWidth: 420, textAlign: 'center' }}>
          <div style={{ fontSize: 52, marginBottom: 12 }}>⏸️</div>
          <h2 style={{ fontSize: 20, fontWeight: 800, color: 'var(--red)', marginBottom: 10 }}>Account Suspended</h2>
          <p style={{ fontSize: 14, color: 'var(--text2)', lineHeight: 1.7, marginBottom: 20 }}>
            {firm.name}'s account has been suspended. Contact us to renew.
          </p>
          <a href="mailto:billing@chitvault.app" style={{ color: 'var(--gold)', fontSize: 14 }}>billing@chitvault.app</a>
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
    document.documentElement.classList.toggle('light', next === 'light')
  }

  const trialDaysLeft = firm?.trial_ends
    ? Math.max(0, Math.ceil((new Date(firm.trial_ends).getTime() - Date.now()) / 86400000))
    : null

  const isOwner = role === 'owner' || role === 'superadmin'

  return (
    <div className="flex min-h-screen" style={{ background: 'var(--bg)' }}>
      {sidebarOpen && <div className="fixed inset-0 z-40 bg-black/60 lg:hidden" onClick={() => setSidebarOpen(false)} />}

      <aside className={cn(
        'fixed top-0 left-0 bottom-0 z-50 w-60 flex flex-col transition-transform duration-300 border-r',
        sidebarOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )} style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>

        {/* Firm header */}
        <div className="px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-2 mb-2">
            <Building2 size={15} style={{ color: 'var(--gold)' }} />
            <div className="font-bold text-sm truncate" style={{ color: 'var(--gold)' }}>
              {firm?.name || APP_NAME}
            </div>
          </div>
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
              {isOwner ? '👑 Owner' : '👤 Staff'}
            </span>
          </div>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-3">
          {NAV.map((item, i) => {
            if ('divider' in item && item.divider) return (
              <div key={i} className="text-xs uppercase tracking-widest px-2 pt-4 pb-1" style={{ color: 'var(--text3)' }}>{item.label}</div>
            )
            if (!('href' in item)) return null
            if ((item as any).ownerOnly && !isOwner) return null   // hide owner-only items for staff
            const Icon   = item.icon!
            const active = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
            return (
              <Link key={item.href} href={item.href} onClick={() => setSidebarOpen(false)}
                className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg mb-0.5 text-sm font-medium transition-all"
                style={active ? { background: 'rgba(201,168,76,0.12)', color: 'var(--gold)' } : { color: 'var(--text2)' }}>
                <Icon size={15} />
                {item.label}
              </Link>
            )
          })}
        </nav>

        <div className="border-t px-4 py-3" style={{ borderColor: 'var(--border)' }}>
          <div className="text-xs mb-0.5" style={{ color: 'var(--text3)' }}>Signed in as</div>
          <div className="text-xs font-medium truncate mb-2" style={{ color: 'var(--text)' }}>{userEmail}</div>
          <div className="flex justify-between items-center">
            <span className="text-xs" style={{ color: 'var(--text3)' }}>v2.0</span>
            <button onClick={async () => { await supabase.auth.signOut(); router.push('/login') }}
              className="flex items-center gap-1 text-xs font-medium"
              style={{ color: 'var(--red)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <LogOut size={11} /> Sign Out
            </button>
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col lg:ml-60">
        <header className="sticky top-0 z-30 flex items-center justify-between px-5 py-3.5 border-b"
          style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-3">
            <button className="lg:hidden" onClick={() => setSidebarOpen(true)}
              style={{ color: 'var(--text2)', background: 'none', border: 'none', cursor: 'pointer' }}>
              <Menu size={20} />
            </button>
            <h1 className="font-display text-lg" style={{ color: 'var(--text)' }}>
              {NAV.find(n => 'href' in n && n.href === pathname)?.label || APP_NAME}
            </h1>
          </div>
          <div className="flex items-center gap-2">
            {firm?.plan === 'trial' && trialDaysLeft !== null && trialDaysLeft <= 10 && (
              <div className="hidden sm:block text-xs px-3 py-1 rounded-full font-medium"
                style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
                ⚠ Trial: {trialDaysLeft}d left
              </div>
            )}
            <button onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-full border text-xs"
              style={{ background: 'var(--surface2)', borderColor: 'var(--border)', color: 'var(--text2)', cursor: 'pointer' }}>
              {theme === 'dark' ? <Moon size={13} /> : <Sun size={13} />}
            </button>
          </div>
        </header>
        <main className="flex-1 p-5 overflow-auto">{children}</main>
      </div>
    </div>
  )
}
