'use client'

import React, { useMemo, useState, useCallback, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, Table, Th, Td, Tr, Badge, Loading, Btn, Field, Empty, Toast } from "@/components/ui"
import { 
  Calculator, Plus, Trash2, Save, User, ArrowRight, Layers, Calendar, 
  AlertCircle, TrendingUp, CheckCircle2, History, Printer, Sparkles,
  ChevronRight, RefreshCcw
} from "lucide-react"
import { fmt, fmtDate, getToday, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useFirm } from "@/lib/firm/context"
import { useI18n } from "@/lib/i18n/context"
import { useToast } from "@/lib/hooks/useToast"
import { useTerminology } from "@/lib/hooks/useTerminology"
import { logActivity } from "@/lib/utils/logger"
import { haptics } from "@/lib/utils/haptics"
import { withFirmScope } from "@/lib/supabase/firmQuery"
import { inputClass, inputStyle } from "@/components/ui"
import type { Member, Settlement, Person, Auction, Group } from "@/types"

type Entry = {
  date: string
  amount: number
  label?: string
}

type MemberWithDetails = Member & {
  persons?: Person
  groups?: { name: string, duration: number }
}

function SettlementPage() {
  const supabase = createClient()
  const { toast: toastState, show, hide } = useToast()
  const { t } = useI18n()
  const { firm, role, can } = useFirm()
  const term = useTerminology(firm)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const qGroupId = searchParams.get('groupId')

  const [entries, setEntries] = useState<Entry[]>([
    { date: getToday(), amount: 0, label: 'Initial' }
  ])
  
  const [groups, setGroups] = useState<Group[]>([])
  const [selectedGroupId, setSelectedGroupId] = useState<string>(qGroupId || '')
  const [members, setMembers] = useState<MemberWithDetails[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [selectedAuctionId, setSelectedAuctionId] = useState<string>('')
  const [history, setHistory] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [targetMonths, setTargetMonths] = useState<number>(15)
  const [viewMode, setViewMode] = useState<'calc' | 'history'>('calc')
  const [selectedAuctionCommission, setSelectedAuctionCommission] = useState<any>(null)

  const isSuper = role === 'superadmin'

  const onGroupChange = useCallback((gId: string) => {
    setSelectedGroupId(gId)
    setSelectedMemberId('')
    setSelectedAuctionId('')
    setAuctions([])
    
    const grp = groups.find(g => String(g.id) === gId)
    if (grp) setTargetMonths(grp.duration)
  }, [groups])

  useEffect(() => {
    if (qGroupId && groups.length > 0) onGroupChange(qGroupId)
  }, [qGroupId, groups.length, onGroupChange])

  /* ---------------- Calculations ---------------- */

  const totalAmount = useMemo(() => entries.reduce((sum, e) => sum + (e.amount || 0), 0), [entries])
  const averagePerMonth = useMemo(() => (targetMonths > 0) ? Math.round(totalAmount / targetMonths) : 0, [totalAmount, targetMonths])
  const settlementTotal = useMemo(() => averagePerMonth * (targetMonths - 1), [averagePerMonth, targetMonths])

  const balances = useMemo(() => {
    let balance = totalAmount
    return entries.map(entry => {
      balance -= (entry.amount || 0)
      return { running: balance }
    })
  }, [entries, totalAmount])

  /* ---------------- Actions ---------------- */

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = firm?.id
    if (!targetId && !isSuper) return

    try {
      const [grps, mems, hist] = await Promise.all([
        withFirmScope(supabase.from('groups').select('id, name, duration'), targetId),
        withFirmScope(supabase.from('members').select('id, group_id, person_id, persons(id, name), groups(id, name, duration)'), targetId),
        withFirmScope(supabase.from('settlements').select('id, total_amount, final_payout_amount, created_at, members(id, persons(name), groups(name))'), targetId)
          .order('created_at', { ascending: false }).limit(10)
      ])

      setGroups((grps.data as Group[]) || [])
      setMembers((mems.data as MemberWithDetails[]) || [])
      setHistory((hist.data as any) || [])
    } catch (err) {
      console.warn('Settlement Page Load Failed:', err)
    } finally {
      setLoading(false)
    }
  }, [supabase, firm, isSuper])

  useEffect(() => { load(true) }, [load])

  const autoFillGroupAuctions = async () => {
    if (!selectedGroupId || !firm) { show(t('select_group_first'), 'error'); return }
    setLoading(true)
    try {
      const { data: aucs } = await withFirmScope(
        supabase.from('auctions').select('month, net_payout').eq('group_id', Number(selectedGroupId)).eq('status', 'confirmed'),
        firm.id
      ).order('month', { ascending: true })

      if (!aucs || aucs.length === 0) { show('No confirmed auctions found for this group.', 'error'); return }

      const newEntries: Entry[] = (aucs as any[]).map((a: any) => ({
        date: getToday(),
        amount: Number(a.net_payout || 0),
        label: `Month ${a.month}`
      }))
      setEntries(newEntries)
      setTargetMonths(aucs.length)
      show(`Loaded ${aucs.length} auctions and synced duration!`, 'success')
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    if (!firm) return
    if (totalAmount <= 0) return show('Total amount must be greater than 0', 'error')
    
    setSaving(true)
    haptics.heavy()
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const mId = selectedMemberId ? Number(selectedMemberId) : null
      const selectedMember = members.find(m => m.id === mId)
      const gId = selectedMember?.group_id || (selectedGroupId ? Number(selectedGroupId) : null)

      const { error } = await supabase.from('settlements').insert({
        firm_id: firm.id,
        member_id: mId,
        group_id: gId,
        total_amount: totalAmount,
        total_months: targetMonths,
        average_per_month: averagePerMonth,
        final_payout_amount: settlementTotal,
        entries: entries,
        created_by: user?.id
      })

      if (error) throw error

      show(t('settlement_saved'), 'success')
      logActivity(firm.id, 'SETTLEMENT_SAVED', 'settlements', null, { total: totalAmount, member_id: mId })
      load()
      setViewMode('history')
    } catch (e: any) {
      show(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  const [isWinner, setIsWinner] = useState(false)
  const [actualPrize, setActualPrize] = useState<number | null>(null)

  const onMemberChange = async (mId: string) => {
    setSelectedMemberId(mId)
    setSelectedAuctionId('')
    setIsWinner(false)
    setActualPrize(null)
    if (!mId || !firm) { setAuctions([]); return }

    const selectedMem = members.find(m => String(m.id) === mId)
    if (selectedMem?.groups?.duration) setTargetMonths(selectedMem.groups.duration)

    // 1. Check if they won an auction
    const { data: winnerAucs } = await withFirmScope(
      supabase.from('auctions').select('id, month, is_payout_settled, net_payout, status').eq('winner_id', Number(mId)).eq('status', 'confirmed'),
      firm.id
    ).order('month', { ascending: false })
    
    if (winnerAucs && winnerAucs.length > 0) {
      setIsWinner(true)
      setActualPrize(Number(winnerAucs[0].net_payout || 0))
      setAuctions(winnerAucs)
      setSelectedAuctionId(String(winnerAucs[0].id))

      // Fetch breakdown details for the print voucher
      const { data: commData } = await withFirmScope(
        supabase.from('foreman_commissions').select('*').eq('auction_id', winnerAucs[0].id),
        firm.id
      ).single()
      setSelectedAuctionCommission(commData || null)
      
      // Auto-fill the entry with the actual prize
      setEntries([{ date: getToday(), amount: Number(winnerAucs[0].net_payout || 0), label: `Won Month ${winnerAucs[0].month}` }])
      setTargetMonths(1) // Winner settlement is 1:1
      show(`Member is winner of Month ${winnerAucs[0].month}. Prize: ${fmt(winnerAucs[0].net_payout)}`, 'success')
    } else {
      // 2. If not winner, load group auctions to calculate average
      setIsWinner(false)
      const gId = selectedMem?.group_id
      if (gId) {
        const { data: groupAucs } = await withFirmScope(
          supabase.from('auctions').select('month, net_payout').eq('group_id', gId).eq('status', 'confirmed'),
          firm.id
        ).order('month', { ascending: true })

        if (groupAucs && groupAucs.length > 0) {
          const newEntries: Entry[] = (groupAucs as any[]).map((a: any) => ({
            date: getToday(),
            amount: Number(a.net_payout || 0),
            label: `Month ${a.month}`
          }))
          setEntries(newEntries)
          setTargetMonths(groupAucs.length)
          show(`Calculating average based on ${groupAucs.length} auctions.`, 'success')
        }
      }
    }
  }

  const onAuctionChange = async (aId: string) => {
    setSelectedAuctionId(aId)
    if (!aId) return
    const auc = auctions.find(a => String(a.id) === aId)
    if (auc && auc.net_payout) {
      setActualPrize(Number(auc.net_payout))
      setEntries([{ date: getToday(), amount: Number(auc.net_payout), label: `Won Month ${auc.month}` }])
      setTargetMonths(1)

      const { data: commData } = await withFirmScope(
        supabase.from('foreman_commissions').select('*').eq('auction_id', Number(aId)),
        firm?.id
      ).single()
      setSelectedAuctionCommission(commData || null)
    }
  }

  if (loading) return <Loading />
  if (!can('viewSettlement')) return (
    <div className="flex items-center justify-center py-20 text-center">
      <div className="bg-[var(--surface2)] p-10 rounded-[3rem] border border-[var(--border)]">
        <div className="text-6xl mb-6">🔒</div>
        <div className="text-sm font-black uppercase tracking-widest opacity-40">{t('access_denied_settle')}</div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl pb-20 mx-auto">
      
      {/* Concept Guide - Unified */}
      <div className="bg-amber-500/5 border border-amber-500/20 p-5 rounded-[2rem] flex flex-col md:flex-row gap-5 no-print">
         <div className="w-12 h-12 rounded-2xl bg-amber-500 text-white flex items-center justify-center shrink-0 shadow-lg shadow-amber-500/20 mx-auto md:mx-0">
            <AlertCircle size={24} />
         </div>
         <div className="space-y-3 flex-1 text-center md:text-left">
            <h3 className="text-xs font-black uppercase tracking-widest text-amber-700">{t('settle_guide_title')}</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-blue-600 flex items-center justify-center md:justify-start gap-1">
                     <Sparkles size={10} /> {t('settle_guide_winners_title')}
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-60">{t('settle_guide_winners_desc')}</p>
               </div>
               <div className="space-y-1">
                  <p className="text-[10px] font-black uppercase text-emerald-600 flex items-center justify-center md:justify-start gap-1">
                     <TrendingUp size={10} /> {t('settle_guide_non_winners_title')}
                  </p>
                  <p className="text-[11px] leading-relaxed opacity-60">{t('settle_guide_non_winners_desc')}</p>
               </div>
            </div>
         </div>
         <div className="shrink-0 border-l border-amber-500/10 pl-5 hidden md:block max-w-[200px]">
            <p className="text-[9px] font-black uppercase text-amber-600/40 mb-1">{t('settle_audit_ready')}</p>
            <p className="text-[10px] leading-tight opacity-40">{t('settle_audit_desc')}</p>
         </div>
      </div>

      {/* Unified Top Navigation & Filter Bar */}
      <div className="no-print bg-[var(--surface2)] p-6 rounded-[2.5rem] border border-[var(--border)] flex flex-col md:flex-row items-center justify-between gap-4 shadow-sm">
        <div className="flex items-center gap-4 w-full md:w-auto">
           <div className="w-12 h-12 rounded-2xl bg-[var(--accent)] text-white flex items-center justify-center shadow-lg shrink-0">
              <Calculator size={24} />
           </div>
           <div className="flex flex-col">
              <h1 className="text-xl font-black tracking-tight uppercase">{term.settlementLabel}</h1>
              <div className="flex gap-2">
                 <button onClick={() => setViewMode('calc')} className={cn("text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'calc' ? "text-[var(--accent)]" : "opacity-30")}>{t('settle_calculator')}</button>
                 <span className="opacity-10">|</span>
                 <button onClick={() => setViewMode('history')} className={cn("text-[10px] font-black uppercase tracking-widest transition-all", viewMode === 'history' ? "text-[var(--accent)]" : "opacity-30")}>{t('settle_records')}</button>
              </div>
           </div>
        </div>

        {viewMode === 'calc' && (
          <div className="flex flex-wrap items-center gap-3 w-full md:w-auto">
             <select className={cn(inputClass, "w-40 bg-[var(--surface)]")} style={inputStyle} value={selectedGroupId} onChange={e => onGroupChange(e.target.value)}>
                <option value="">{t('all_groups')}</option>
                {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
             </select>
             <select className={cn(inputClass, "w-52 bg-[var(--surface)]")} style={inputStyle} value={selectedMemberId} onChange={e => onMemberChange(e.target.value)}>
                <option value="">{t('manual_calc')}</option>
                {members.filter(m => !selectedGroupId || String(m.group_id) === selectedGroupId).map(m => (
                   <option key={m.id} value={m.id}>{m.persons?.name} ({m.groups?.name})</option>
                ))}
             </select>
             <Btn onClick={handleSave} icon={Save} loading={saving} variant="primary" className="py-5 px-8 shadow-xl">
               {t('save_record').toUpperCase()}
             </Btn>
          </div>
        )}
      </div>

      {viewMode === 'history' ? (
        <Card title={t('settlement_history')} subtitle={t('history_desc')} className="animate-in fade-in slide-in-from-bottom-4 duration-500">
           <Table>
              <thead>
                 <tr>
                    <Th>{t('date')}</Th>
                    <Th>{t('member_group')}</Th>
                    <Th right>{t('amount')}</Th>
                    <Th right>{term.payoutLabel}</Th>
                    <Th className="text-center w-20">{t('action')}</Th>
                 </tr>
              </thead>
              <tbody>
                 {history.length === 0 && <Tr><Td colSpan={5}><Empty text={t('settle_no_history')} /></Td></Tr>}
                 {history.map(s => (
                    <Tr key={s.id} className="group hover:bg-[var(--surface2)] transition-colors">
                       <Td><div className="text-[10px] font-bold opacity-40">{fmtDate(s.created_at)}</div></Td>
                       <Td>
                          <div className="flex items-center gap-3">
                             <div className="w-8 h-8 rounded-xl bg-[var(--surface2)] flex items-center justify-center group-hover:bg-[var(--accent-dim)] group-hover:text-[var(--accent)] transition-all">
                               <User size={14} />
                             </div>
                             <div>
                                <div className="font-black text-xs uppercase tracking-tight">{s.members?.persons?.name || t('settle_general_calc')}</div>
                                <div className="text-[10px] font-bold opacity-30 uppercase tracking-widest">{s.members?.groups?.name || t('settle_manual')}</div>
                             </div>
                          </div>
                       </Td>
                       <Td right className="font-bold text-sm">{fmt(s.total_amount)}</Td>
                       <Td right><Badge variant="accent" className="font-black">{fmt(s.final_payout_amount)}</Badge></Td>
                       <Td className="text-center">
                          <div className="flex items-center justify-center gap-2">
                             <button 
                                onClick={() => {
                                  // Load record into current view for printing
                                  setEntries(s.entries as Entry[])
                                  setTargetMonths(s.total_months)
                                  setSelectedMemberId(String(s.member_id))
                                  setSelectedGroupId(String(s.group_id))
                                  setTimeout(() => window.print(), 100)
                                }}
                                className="p-2 opacity-0 group-hover:opacity-100 hover:text-[var(--accent)] transition-all"
                              >
                                <Printer size={14} />
                              </button>
                             {can('deleteSettlement') && (
                               <button onClick={() => { if(confirm(t('delete_confirm'))) supabase.from('settlements').delete().eq('id', s.id).then(() => load()) }} 
                                 className="p-2 opacity-0 group-hover:opacity-100 hover:text-rose-500 transition-all">
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
      ) : (
        <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
           
           {/* Simple Status Indicator */}
           {selectedMemberId && (
              <div className="flex flex-col items-start gap-2 mb-4">
                <div className={cn("px-6 py-2 rounded-full inline-flex items-center gap-2 text-[9px] font-black uppercase tracking-widest border", isWinner ? "bg-blue-500/10 text-blue-600 border-blue-500/20" : "bg-emerald-500/10 text-emerald-600 border-emerald-500/20")}>
                   {isWinner ? <Sparkles size={12} /> : <TrendingUp size={12} />}
                   {isWinner ? t('settle_auction_payout') : t('settle_group_settlement')}
                </div>
                <p className="text-[10px] font-medium opacity-40 max-w-lg leading-tight">
                   {isWinner ? t('settle_winner_note') : t('settle_non_winner_note')}
                </p>
              </div>
           )}

           <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 items-start">
             
             {/* Left: Entries Table */}
             <div className="lg:col-span-2">
                <Card 
                  title={isWinner ? t('settle_auction_record') : t('monthly_entry')} 
                  headerAction={
                    !isWinner && (
                      <div className="flex gap-2">
                        <Btn size="sm" variant="secondary" icon={RefreshCcw} onClick={autoFillGroupAuctions} className="text-[9px]">{t('settle_sync_history')}</Btn>
                        <Btn size="sm" variant="ghost" icon={Plus} onClick={() => setEntries([...entries, { date: getToday(), amount: 0, label: `Month ${entries.length + 1}` }])}>{t('settle_add')}</Btn>
                      </div>
                    )
                  }
                >
                  <Table>
                    <thead>
                      <tr className="bg-[var(--surface2)]">
                        <Th className="w-12 text-center">#</Th>
                        <Th>{t('label') || t('settle_reference')}</Th>
                        <Th right>{t('amount')} (₹)</Th>
                        {!isWinner && <Th className="w-10"></Th>}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[var(--border)]">
                      {entries.map((entry, index) => (
                        <Tr key={index} className="hover:bg-[var(--surface2)]/50">
                          <Td className="text-center"><span className="text-[10px] font-black opacity-20">{index + 1}</span></Td>
                          <Td>
                            <input
                              type="text"
                              disabled={isWinner}
                              className="bg-transparent border-none outline-none text-xs font-bold w-full p-0 uppercase tracking-tighter disabled:opacity-40"
                              style={{ color: 'var(--text)' }}
                              value={entry.label || ''}
                              placeholder={`${t('settle_entry_placeholder')} ${index + 1}`}
                              onChange={e => { const u = [...entries]; u[index].label = e.target.value; setEntries(u); }}
                            />
                          </Td>
                          <Td right>
                            <input
                              type="number"
                              disabled={isWinner}
                              className="bg-transparent border-none outline-none text-right font-black text-sm w-full p-0"
                              style={{ color: isWinner ? 'var(--text)' : 'var(--accent)' }}
                              value={entry.amount || ''}
                              placeholder="0"
                              onChange={e => { const u = [...entries]; u[index].amount = Number(e.target.value || 0); setEntries(u); }}
                            />
                          </Td>
                          {!isWinner && (
                            <Td className="text-center">
                               <button onClick={() => setEntries(entries.filter((_, i) => i !== index))} 
                                  className="p-1.5 opacity-20 hover:opacity-100 hover:text-rose-500 transition-all">
                                  <Trash2 size={14} />
                               </button>
                            </Td>
                          )}
                        </Tr>
                      ))}
                    </tbody>
                  </Table>
                  <div className="mt-6 flex justify-between items-center px-4 border-t pt-4">
                     <div className="text-[10px] font-black uppercase tracking-widest opacity-30">
                        {isWinner ? t('settle_direct_record') : t('settle_formula_average')}
                     </div>
                     {!isWinner && (
                        <div className="flex items-center gap-4">
                           <div className="flex items-center gap-2">
                              <span className="text-[10px] font-bold opacity-40 uppercase">{t('settle_total_duration')}:</span>
                              <input type="number" className="w-16 bg-transparent border-b border-[var(--border)] text-xs font-black text-center outline-none" 
                                value={targetMonths} onChange={e => setTargetMonths(parseInt(e.target.value) || 1)} />
                           </div>
                        </div>
                     )}
                  </div>
                </Card>
             </div>

             {/* Right: Summary Statement */}
             <div className="space-y-6">
                <div className={cn("p-8 rounded-[2.5rem] border-2 shadow-xl relative overflow-hidden", isWinner ? "bg-blue-600 text-white border-blue-400" : "bg-[var(--surface)] border-[var(--border)]")}>
                   <div className="relative z-10 space-y-8">
                      <div className="flex justify-between items-start">
                         <div>
                            <p className={cn("text-[10px] font-black uppercase tracking-[0.2em] mb-2", isWinner ? "text-blue-200" : "opacity-30")}>{t('settle_final_statement')}</p>
                            <h2 className="text-3xl font-black tracking-tighter">{fmt(isWinner ? actualPrize : settlementTotal)}</h2>
                         </div>
                         <Badge variant={isWinner ? 'info' : 'accent'} className="font-black uppercase">{term.payoutLabel}</Badge>
                      </div>

                      <div className="space-y-4 pt-6 border-t border-dashed border-current/20">
                         {!isWinner && (
                           <>
                             <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase opacity-60">{t('total_amount_sum')}</span>
                                <span className="text-xs font-black">{fmt(totalAmount)}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase opacity-60">{t('avg_per_month')}</span>
                                <span className="text-xs font-black">{fmt(averagePerMonth)}</span>
                             </div>
                             <div className="flex justify-between items-center">
                                <span className="text-[10px] font-bold uppercase opacity-60">{t('settlement_factor')}</span>
                                <span className="text-xs font-black">× {targetMonths - 1} {t('duration')}</span>
                             </div>

                             {/* Visual Math Breakdown */}
                             <div className="mt-4 p-3 rounded-xl bg-black/5 dark:bg-white/5 border border-current/10 space-y-1">
                                <div className="text-[9px] font-black uppercase opacity-40 tracking-widest">{t('settle_formula_breakdown')}</div>
                                <div className="flex items-center flex-wrap gap-x-2 gap-y-1 font-mono text-[11px]">
                                   <span className={isWinner ? "text-white" : "text-[var(--accent)]"}>{fmt(totalAmount)}</span>
                                   <span className="opacity-30">÷</span>
                                   <span className="font-black">{targetMonths}m</span>
                                   <span className="opacity-30">×</span>
                                   <span className="font-black">{targetMonths - 1}m</span>
                                   <span className="opacity-30">=</span>
                                   <span className={isWinner ? "text-white" : "text-[var(--success)]"}>{fmt(settlementTotal)}</span>
                                </div>
                             </div>
                           </>
                         )}
                         {isWinner && (
                           <div className="flex justify-between items-center">
                              <span className="text-[10px] font-bold uppercase text-blue-100">{t('settle_winner_month')}</span>
                              <span className="text-xs font-black">{t('month_no')} {auctions[0]?.month}</span>
                           </div>
                         )}
                      </div>

                      <Btn variant={isWinner ? 'secondary' : 'primary'} className="w-full py-6 rounded-2xl shadow-lg" icon={Printer} onClick={() => window.print()}>
                         {t('settle_print_doc')}
                      </Btn>
                   </div>
                </div>

                <div className="p-6 rounded-[2rem] bg-[var(--surface2)] border border-[var(--border)]">
                   <div className="flex gap-3 items-start">
                      <AlertCircle size={16} className="shrink-0 mt-0.5 opacity-40" />
                      <p className="text-[10px] font-medium leading-relaxed opacity-50">
                         {t('settle_verify_general')} {isWinner ? t('settle_verify_note_winner') : t('settle_verify_note_non_winner')}
                      </p>
                   </div>
                </div>
             </div>

           </div>
        </div>
      )}

      {/* ── Premium Voucher View (Print Only) ── */}
      <div className="only-print p-12 bg-white text-black font-sans">
         {/* Header */}
         <div className="flex justify-between items-end mb-12 border-b-4 border-slate-900 pb-8">
            <div className="space-y-1">
               <h1 className="text-4xl font-black uppercase tracking-tighter text-slate-900">
                  {isWinner ? t('auction_payout_voucher') : t('settlement_voucher')}
               </h1>
               <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-widest text-slate-400">
                  <span>ChitVault Audit Certified</span>
                  <div className="w-1 h-1 rounded-full bg-slate-200" />
                  <span>
                    {isWinner 
                      ? `Ref: AUC-${groups.find(g => String(g.id) === selectedGroupId)?.name.slice(0,3)}-${auctions.find(a => String(a.id) === selectedAuctionId)?.month}`
                      : `Ref: SET-${targetMonths}-${Date.now().toString().slice(-6)}`
                    }
                  </span>
               </div>
            </div>
            <div className="text-right">
               <h2 className="text-xl font-black uppercase tracking-tight">{firm?.name || 'ChitVault Firm'}</h2>
               <p className="text-xs font-bold text-slate-400 uppercase tracking-widest">{firm?.address || 'Premium Ledger Management'}</p>
            </div>
         </div>

         {/* Info Grid */}
         <div className="grid grid-cols-2 gap-x-12 gap-y-8 mb-12">
            <div className="space-y-6">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b pb-2">
                  {isWinner ? t('winner') : t('member_directory')}
               </h4>
               <div className="space-y-3">
                  <div className="flex flex-col">
                     <span className="text-[10px] font-bold uppercase text-slate-400">{t('member_name')}</span>
                     <span className="text-lg font-black">{members.find(m => String(m.id) === selectedMemberId)?.persons?.name || '—'}</span>
                  </div>
                  <div className="flex flex-col">
                     <span className="text-[10px] font-bold uppercase text-slate-400">{t('group_name_label')}</span>
                     <span className="text-base font-bold">{groups.find(g => String(g.id) === selectedGroupId)?.name || '—'}</span>
                  </div>
               </div>
            </div>

            <div className="space-y-6">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b pb-2">
                  {isWinner ? t('payout_amt') : t('settle_final_figures')}
               </h4>
               <div className="bg-slate-50 border-2 border-slate-900 p-6 rounded-2xl relative overflow-hidden">
                  <div className="relative z-10">
                     <span className="text-[10px] font-black uppercase tracking-widest text-slate-500 mb-1 block">
                        {isWinner ? t('net_payout') : t('settle_final_payout')}
                     </span>
                     <div className="text-4xl font-black tracking-tighter text-slate-900">
                        {fmt(isWinner ? actualPrize : settlementTotal)}
                     </div>
                  </div>
                  <div className="absolute top-0 right-0 p-4 opacity-10">
                     <span className="text-6xl font-black">✓</span>
                  </div>
               </div>
            </div>
         </div>

         {/* Logic Section */}
         {isWinner ? (
            /* Auction Breakdown Box */
            <div className="mb-12 border-2 border-slate-900 rounded-[2.5rem] overflow-hidden">
               <div className="bg-white border-b-2 border-slate-900 p-8 text-center">
                  <span className="text-[10px] font-black uppercase tracking-[0.3em] text-slate-400">{t('payout_amt')}</span>
                  <div className="text-6xl font-black tracking-tighter mt-1 text-slate-900">{fmt(actualPrize)}</div>
               </div>
               <div className="p-10 space-y-6 bg-slate-50/50">
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                     <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">{t('gross_chit_value')}</span>
                     <span className="text-lg font-black">
                        {fmt(selectedAuctionCommission?.chit_value || (groups.find(g => String(g.id) === selectedGroupId)?.monthly_contribution! * groups.find(g => String(g.id) === selectedGroupId)?.duration!))}
                     </span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                     <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">{t('winning_bid_label')}</span>
                     <span className="text-lg font-black text-slate-900">- {fmt(auctions.find(a => String(a.id) === selectedAuctionId)?.auction_discount)}</span>
                  </div>
                  <div className="flex justify-between items-center pb-4 border-b border-slate-200">
                     <span className="text-xs font-bold uppercase text-slate-400 tracking-widest">{t('foreman_commission')}</span>
                     <span className="text-lg font-black text-slate-900">- {fmt(selectedAuctionCommission?.commission_amt || 0)}</span>
                  </div>
                  <div className="flex justify-between items-center pt-2">
                     <span className="text-sm font-black uppercase text-slate-900 tracking-[0.1em]">{t('net_payout')}</span>
                     <span className="text-2xl font-black text-slate-900">{fmt(actualPrize)}</span>
                  </div>
               </div>
            </div>
         ) : (
            /* Formula Breakdown Box */
            <div className="mb-12 p-8 border-2 border-dashed border-slate-200 rounded-3xl bg-slate-50/50">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 mb-6">{t('formula_breakdown')}</h4>
               <div className="flex flex-col sm:flex-row items-center justify-between gap-8">
                  <div className="text-center sm:text-left">
                     <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('total_amount_sum')}</div>
                     <div className="text-xl font-black">{fmt(totalAmount)}</div>
                  </div>
                  <div className="text-2xl font-light text-slate-300">÷</div>
                  <div className="text-center">
                     <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('duration')}</div>
                     <div className="text-xl font-black">{targetMonths}</div>
                  </div>
                  <div className="text-2xl font-light text-slate-300">×</div>
                  <div className="text-center">
                     <div className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-1">{t('settle_duration_label')}</div>
                     <div className="text-xl font-black">{targetMonths - 1}</div>
                  </div>
                  <div className="text-2xl font-bold text-slate-900">=</div>
                  <div className="text-center sm:text-right">
                     <div className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-1">{t('settle_final_payout')}</div>
                     <div className="text-xl font-black text-[var(--accent)]">{fmt(settlementTotal)}</div>
                  </div>
               </div>
            </div>
         )}

         {/* Entry Table (Only for non-winners or optional) */}
         {!isWinner && (
            <div className="mb-16">
               <h4 className="text-[10px] font-black uppercase tracking-[0.2em] text-slate-400 border-b pb-4 mb-4">{t('settle_breakdown_registry')}</h4>
               <table className="w-full border-collapse">
                  <thead>
                     <tr className="bg-slate-50">
                        <th className="p-4 text-left text-[10px] font-black uppercase tracking-widest border-b-2 border-slate-900">{t('settle_month_tag')}</th>
                        <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-b-2 border-slate-900">{t('amount')}</th>
                        <th className="p-4 text-right text-[10px] font-black uppercase tracking-widest border-b-2 border-slate-900">{t('book_balance')}</th>
                     </tr>
                  </thead>
                  <tbody>
                     {entries.map((e, i) => (
                        <tr key={i} className="border-b border-slate-100">
                           <td className="p-4 text-sm font-bold">{e.label || `${t('auction_month')} ${i+1}`}</td>
                           <td className="p-4 text-right text-sm font-black">{fmt(e.amount)}</td>
                           <td className="p-4 text-right text-xs font-medium text-slate-400 italic">{fmt(balances[i]?.running)}</td>
                        </tr>
                     ))}
                  </tbody>
               </table>
            </div>
         )}

         {/* Footer / Signatures */}
         <div className="grid grid-cols-2 gap-20 mt-auto pt-20">
            <div className="text-center space-y-4">
               <div className="h-px bg-slate-900 w-full" />
               <p className="text-[10px] font-black uppercase tracking-widest">{t('settle_member_sign')}</p>
               <p className="text-[8px] text-slate-400 uppercase tracking-widest">(Acknowledged with thanks)</p>
            </div>
            <div className="text-center space-y-4">
               <div className="h-px bg-slate-900 w-full" />
               <p className="text-[10px] font-black uppercase tracking-widest">{t('settle_manager_sign')}</p>
               <p className="text-[8px] text-slate-400 uppercase tracking-widest">({firm?.name || 'ChitVault Management'})</p>
            </div>
         </div>

         <div className="mt-20 text-center text-[8px] text-slate-300 font-bold uppercase tracking-[0.4em]">
            Digital Record Generated via ChitVault Enterprise Engine • {new Date().toLocaleString()}
         </div>
      </div>

      {toastState && <Toast msg={toastState.msg} type={toastState.type} onClose={hide} />}
    </div>
  )
}

export default function SettlementPageWrapped() {
  return (
    <Suspense fallback={<Loading />}>
      <SettlementPage />
    </Suspense>
  )
}
