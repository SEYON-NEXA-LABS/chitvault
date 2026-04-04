'use client'

import React, { useMemo, useState, useCallback, useEffect, Suspense } from "react"
import { useRouter } from 'next/navigation'
import { Card, Table, Th, Td, Tr, Badge, Loading, Btn, Field, StatCard } from "@/components/ui"
import { 
  Calculator, Search, Filter, Calendar, User, 
  Layers, ArrowLeft, History, FileText, Download, Trash2
} from "lucide-react"
import { fmt, fmtDate, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useFirm } from "@/lib/firm/context"
import { useI18n } from "@/lib/i18n/context"
import { useToast } from "@/lib/hooks/useToast"
import { logActivity } from "@/lib/utils/logger"
import { withFirmScope } from "@/lib/supabase/firmQuery"
import { inputClass, inputStyle } from "@/components/ui"
import type { Settlement, Group } from "@/types"

function SettlementHistoryPage() {
  const supabase = createClient()
  const router = useRouter()
  const { show } = useToast()
  const { t } = useI18n()
  const { firm, can } = useFirm()
  
  const [history, setHistory] = useState<Settlement[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  
  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedGroupId, setSelectedGroupId] = useState('')
  const [dateRange, setDateRange] = useState({ start: '', end: '' })

  const loadData = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    if (!firm) return

    const [h, g] = await Promise.all([
      withFirmScope(
        supabase.from('settlements').select('*, members(id, persons(name, phone), groups(id, name, duration))'),
        firm.id
      ).is('deleted_at', null).order('created_at', { ascending: false }),
      withFirmScope(
        supabase.from('groups').select('*').neq('status', 'archived'),
        firm.id
      ).order('name')
    ])

    setHistory((h.data as any) || [])
    setGroups((g.data as any) || [])
    setLoading(false)
  }, [supabase, firm])

  useEffect(() => { loadData(true) }, [loadData])

  const filtered = useMemo(() => {
    return history.filter(s => {
      // 1. Search (Member Name)
      const memberName = s.members?.persons?.name?.toLowerCase() || 'general calc'
      const matchesSearch = memberName.includes(searchTerm.toLowerCase())
      
      // 2. Group Filter
      const matchesGroup = !selectedGroupId || String(s.group_id) === selectedGroupId
      
      // 3. Date Range
      const createdAt = s.created_at.split('T')[0]
      const matchesStart = !dateRange.start || createdAt >= dateRange.start
      const matchesEnd = !dateRange.end || createdAt <= dateRange.end
      
      return matchesSearch && matchesGroup && matchesStart && matchesEnd
    })
  }, [history, searchTerm, selectedGroupId, dateRange])

  const stats = useMemo(() => {
    const totalVolume = filtered.reduce((sum, s) => sum + (s.month_14_balance || 0), 0)
    const count = filtered.length
    return { totalVolume, count }
  }, [filtered])

  async function handleDelete(id: number) {
    if (!firm || !can('deleteSettlement') || !confirm(t('delete_confirm'))) return
    const { error } = await supabase.from('settlements').update({ deleted_at: new Date() }).eq('id', id).eq('firm_id', firm.id)
    if (error) return show(error.message, 'error')
    show('Settlement record moved to trash/archive')
    logActivity(firm.id, 'SETTLEMENT_ARCHIVED', 'settlements', String(id))
    loadData()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-20">
      
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
           <button onClick={() => router.push('/settlement')} className="p-2.5 rounded-xl border hover:bg-[var(--surface2)] transition-colors">
              <ArrowLeft size={18} />
           </button>
           <div>
              <h1 className="text-2xl font-bold flex items-center gap-2">
                 <History size={24} className="text-[var(--accent)]" />
                 Settlement Audit Ledger
              </h1>
              <p className="text-sm opacity-60">Complete history and auditable paper trail for all prize money settlements.</p>
           </div>
        </div>
        <Btn variant="primary" icon={Calculator} onClick={() => router.push('/settlement')}>
           New Settlement
        </Btn>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
         <StatCard 
            label="Total Settled Payouts" 
            value={fmt(stats.totalVolume)} 
            color="success" 
            icon={TrendingUp}
         />
         <StatCard 
            label="Records Found" 
            value={stats.count} 
            color="info" 
            icon={FileText}
         />
      </div>

      {/* Filters Bar */}
      <div className="bg-[var(--surface)] p-4 rounded-2xl border flex flex-col lg:flex-row gap-4 lg:items-end no-print" style={{ borderColor: 'var(--border)' }}>
         <div className="flex-1 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">Search Member</label>
            <div className="relative">
               <input 
                  className={cn(inputClass, "pl-10")} 
                  style={inputStyle} 
                  value={searchTerm} 
                  onChange={e => setSearchTerm(e.target.value)}
                  placeholder="Find by member name..."
               />
               <Search size={18} className="absolute left-3 top-3 opacity-30" />
            </div>
         </div>

         <div className="w-full lg:w-48 space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">Filter Group</label>
            <div className="relative">
               <select 
                  className={cn(inputClass, "pl-10")} 
                  style={inputStyle}
                  value={selectedGroupId}
                  onChange={e => setSelectedGroupId(e.target.value)}
               >
                  <option value="">All Groups</option>
                  {groups.map(g => (
                    <option key={g.id} value={g.id}>{g.name}</option>
                  ))}
               </select>
               <Layers size={18} className="absolute left-3 top-3 opacity-30" />
            </div>
         </div>

         <div className="space-y-2">
            <label className="text-[10px] font-bold uppercase tracking-widest opacity-40 ml-1">Date Range</label>
            <div className="flex items-center gap-2">
               <input 
                  type="date" 
                  className={inputClass} 
                  style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }} 
                  value={dateRange.start}
                  onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))}
               />
               <span className="opacity-30">to</span>
               <input 
                  type="date" 
                  className={inputClass} 
                  style={{ ...inputStyle, padding: '8px 12px', fontSize: 13 }} 
                  value={dateRange.end}
                  onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}
               />
               {(dateRange.start || dateRange.end) && (
                 <button className="text-[10px] font-bold text-[var(--danger)] px-2" onClick={() => setDateRange({ start: '', end: '' })}>RESET</button>
               )}
            </div>
         </div>
      </div>

      {/* Results Table */}
      <Card className="overflow-hidden">
         <Table>
            <thead>
               <Tr>
                  <Th>Payout Date</Th>
                  <Th>Recipient / Group</Th>
                  <Th right>Total Bids (Input)</Th>
                  <Th right>Avg / Month</Th>
                  <Th right>Final Payout</Th>
                  <Th className="w-10 text-center">Action</Th>
               </Tr>
            </thead>
            <tbody>
               {filtered.length === 0 ? (
                  <Tr>
                     <Td colSpan={6} className="text-center py-20">
                        <div className="opacity-30 mb-2"><History size={48} className="mx-auto" /></div>
                        <div className="text-sm opacity-50">No settlement records found matching your filters.</div>
                     </Td>
                  </Tr>
               ) : filtered.map(s => (
                  <Tr key={s.id}>
                     <Td>
                        <div className="flex items-center gap-2">
                           <Calendar size={14} className="opacity-30" />
                           <div className="text-sm font-semibold">{fmtDate(s.created_at)}</div>
                        </div>
                     </Td>
                     <Td>
                        <div className="flex items-center gap-3">
                           <div className="w-8 h-8 rounded-full bg-[var(--surface2)] border flex items-center justify-center font-bold text-[10px]" style={{ borderColor: 'var(--border)' }}>
                              {(s.members?.persons?.name || 'G').charAt(0)}
                           </div>
                           <div>
                              <div className="font-bold text-sm tracking-tight">{s.members?.persons?.name || 'General Calculation'}</div>
                              <div className="text-[10px] opacity-40 uppercase font-black">{s.members?.groups?.name || 'OFF-BOOK CALC'}</div>
                           </div>
                        </div>
                     </Td>
                     <Td right className="font-mono text-xs opacity-60">{fmt(s.total_amount)}</Td>
                     <Td right className="text-xs">{fmt(s.average_per_month)}</Td>
                     <Td right>
                        <Badge variant="success" className="font-mono font-bold text-sm border-2 border-success-500/20">
                           {fmt(s.month_14_balance)}
                        </Badge>
                     </Td>
                     <Td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                           <button onClick={() => window.print()} className="p-1.5 opacity-50 hover:opacity-100 hover:bg-[var(--surface2)] rounded">
                              <Download size={14} />
                           </button>
                           {can('deleteSettlement') && (
                              <button onClick={() => handleDelete(s.id)} className="p-1.5 opacity-50 hover:opacity-100 hover:text-[var(--danger)]">
                                 <Trash2 size={14} />
                              </button>
                           )}
                        </div>
                     </Td>
                  </Tr>
               ))}
            </tbody>
         </Table>
      </Card>

    </div>
  )
}

import { TrendingUp } from "lucide-react"

export default function SettlementHistoryWrapped() {
  return (
    <Suspense fallback={<Loading />}>
       <SettlementHistoryPage />
    </Suspense>
  )
}
