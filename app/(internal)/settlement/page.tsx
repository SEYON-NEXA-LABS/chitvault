'use client'

import React, { useMemo, useState, useCallback, useEffect } from "react"
import { Card, Table, Th, Td, Tr, Badge, Loading, Btn, Field } from "@/components/ui"
import { Calculator, Plus, Trash2, Save, User } from "lucide-react"
import { fmt, fmtDate } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { useFirm } from "@/lib/firm/context"
import { useI18n } from "@/lib/i18n/context"
import { useToast } from "@/lib/hooks/useToast"
import { logActivity } from "@/lib/utils/logger"
import { withFirmScope } from "@/lib/supabase/firmQuery"
import { inputClass, inputStyle } from "@/components/ui"
import type { Member, Settlement, Person } from "@/types"

type Entry = {
  date: string
  amount: number
}

type MemberWithDetails = Member & {
  firms?: { name: string }
  persons?: Person
  groups?: { name: string, duration: number }
}

export default function SettlementPage() {
  const supabase = createClient()
  const { show } = useToast()
  const { t } = useI18n()
  const { firm, role, can } = useFirm()
  
  const [entries, setEntries] = useState<Entry[]>([
    { date: new Date().toISOString().split('T')[0], amount: 0 }
  ])
  
  const [members, setMembers] = useState<MemberWithDetails[]>([])
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')
  const [history, setHistory] = useState<Settlement[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [targetMonths, setTargetMonths] = useState<number>(15)

  const isSuper = role === 'superadmin'

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

    // Load Members for dropdown
    const { data: mems } = await withFirmScope(
       supabase.from('members').select('*, persons(*), groups(name, duration)'),
       targetId
    )
    setMembers((mems as MemberWithDetails[]) || [])

    // Load Settlement History (Last 20)
    const { data: hist } = await withFirmScope(
       supabase.from('settlements').select('*, members(persons(name), groups(name))'),
       targetId
    ).order('created_at', { ascending: false }).limit(20)
    
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
     
     const { error } = await supabase.from('settlements').delete().eq('id', id)
     if (error) return show(error.message, 'error')
     
     show('Settlement deleted')
     logActivity(firm.id, 'SETTLEMENT_DELETED', 'settlements', String(id))
     load()
  }

  const onMemberChange = async (mId: string) => {
    setSelectedMemberId(mId)
    if (!mId) return

    // Auto-fill Target Duration from Group
    const selectedMem = members.find(m => String(m.id) === mId)
    if (selectedMem?.groups?.duration) {
      setTargetMonths(selectedMem.groups.duration)
    }

    // Try to auto-fill from last won auction payout
    const { data: auction } = await supabase
      .from('auctions')
      .select('net_payout')
      .eq('winner_id', Number(mId))
      .order('created_at', { ascending: false })
      .limit(1)

    if (auction && auction[0]?.net_payout) {
      show('Auto-filled total amount from last won auction!')
      const updated = [...entries]
      updated[0] = { ...updated[0], amount: Number(auction[0].net_payout) }
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

  const addEntry = () => {
    setEntries([...entries, { date: new Date().toISOString().split('T')[0], amount: 0 }])
  }

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
       <div className="flex items-center justify-between border-b pb-4 mb-2" style={{ borderColor: 'var(--border)' }}>
        <div>
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Calculator size={24} style={{ color: 'var(--accent)' }} />
            {t('settlement_title')}
          </h1>
          <p className="text-sm opacity-60">{t('settlement_desc')}</p>
        </div>
        <div className="flex items-center gap-2">
           <Btn onClick={addEntry} icon={Plus} variant="secondary">{t('add_month')}</Btn>
           <Btn onClick={handleSave} icon={Save} loading={saving}>{t('save_record')}</Btn>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        
        {/* Entry Table (2/3 width) */}
        <div className="lg:col-span-2 space-y-6">
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
                    <Td right className="font-mono text-xs opacity-80">
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
            <div className="mt-4 flex justify-center">
               <button onClick={addEntry} className="text-xs flex items-center gap-1 font-semibold opacity-50 hover:opacity-100 transition-opacity">
                  <Plus size={14} /> {t('add_month').toUpperCase()}
               </button>
            </div>
          </Card>

          {/* History Section */}
          <Card title={t('settlement_history')} subtitle={t('history_desc')}>
             <Table>
                <thead>
                   <tr>
                      <Th>{t('date')}</Th>
                      <Th>{t('member_group')}</Th>
                      <Th right>{t('amount')}</Th>
                      <Th right>{t('settlement_payout')}</Th>
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

        {/* Summary (1/3 width) */}
        <div className="space-y-4">
           <Card title={t('calculation_summary')} subtitle={t('payout_amt')}>
              <div className="space-y-4 py-2">
                 
                 <Field label={t('nav_members')} className="mb-4">
                    <select 
                       className={inputClass} 
                       style={inputStyle}
                       value={selectedMemberId} 
                       onChange={e => onMemberChange(e.target.value)}
                    >
                       <option value="">{t('manual_calc')}</option>
                       {members.map(m => (
                          <option key={m.id} value={m.id}>{m.persons?.name} ({m.groups?.name})</option>
                       ))}
                    </select>
                 </Field>

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
                       <span className="text-[10px] opacity-40 font-bold uppercase tracking-widest">
                         {targetMonths} {t('duration')}
                         {selectedMemberId && " (Auto-filled)"}
                       </span>
                    </div>
                 </Field>

                 <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm">
                       <div className="font-bold">{t('amount')}</div>
                       <div className="text-xs opacity-50">மொத்தம் (Total)</div>
                    </div>
                    <div className="text-xl font-black" style={{ color: 'var(--accent)' }}>{fmt(totalAmount)}</div>
                 </div>

                 <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm">
                       <div className="font-bold">{t('total_months')}</div>
                       <div className="text-xs opacity-50">மாதங்கள் (Months)</div>
                    </div>
                    <div className="text-xl font-mono">{entries.length}</div>
                 </div>

                 <div className="flex justify-between items-center border-b pb-3" style={{ borderColor: 'var(--border)' }}>
                    <div className="text-sm">
                       <div className="font-bold">{t('avg_per_month')}</div>
                       <div className="text-xs opacity-50">சராசரி (Average)</div>
                    </div>
                    <div className="text-xl font-black" style={{ color: 'var(--success)' }}>{fmt(averagePerMonth)}</div>
                 </div>

                 <div className="p-4 rounded-xl border mt-4" style={{ background: 'var(--accent-dim)', borderColor: 'var(--accent)' }}>
                    <div className="text-[10px] font-bold uppercase tracking-wider mb-1" style={{ color: 'var(--accent)' }}>
                       {t('settlement_payout')} ({targetMonths - 1} months)
                    </div>
                    <div className="text-[10px] opacity-60 mb-2">{(targetMonths - 1)}‑மாதப் பட்டுவாடா</div>
                    <div className="text-2xl font-black" style={{ color: 'var(--accent)' }}>{fmt(settlementTotal)}</div>
                  </div>
              </div>
           </Card>

           <div className="p-4 rounded-xl border text-[11px] leading-relaxed opacity-80" style={{ background: 'var(--surface2)', borderColor: 'var(--border)' }}>
             <strong>NOTE:</strong> {t('payout_rule_note')}
           </div>
        </div>

      </div>
    </div>
  )
}
