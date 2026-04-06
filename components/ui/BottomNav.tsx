'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { 
  LayoutDashboard, 
  UsersRound, 
  Users, 
  PlusSquare, 
  Menu 
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { useI18n } from '@/lib/i18n/context'

interface BottomNavProps {
  onMenuClick: () => void
}

const ITEMS = [
  { href: '/dashboard', label: 'nav_dashboard', icon: LayoutDashboard },
  { href: '/groups', label: 'nav_groups', icon: UsersRound },
  { href: '/collection', label: 'nav_collection', icon: PlusSquare },
  { href: '/members', label: 'nav_members', icon: Users },
]

export function BottomNav({ onMenuClick }: BottomNavProps) {
  const pathname = usePathname()
  const { t } = useI18n()

  return (
    <nav className="fixed bottom-0 left-0 right-0 z-40 lg:hidden no-print"
         style={{ 
           background: 'rgba(var(--surface-rgb), 0.8)', 
           backdropFilter: 'blur(20px)', 
           borderTop: '1px solid var(--border)',
           paddingBottom: 'env(safe-area-inset-bottom)'
         }}>
      <div className="flex items-center justify-around h-16 px-2">
        {ITEMS.map((item) => {
          const Icon = item.icon
          const isActive = pathname === item.href || (item.href !== '/dashboard' && pathname.startsWith(item.href))
          
          return (
            <Link 
              key={item.href} 
              href={item.href}
              className={cn(
                "flex flex-col items-center justify-center gap-1 w-full h-full transition-all duration-200",
                isActive ? "text-[var(--accent)] scale-110" : "text-[var(--text2)] opacity-60"
              )}
            >
              <Icon size={20} strokeWidth={isActive ? 2.5 : 2} />
              <span className="text-[10px] font-bold uppercase tracking-tighter">
                {t(item.label).split(' ')[0]}
              </span>
            </Link>
          )
        })}

        {/* Menu Toggle */}
        <button 
          onClick={onMenuClick}
          className="flex flex-col items-center justify-center gap-1 w-full h-full text-[var(--text2)] opacity-60"
        >
          <Menu size={20} />
          <span className="text-[10px] font-bold uppercase tracking-tighter">More</span>
        </button>
      </div>
    </nav>
  )
}
