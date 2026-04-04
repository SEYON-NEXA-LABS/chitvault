'use client'

import { useState, useEffect, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { useI18n } from '@/lib/i18n/context'
import { 
  Search, Users, UsersRound, Gavel, CreditCard, 
  Settings, Archive, Calculator, FileText, ChevronRight,
  PlusCircle, BookOpen, LayoutDashboard, ShieldAlert
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CommandItem {
  id: string
  title: string
  subtitle?: string
  icon: any
  action: () => void
  category: 'Pages' | 'Actions' | 'Groups' | 'Members'
}

export function CommandPalette() {
  const [isOpen, setIsOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const [loading, setLoading] = useState(false)
  const [items, setItems] = useState<{ groups: any[], members: any[] }>({ groups: [], members: [] })
  
  const router = useRouter()
  const { t } = useI18n()
  const { firm, role } = useFirm()
  const supabase = useMemo(() => createClient(), [])

  // 1. Toggle with Ctrl+K
  useEffect(() => {
    const down = (e: KeyboardEvent) => {
      if (e.key === 'k' && (e.metaKey || e.ctrlKey)) {
        e.preventDefault()
        setIsOpen((open) => !open)
      }
    }
    document.addEventListener('keydown', down)
    return () => document.removeEventListener('keydown', down)
  }, [])

  // 2. Fetch Searchable Data
  useEffect(() => {
    if (!isOpen) return
    
    async function loadData() {
      setLoading(true)
      const { data: groups } = await supabase.from('groups').select('id, name, chit_value').eq('firm_id', firm?.id).is('deleted_at', null).limit(5)
      const { data: members } = await supabase.from('members').select('id, ticket_no, persons(name)').eq('firm_id', firm?.id).is('deleted_at', null).limit(10)
      
      setItems({ 
        groups: groups || [], 
        members: members || [] 
      })
      setLoading(false)
    }
    
    loadData()
  }, [isOpen, supabase, firm?.id])

  // 3. Define Static Commands
  const staticCommands: CommandItem[] = useMemo(() => [
    { id: 'dash', title: t('nav_dashboard'), icon: LayoutDashboard, category: 'Pages', action: () => router.push('/dashboard') },
    { id: 'groups', title: t('nav_groups'), icon: UsersRound, category: 'Pages', action: () => router.push('/groups') },
    { id: 'members', title: t('nav_members'), icon: Users, category: 'Pages', action: () => router.push('/members') },
    { id: 'payments', title: t('nav_payments'), icon: CreditCard, category: 'Pages', action: () => router.push('/payments') },
    { id: 'auctions', title: t('nav_auctions'), icon: Gavel, category: 'Pages', action: () => router.push('/auctions') },
    { id: 'trash', title: t('nav_trash'), icon: Archive, category: 'Pages', action: () => router.push('/trash') },
    
    { id: 'new_payment', title: t('record_payment'), icon: PlusCircle, category: 'Actions', action: () => router.push('/payments?new=true') },
    { id: 'new_group', title: t('new_group'), icon: PlusCircle, category: 'Actions', action: () => router.push('/groups?new=true') },
  ], [router, t])

  // 4. Filter Results
  const filteredItems = useMemo(() => {
    const q = query.toLowerCase().trim()
    
    const results: CommandItem[] = [...staticCommands]
    
    items.groups.forEach(g => {
      results.push({
        id: `group-${g.id}`,
        title: g.name,
        subtitle: `Chit Group · ₹${g.chit_value}`,
        icon: UsersRound,
        category: 'Groups',
        action: () => router.push(`/groups/${g.id}`)
      })
    })
    
    items.members.forEach(m => {
       results.push({
         id: `member-${m.id}`,
         title: m.persons?.name || 'Unknown',
         subtitle: `Ticket #${m.ticket_no}`,
         icon: Users,
         category: 'Members',
         action: () => router.push(`/members?id=${m.id}`)
       })
    })

    if (!q) return results.slice(0, 15)
    
    return results.filter(item => 
      item.title.toLowerCase().includes(q) || 
      item.subtitle?.toLowerCase().includes(q) ||
      item.category.toLowerCase().includes(q)
    )
  }, [query, staticCommands, items, router])

  // 5. Keyboard Navigation
  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowDown') {
      e.preventDefault()
      setSelectedIndex(i => (i + 1) % filteredItems.length)
    } else if (e.key === 'ArrowUp') {
      e.preventDefault()
      setSelectedIndex(i => (i - 1 + filteredItems.length) % filteredItems.length)
    } else if (e.key === 'Enter') {
      e.preventDefault()
      if (filteredItems[selectedIndex]) {
        filteredItems[selectedIndex].action()
        setIsOpen(false)
        setQuery('')
      }
    } else if (e.key === 'Escape') {
      setIsOpen(false)
    }
  }, [filteredItems, selectedIndex])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center pt-[15vh] px-4 sm:px-6"
      style={{ background: 'rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)' }}
      onClick={() => setIsOpen(false)}>
      
      <div 
        className="w-full max-w-xl bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-2xl overflow-hidden animate-in fade-in zoom-in duration-200"
        onClick={e => e.stopPropagation()}
        onKeyDown={handleKeyDown}
      >
        <div className="flex items-center px-4 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
          <Search size={20} className="mr-3 opacity-40" />
          <input 
            autoFocus
            className="flex-1 bg-transparent border-none outline-none text-base placeholder:opacity-30"
            placeholder="Type a command or search..."
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
          />
          <div className="flex items-center gap-1.5 px-2 py-1 rounded-md bg-[var(--surface2)] border border-[var(--border)] text-[10px] font-bold opacity-50 uppercase tracking-widest leading-none">
            ESC
          </div>
        </div>

        <div className="max-h-[50vh] overflow-y-auto py-2 custom-scrollbar">
          {filteredItems.length === 0 ? (
            <div className="py-10 text-center opacity-40">
              <div className="text-2xl mb-2">❔</div>
              <p className="text-sm">No results found for &quot;{query}&quot;</p>
            </div>
          ) : (
            <div className="space-y-4 px-2">
              {['Actions', 'Pages', 'Groups', 'Members'].map(cat => {
                const catItems = filteredItems.filter(i => i.category === cat)
                if (catItems.length === 0) return null
                
                return (
                  <div key={cat} className="space-y-1">
                    <div className="px-3 py-1 text-[10px] font-black uppercase tracking-[0.2em] opacity-30">
                      {cat}
                    </div>
                    {catItems.map((item) => {
                      const Icon = item.icon
                      const overallIndex = filteredItems.indexOf(item)
                      const isSelected = overallIndex === selectedIndex
                      
                      return (
                        <div 
                          key={item.id}
                          onClick={() => { item.action(); setIsOpen(false); setQuery('') }}
                          onMouseEnter={() => setSelectedIndex(overallIndex)}
                          className={cn(
                            "flex items-center justify-between px-3 py-2.5 rounded-xl cursor-pointer transition-all border",
                            isSelected 
                              ? "bg-[var(--accent)] text-white border-[var(--accent)] shadow-lg scale-[1.02]" 
                              : "border-transparent hover:bg-[var(--surface2)]"
                          )}
                        >
                          <div className="flex items-center gap-3">
                            <div className={cn(
                              "w-8 h-8 rounded-lg flex items-center justify-center border transition-colors",
                              isSelected ? "bg-white/20 border-white/20 text-white" : "bg-[var(--surface2)] border-[var(--border)] opacity-60"
                            )}>
                              <Icon size={16} />
                            </div>
                            <div>
                              <div className="text-sm font-bold leading-tight">{item.title}</div>
                              {item.subtitle && (
                                <div className={cn("text-[10px] leading-tight mt-0.5", isSelected ? "text-white/70" : "opacity-40")}>
                                  {item.subtitle}
                                </div>
                              )}
                            </div>
                          </div>
                          {isSelected && <ChevronRight size={14} className="opacity-50" />}
                        </div>
                      )
                    })}
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="px-4 py-3 border-t flex items-center justify-between text-[10px] font-black uppercase tracking-widest opacity-40 select-none" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center gap-4">
             <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface2)] border">↑↓</kbd> Navigate</span>
             <span className="flex items-center gap-1.5"><kbd className="px-1.5 py-0.5 rounded bg-[var(--surface2)] border">↵</kbd> Select</span>
          </div>
          <div className="flex items-center gap-1">
            <Calculator size={12} /> ChitVault Suite
          </div>
        </div>
      </div>
    </div>
  )
}
