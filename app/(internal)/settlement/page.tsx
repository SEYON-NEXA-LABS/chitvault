'use client'

import React, { useMemo, useState, useCallback, useEffect, Suspense } from "react"
import { useSearchParams, useRouter } from 'next/navigation'
import { Card, Table, Th, Td, Tr, Badge, Loading, Btn, Field } from "@/components/ui"
import { Calculator, Plus, Trash2, Save, User, ArrowRight, Layers, Calendar, AlertCircle, TrendingUp, CheckCircle2, History } from "lucide-react"
import { fmt, fmtDate, getToday, cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useFirm } from "@/lib/firm/context"
import { useI18n } from "@/lib/i18n/context"
import { useToast } from "@/lib/hooks/useToast"
import { useTerminology } from "@/lib/hooks/useTerminology"
import { logActivity } from "@/lib/utils/logger"
import { withFirmScope } from "@/lib/supabase/firmQuery"
import { inputClass, inputStyle } from "@/components/ui"
import type { Member, Settlement, Person, Auction, Group } from "@/types"

type Entry = {
  date: string
  amount: number
}

type MemberWithDetails = Member & {
  firms?: { name: string }
  persons?: Person
  groups?: { name: string, duration: number }
}

function SettlementPage() {
  const supabase = createClient()
  const { show } = useToast()
  const { t } = useI18n()
  const { firm, role, can } = useFirm()
  const term = useTerminology(firm)
  
  const searchParams = useSearchParams()
  const router = useRouter()
  const qGroupId = searchParams.get('groupId')

  const [entries, setEntries] = useState<Entry[]>([
    { date: getToday(), amount: 0 }
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

  const isSuper = role === 'superadmin'

  const onGroupChange = useCallback((gId: string) => {
    setSelectedGroupId(gId)
    setSelectedMemberId('')
    setSelectedAuctionId('')
    setAuctions([])
    
    const grp = groups.find(g => String(g.id) === gId)
    if (grp) setTargetMonths(grp.duration)
  }, [groups])

  // Handle Query Param Auto-select
  useEffect(() => {
    if (qGroupId && groups.length > 0) {
      onGroupChange(qGroupId)
    }
  }, [qGroupId, groups.length, onGroupChange])

  /* ---------------- Calculations ---------------- */

  const totalAmount = useMemo(
    () => entries.reduce((sum, e) => sum + (e.amount || 0), 0),
    [entries]
  )

  const averagePerMonth = useMemo(() => {
    if (targetMonths <= 0) return 0
    return Math.round(totalAmount / targetMonths)
  }, [totalAmount, targetMonths])

  /* Running & Closing Balances */
  const balances = useMemo(() => {
    let balance = totalAmount

    return entries.map(entry => {
      balance -= (entry.amount || 0)

      return {
        running: balance,
        closing: balance 
      }
    })
  }, [entries, totalAmount])

  const settlementTotal = useMemo(() => {
    return averagePerMonth * (targetMonths - 1)
  }, [averagePerMonth, targetMonths])

  /* ---------------- Persistence ---------------- */

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = firm?.id
    if (!targetId && !isSuper) return

    // Load Groups
    const { data: grps } = await withFirmScope(
       supabase.from('groups').select('id, name, duration'),
       targetId
    )
    setGroups((grps as Group[]) || [])

    // Load Members
    const { data: mems } = await withFirmScope(
       supabase.from('members').select('id, group_id, person_id, persons(id, name), groups(id, name, duration)'),
       targetId
    )
    setMembers((mems as MemberWithDetails[]) || [])

    // Load Settlement History (Recent 5)
    const { data: hist } = await withFirmScope(
       supabase.from('settlements').select('id, total_amount, month_14_balance, created_at, members(id, persons(name), groups(name))'),
       targetId
    ).order('created_at', { ascending: false }).limit(5)
    
    setHistory((hist as any) || [])
    
    setLoading(false)
  }, [supabase, firm, isSuper])

  useEffect(() => { load(true) }, [load])

  async function handleSave() {
    if (!firm) return
    if (totalAmount <= 0) return show('Total amount must be greater than 0', 'error')
    
    setSaving(true)
    try {
      const { data: { user } } = await supabase.auth.getUser()
      const mId = selectedMemberId ? Number(selectedMemberId) : null
      const selectedMember = members.find(m => m.id === mId)
      const gId = selectedMember?.group_id || null

      const { error } = await supabase.from('settlements').insert({
        firm_id: firm.id,
        member_id: mId,
        group_id: gId,
        total_amount: totalAmount,
        total_months: targetMonths,
        average_per_month: averagePerMonth,
        month_14_balance: settlementTotal,
        entries: entries,
        created_by: user?.id
      })

      if (error) throw error

      show(t('settlement_saved'), 'success')
      logActivity(firm.id, 'SETTLEMENT_SAVED', 'settlements', null, { 
        total: totalAmount, 
        member_id: mId 
      })
      
      load() // Refresh history
    } catch (e: any) {
      show(e.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  async function deleteSettlement(id: number) {
     if (!firm || !can('deleteSettlement')) return
     if (!confirm(t('delete_confirm'))) return
     
     const { error } = await supabase.from('settlements').delete().eq('id', id).eq('firm_id', firm.id)
     if (error) return show(error.message, 'error')
     
     show('Settlement deleted')
     logActivity(firm.id, 'SETTLEMENT_DELETED', 'settlements', String(id))
     load()
  }

  const onMemberChange = async (mId: string) => {
    setSelectedMemberId(mId)
    setSelectedAuctionId('')
    if (!mId) { setAuctions([]); return }

    // Auto-fill Target Duration from Group
    const selectedMem = members.find(m => String(m.id) === mId)
    if (selectedMem?.groups?.duration) {
      setTargetMonths(selectedMem.groups.duration)
    }

    if (!firm) return;

    // Load auctions where this member is winner
    const { data: aucs } = await withFirmScope(
       supabase
         .from('auctions')
         .select('id, month, is_payout_settled, net_payout, status')
         .eq('winner_id', Number(mId))
         .eq('status', 'confirmed'),
       firm.id
    ).order('month', { ascending: false })
    
    setAuctions(aucs || [])
  }

  const onAuctionChange = (aId: string) => {
    setSelectedAuctionId(aId)
    if (!aId) return

    const auc = auctions.find(a => String(a.id) === aId)
    if (auc && auc.net_payout) {
      show(t('settlement_payout') + ' ' + (t('auto_filled_from_auction') || 'Auto-filled'))
      const updated = [...entries]
      updated[0] = { ...updated[0], amount: Number(auc.net_payout) }
      setEntries(updated)
    }
  }

  /* ---------------- Handlers ---------------- */

  const updateEntry = (
    index: number,
    field: keyof Entry,
    value: string | number
  ) => {
    const updated = [...entries]
    updated[index] = {
      ...updated[index],
      [field]: field === "amount" ? Number(value || 0) : value
    }
    setEntries(updated)
  }

  const addEntry = useCallback(() => {
    setEntries(prev => [...prev, { date: getToday(), amount: 0 }])
  }, [])

  const removeEntry = (index: number) => {
    if (!can('deleteSettlement')) return
    if (entries.length <= 1) return
    setEntries(entries.filter((_, i) => i !== index))
  }

  /* ---------------- UI ---------------- */

  if (loading) return <Loading />

  if (!can('viewSettlement')) return (
    <div className="flex items-center justify-center py-20 text-center">
      <div>
        <div className="text-4xl mb-3">🔒</div>
        <div className="text-sm" style={{ color: 'var(--text2)' }}>Access Denied: You do not have permission to view settlements.</div>
      </div>
    </div>
  )

  return (
    <div className="space-y-6 max-w-5xl pb-20">
       <div className="flex flex-col md:flex-row md:items-center justify-between border-b pb-4 mb-2 gap-4" style={{ borderColor: 'var(--border)' }} id="tour-settle-title">
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator size={24} style={{ color: 'var(--accent)' }} />
            {term.settlementLabel}
          </h1>
          <p className="text-sm opacity-60">Final prize money calculation and payoff registry based on group duration and historical averages.</p>
        </div>
        <div className="flex items-center gap-2 overflow-x-auto whitespace-nowrap pb-1 md:pb-0">
           <Btn onClick={() => router.push('/settlement/history')} icon={History} variant="secondary">Audit Log</Btn>
           <Btn onClick={addEntry} icon={Plus} variant="secondary">{t('add_month')}</Btn>
           <Btn onClick={handleSave} icon={Save} loading={saving} variant="primary" id="tour-settle-btn">{t('save_record')}</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Entry Table (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
          <div id="tour-settle-list">
            <Card title={t('monthly_entry')} subtitle={t('entry_desc')}>
              <Table>
                <thead>
                  <tr>
                    <Th className="w-12">#</Th>
                    <Th>{t('date')}</Th>
                    <Th right>{t('amount')} (₹)</Th>
                    <Th right>{t('balance')} (₹)</Th>
                    <Th className="w-20 text-center">{t('action')}</Th>
                  </tr>
                </thead>
                <tbody>
                  {entries.map((entry, index) => (
                    <Tr key={index}>
                      <Td><span className="text-xs opacity-50 font-mono">#{String(index+1).padStart(2,'0')}</span></Td>
                      <Td>
                        <input
                          type="date"
                          className="bg-transparent border-none outline-none text-sm w-full p-0"
                          style={{ color: 'var(--text)' }}
                          value={entry.date}
                          onChange={e => updateEntry(index, "date", e.target.value)}
                        />
                      </Td>
                      <Td right>
                        <input
                          type="number"
                          className="bg-transparent border-none outline-none text-right font-bold w-full p-0"
                          style={{ color: 'var(--text)' }}
                          value={entry.amount || ''}
                          placeholder="0"
                          onChange={e => updateEntry(index, "amount", e.target.value)}
                        />
                      </Td>
                      <Td right>
                         {fmt(balances[index]?.running)}
                      </Td>
                      <Td className="text-center">
                        {can('deleteSettlement') && (
                          <button onClick={() => removeEntry(index)} 
                            className="p-1.5 hover:bg-danger-500/10 hover:text-danger-500 rounded transition-colors text-xs opacity-30 hover:opacity-100">
                            <Trash2 size={14} />
                          </button>
                        )}
                      </Td>
                    </Tr>
                  ))}
                </tbody>
              </Table>
              <div className="mt-4 flex justify-center border-t py-4" style={{ borderColor: 'var(--border)' }}>
                 <button onClick={addEntry} className="text-xs flex items-center gap-1 font-semibold opacity-50 hover:opacity-100 transition-opacity">
                    <Plus size={14} /> {t('add_month').toUpperCase()}
                 </button>
              </div>
            </Card>
          </div>

          {/* History Section */}
          <Card 
            title={t('settlement_history')} 
            subtitle={t('history_desc')}
            headerAction={<Btn size="sm" variant="ghost" onClick={() => router.push('/settlement/history')} icon={ArrowRight}>View All</Btn>}
          >
             <Table>
                <thead>
                   <tr>
                      <Th>{t('date')}</Th>
                      <Th>{t('member_group')}</Th>
                      <Th right>{t('amount')}</Th>
                      <Th right>{term.payoutLabel}</Th>
                      <Th className="text-center w-10">{t('action')}</Th>
                   </tr>
                </thead>
                <tbody>
                   {history.length === 0 && (
                      <Tr><Td colSpan={5} className="text-center py-6 opacity-40">No saved settlements yet.</Td></Tr>
                   )}
                   {history.map(s => (
                      <Tr key={s.id}>
                         <Td><div className="text-xs opacity-60">{fmtDate(s.created_at)}</div></Td>
                         <Td>
                            <div className="flex items-center gap-2">
                               <div className="p-1 rounded bg-[var(--surface2)]"><User size={12} /></div>
                               <div>
                                  <div className="font-semibold text-sm">{s.members?.persons?.name || 'General Calc'}</div>
                                  <div className="text-[10px] opacity-50 uppercase tracking-tighter">{s.members?.groups?.name || 'Manual'}</div>
                               </div>
                            </div>
                         </Td>
                         <Td right className="font-bold">{fmt(s.total_amount)}</Td>
                         <Td right><Badge variant="accent" className="text-[10px]">{fmt(s.month_14_balance)}</Badge></Td>
                         <Td className="text-center">
                            {can('deleteSettlement') && (
                               <button onClick={() => deleteSettlement(s.id)} className="p-1 opacity-50 hover:opacity-100 hover:text-danger-500">
                                  <Trash2 size={14} />
                                </button>
                            )}
                         </Td>
                      </Tr>
                   ))}
                </tbody>
             </Table>
          </Card>
        </div>

        {/* Summary (1/3 width) - REDESIGNED */}
        <div className="space-y-4">
           
           {/* Selectors Card */}
           <Card className="overflow-hidden">
              <div className="p-5 space-y-4">
                 
                 {/* Group Selector */}
                 <Field label={t('select_group')}>
                    <div className="relative">
                      <select 
                         className={cn(inputClass, "pl-10")} 
                         style={inputStyle}
                         value={selectedGroupId} 
                         onChange={e => onGroupChange(e.target.value)}
                      >
                         <option value="">{t('all_groups')}</option>
                         {groups.map(g => (
                            <option key={g.id} value={g.id}>{g.name}</option>
                         ))}
                      </select>
                      <div className="absolute left-3 top-3 text-[var(--accent)] opacity-60">
                        <Layers size={18} />
                      </div>
                    </div>
                 </Field>

                 {/* Member Selector */}
                 <Field label={t('nav_members')}>
                    <div className="relative">
                      <select 
                         className={cn(inputClass, "pl-10")} 
                         style={inputStyle}
                         value={selectedMemberId} 
                         onChange={e => onMemberChange(e.target.value)}
                      >
                         <option value="">{t('manual_calc')}</option>
                         {members.filter(m => !selectedGroupId || String(m.group_id) === selectedGroupId).map(m => (
                            <option key={m.id} value={m.id}>{m.persons?.name} ({m.groups?.name})</option>
                         ))}
                      </select>
                      <div className="absolute left-3 top-3 text-[var(--accent)] opacity-60">
                        <User size={18} />
                      </div>
                    </div>
                 </Field>

                 {/* Month Selector (if win available) */}
                 {auctions.length > 0 && (
                   <Field label={t('select_month')}>
                      <div className="relative">
                        <select 
                           className={cn(inputClass, "pl-10 border-[var(--accent)]")} 
                           style={inputStyle}
                           value={selectedAuctionId} 
                           onChange={e => onAuctionChange(e.target.value)}
                        >
                           <option value="">-- {t('select_month')} --</option>
                           {auctions.map(a => (
                              <option key={a.id} value={a.id}>Month {a.month} {a.is_payout_settled ? '✓' : ''}</option>
                           ))}
                        </select>
                        <div className="absolute left-3 top-3 text-[var(--accent)]">
                          <Calendar size={18} />
                        </div>
                      </div>
                   </Field>
                 )}

                 <Field label={t('duration')}>
                    <div className="flex items-center gap-2">
                       <input 
                          type="number"
                          className={inputClass}
                          style={inputStyle}
                          min={1}
                          disabled={!!selectedMemberId}
                          value={targetMonths}
                          onChange={e => setTargetMonths(Math.max(1, parseInt(e.target.value) || 0))} 
                       />
                    </div>
                 </Field>
              </div>
           </Card>

           {/* Metrics Grid */}
           <div className="grid grid-cols-2 gap-3">
              <div className="p-4 rounded-2xl border bg-[var(--surface)] shadow-sm" style={{ borderColor: 'var(--border)' }}>
                 <div className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1 leading-tight">{t('amount')}</div>
                 <div className="text-sm font-black truncate">{fmt(totalAmount)}</div>
              </div>
              <div className="p-4 rounded-2xl border bg-[var(--surface)] shadow-sm" style={{ borderColor: 'var(--border)' }}>
                 <div className="text-[10px] font-bold uppercase tracking-wider opacity-40 mb-1 leading-tight">{t('total_months')}</div>
                 <div className="text-sm font-black">{entries.length} <span className="opacity-40 text-[10px]">/ {targetMonths}</span></div>
              </div>
           </div>

           {/* Average Metrics */}
           <div className="p-4 rounded-2xl border flex items-center justify-between" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
              <div>
                <div className="text-[10px] font-bold uppercase tracking-wider opacity-50 mb-0.5">{t('avg_per_month')}</div>
                <div className="text-xs opacity-40 italic">சராசரி (Average)</div>
              </div>
              <div className="text-lg font-black" style={{ color: 'var(--success)' }}>{fmt(averagePerMonth)}</div>
           </div>

           {/* Hero Payout Amount */}
           <div className="relative group overflow-hidden rounded-3xl border-2 border-[var(--accent)] p-6 shadow-xl transition-all hover:scale-[1.02]" 
                style={{ background: 'linear-gradient(135deg, var(--accent-dim) 0%, var(--surface) 100%)' }}>
              <div className="absolute -right-4 -top-4 opacity-5 group-hover:opacity-10 transition-opacity rotate-12">
                <TrendingUp size={120} />
              </div>
              
              <div className="relative z-10">
                <div className="flex items-center justify-between mb-4">
                  <div className="px-2 py-1 rounded bg-[var(--accent)] text-white text-[10px] font-bold uppercase tracking-widest">
                    {term.payoutLabel}
                  </div>
                  <div className="text-[10px] opacity-40 font-bold uppercase">{targetMonths - 1} Months</div>
                </div>
                
                <div className="text-3xl font-black mb-1" style={{ color: 'var(--accent)' }}>{fmt(settlementTotal)}</div>
                <div className="text-[11px] opacity-60 font-medium italic">Final calculated payout amount.</div>
              </div>
           </div>

           {/* Already Settled Warning */}
           {(() => {
             const auc = auctions.find(a => String(a.id) === selectedAuctionId)
             if (auc?.is_payout_settled) {
               return (
                  <div className="p-4 rounded-2xl border-2 border-amber-500/50 bg-amber-500/10 flex gap-3 animate-pulse">
                    <AlertCircle className="text-amber-600 shrink-0" size={20} />
                    <div>
                      <div className="text-xs font-bold text-amber-700 uppercase">{t('already_settled')}</div>
                      <p className="text-[10px] text-amber-700/80 leading-tight mt-0.5">{t('payout_settled_msg')}</p>
                    </div>
                  </div>
               )
             }
             return null
           })()}

           <div className="p-4 rounded-xl border text-[11px] leading-relaxed opacity-80" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
             <div className="flex gap-2 items-start opacity-60">
               <CheckCircle2 size={14} className="shrink-0 mt-0.5" />
               <p><strong>NOTE:</strong> {t('payout_rule_note')}</p>
             </div>
           </div>
        </div>

      </div>
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
