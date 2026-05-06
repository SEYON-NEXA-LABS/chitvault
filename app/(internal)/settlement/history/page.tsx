'use client'

import React, { useMemo, useState, useCallback, useEffect, Suspense } from "react"
import { useRouter } from 'next/navigation'
import { Card, Table, Th, Td, Tr, Badge, Loading, Btn, Field, StatCard, Empty } from "@/components/ui"
import { 
  Calculator, Search, Filter, Calendar, User, 
  Layers, ArrowLeft, History, FileText, Download, Trash2, TrendingUp, Printer
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
        supabase.from('settlements').select('id, created_at, group_id, total_amount, average_per_month, final_payout_amount, members(id, persons(name, phone), groups(id, name, duration))'),
        firm.id
      ).is('deleted_at', null).order('created_at', { ascending: false }),
      withFirmScope(
        supabase.from('groups').select('id, name').neq('status', 'archived'),
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
      const memberName = s.members?.persons?.name?.toLowerCase() || 'general calc'
      const matchesSearch = memberName.includes(searchTerm.toLowerCase())
      const matchesGroup = !selectedGroupId || String(s.group_id) === selectedGroupId
      const createdAt = s.created_at.split('T')[0]
      const matchesStart = !dateRange.start || createdAt >= dateRange.start
      const matchesEnd = !dateRange.end || createdAt <= dateRange.end
      return matchesSearch && matchesGroup && matchesStart && matchesEnd
    })
  }, [history, searchTerm, selectedGroupId, dateRange])

  const stats = useMemo(() => {
    const totalVolume = filtered.reduce((sum, s) => sum + (s.final_payout_amount || 0), 0)
    const count = filtered.length
    return { totalVolume, count }
  }, [filtered])

  async function handleDelete(id: number) {
    if (!firm || !can('deleteSettlement') || !confirm(t('delete_confirm'))) return
    const { error } = await supabase.from('settlements').update({ deleted_at: new Date() }).eq('id', id).eq('firm_id', firm.id)
    if (error) return show(error.message, 'error')
    show(t('delete_success'))
    logActivity(firm.id, 'SETTLEMENT_ARCHIVED', 'settlements', String(id))
    loadData()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-20 animate-in fade-in duration-500">
      
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="flex items-center gap-4">
           <button onClick={() => router.push('/settlement')} className="w-12 h-12 rounded-2xl bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-center hover:bg-[var(--accent-dim)] hover:text-[var(--accent)] transition-all">
              <ArrowLeft size={20} />
           </button>
           <div>
              <h1 className="text-3xl font-black tracking-tighter text-[var(--text)]">
                 {t('audit_log')}
              </h1>
              <p className="text-[var(--text-xs)] font-bold opacity-40 uppercase tracking-widest flex items-center gap-2">
                 <span className="w-1.5 h-1.5 rounded-full bg-[var(--accent)]" />
                 {t('history_desc')}
              </p>
           </div>
        </div>
        <Btn variant="primary" icon={Calculator} onClick={() => router.push('/settlement')} className="py-6 px-8 shadow-xl shadow-[var(--accent-dim)]">
           {t('new_entry') || 'New Settlement'}
        </Btn>
      </div>

      {/* Stats Summary */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
         <div className="p-8 rounded-[2.5rem] bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-between">
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Total Settled Payouts</p>
               <p className="text-3xl font-black text-[var(--success)] tracking-tighter">{fmt(stats.totalVolume)}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-emerald-500/10 text-emerald-500 flex items-center justify-center">
               <TrendingUp size={24} />
            </div>
         </div>
         <div className="p-8 rounded-[2.5rem] bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-between">
            <div>
               <p className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">Records Found</p>
               <p className="text-3xl font-black text-[var(--info)] tracking-tighter">{stats.count}</p>
            </div>
            <div className="w-12 h-12 rounded-2xl bg-blue-500/10 text-blue-500 flex items-center justify-center">
               <FileText size={24} />
            </div>
         </div>
      </div>

      {/* Filters Bar */}
      <div className="bg-[var(--surface2)] p-6 rounded-[2rem] border border-[var(--border)] flex flex-col lg:flex-row gap-6 lg:items-end no-print">
         <div className="flex-1 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">{t('search_registry_placeholder') || 'Search Member'}</label>
            <div className="relative">
               <input className={cn(inputClass, "pl-10")} style={inputStyle} value={searchTerm} onChange={e => setSearchTerm(e.target.value)} placeholder="Name or group..." />
               <Search size={18} className="absolute left-3.5 top-3 opacity-20" />
            </div>
         </div>

         <div className="w-full lg:w-64 space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">{t('select_group')}</label>
            <select className={inputClass} style={inputStyle} value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
               <option value="">{t('all_groups')}</option>
               {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
         </div>

         <div className="space-y-2">
            <label className="text-[10px] font-black uppercase tracking-[0.2em] opacity-40 ml-1">Date Range</label>
            <div className="flex items-center gap-3">
               <input type="date" className={inputClass} style={{ ...inputStyle, padding: '10px 14px' }} value={dateRange.start} onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))} />
               <span className="text-[10px] font-black opacity-20 uppercase">to</span>
               <input type="date" className={inputClass} style={{ ...inputStyle, padding: '10px 14px' }} value={dateRange.end} onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))} />
            </div>
         </div>
      </div>

      {/* Results Table */}
      <Card className="overflow-hidden">
         <Table>
            <thead>
               <tr className="bg-[var(--surface2)]">
                  <Th>{t('date')}</Th>
                  <Th>{t('member_group')}</Th>
                  <Th right>Bids Total</Th>
                  <Th right>{t('avg_per_month_label')}</Th>
                  <Th right>{t('final_settlement')}</Th>
                  <Th className="w-20 text-center">{t('action')}</Th>
               </tr>
            </thead>
            <tbody>
               {filtered.length === 0 ? (
                  <Tr><Td colSpan={6} className="py-20"><Empty text="No matching records found." /></Td></Tr>
               ) : filtered.map(s => (
                  <Tr key={s.id} className="group hover:bg-[var(--surface2)]/50 transition-colors">
                     <Td>
                        <div className="text-[var(--text-xs)] font-bold text-slate-500 uppercase">{fmtDate(s.created_at)}</div>
                     </Td>
                     <Td>
                        <div className="flex items-center gap-3">
                           <div className="w-9 h-9 rounded-xl bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-center font-black text-[10px] group-hover:bg-[var(--accent)] group-hover:text-white transition-all">
                              {(s.members?.persons?.name || 'G').charAt(0)}
                           </div>
                           <div>
                              <div className="font-black text-xs uppercase tracking-tight">{s.members?.persons?.name || 'General Calculation'}</div>
                              <div className="text-[10px] font-bold opacity-30 uppercase tracking-widest">{s.members?.groups?.name || 'Manual'}</div>
                           </div>
                        </div>
                     </Td>
                     <Td right className="text-[var(--text-xs)] font-bold opacity-40">{fmt(s.total_amount)}</Td>
                     <Td right className="text-[var(--text-xs)] font-black text-[var(--success)]">{fmt(s.average_per_month)}</Td>
                     <Td right>
                        <Badge variant="accent" className="font-black text-xs">
                           {fmt(s.final_payout_amount)}
                        </Badge>
                     </Td>
                     <Td className="text-center">
                        <div className="flex items-center justify-center gap-1">
                           <button className="p-2 opacity-0 group-hover:opacity-100 hover:text-[var(--accent)] transition-all">
                              <Printer size={15} />
                           </button>
                           {can('deleteSettlement') && (
                              <button onClick={() => handleDelete(s.id)} className="p-2 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all">
                                 <Trash2 size={15} />
                              </button>
                           )}
                        </div>
                     </Td>
                  </Tr>
               ))}
            </tbody>
         </Table>
      </Card>

      {/* Persistence Note */}
      <div className="no-print mt-10 p-10 rounded-[3rem] bg-[var(--surface2)] border border-dashed border-[var(--border)] text-center">
          <div className="w-16 h-16 rounded-full bg-blue-500/10 text-blue-500 flex items-center justify-center mx-auto mb-4">
             <Calculator size={32} />
          </div>
          <h3 className="text-xl font-black tracking-tighter mb-2">Need a new calculation?</h3>
          <p className="text-sm opacity-50 mb-6 max-w-md mx-auto">Click below to go back to the settlement calculator and generate a new payout estimate.</p>
          <Btn variant="secondary" onClick={() => router.push('/settlement')}>Go to Calculator</Btn>
      </div>

    </div>
  )
}

export default function SettlementHistoryWrapped() {
  return (
    <Suspense fallback={<Loading />}>
       <SettlementHistoryPage />
    </Suspense>
  )
}
