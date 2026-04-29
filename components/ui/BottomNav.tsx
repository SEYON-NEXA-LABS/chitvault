'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  Compass, 
  Layers, 
  Wallet, 
  Users, 
  Menu 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'
import { haptics } from '@/lib/utils/haptics'

interface BottomNavProps {
  onMenuClick: () => void
}

const ITEMS = [
  { href: '/dashboard', label: 'nav_dashboard', icon: Compass },
  { href: '/groups', label: 'nav_groups', icon: Layers },
  { href: '/collection', label: 'nav_collection', icon: Wallet },
  { href: '/members', label: 'nav_members', icon: Users },
]

export function BottomNav({ onMenuClick }: BottomNavProps) {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <div className="fixed left-0 right-0 z-40 lg:hidden px-6 no-print pointer-events-none"
         style={{ bottom: 'calc(1.5rem + env(safe-area-inset-bottom))' }}>
      <nav className="mx-auto max-w-md h-16 rounded-[2rem] border shadow-2xl flex items-center justify-between px-2 overflow-hidden pointer-events-auto transition-all duration-500 animate-in fade-in slide-in-from-bottom-4"
           style={{ 
             background: 'rgba(var(--surface-rgb), 0.7)', 
             backdropFilter: 'blur(24px)', 
             borderColor: 'rgba(var(--border-rgb), 0.5)',
           }}>
        {ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              onClick={() => haptics.light()}
              className={cn(
                "flex items-center justify-center transition-all duration-300 relative rounded-full py-2",
                isActive ? "bg-[var(--accent)] text-white px-5 shadow-lg shadow-[var(--accent-dim)]" : "text-[var(--text2)] opacity-40 px-3"
              )}
            >
              <Icon size={isActive ? 18 : 22} strokeWidth={isActive ? 2.5 : 2} />
              {isActive && (
                <span className="text-[11px] font-black uppercase tracking-widest ml-2 animate-in fade-in zoom-in-90 duration-300">
                  {t(item.label).split(' ')[0]}
                </span>
              )}
            </Link>
          )
        })}

        {/* Menu Toggle / More */}
        <button 
          onClick={() => { haptics.light(); onMenuClick() }}
          className="flex items-center justify-center p-3 text-[var(--text2)] opacity-40 hover:opacity-100 transition-opacity"
        >
          <Menu size={22} />
        </button>
      </nav>
    </div>
  )
}
