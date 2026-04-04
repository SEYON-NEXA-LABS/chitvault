'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth } from '@/lib/utils'
import { Btn, Badge, TableCard, Table, Th, Td, Tr, Modal, Field, Loading, Empty, Toast, StatCard } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { logActivity } from '@/lib/utils/logger'
import { useRouter } from 'next/navigation'
import { Plus, Trash2, Settings2, TrendingDown, FileSpreadsheet, ShieldAlert, AlertTriangle, AlertCircle } from 'lucide-react'
import { useI18n } from '@/lib/i18n/context'
import { downloadCSV } from '@/lib/utils/csv'
import type { Group, Member, Auction, AuctionCalculation, ForemanCommission, Person, Firm, Payment } from '@/types'
import { withFirmScope } from '@/lib/supabase/firmQuery'

export default function AuctionsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const isOwner = role === 'owner' || role === 'superadmin'
  const { toast, show, hide } = useToast()
  const router = useRouter()

  const [groups,      setGroups]      = useState<Group[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [auctions,    setAuctions]    = useState<Auction[]>([])
  const [payments,    setPayments]    = useState<Payment[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
  const [loading,     setLoading]     = useState(true)
  const [addOpen,     setAddOpen]     = useState(false)
  const [saving,      setSaving]      = useState(false)
  const [firms,       setFirms]       = useState<Firm[]>([])

  const [form, setForm] = useState({
    group_id: '', month: '', auction_date: '', winner_id: '',
    bid_amount: '', foreman_member_id: ''
  })
  const [eligible,   setEligible]   = useState<Member[]>([])
  const [calc,       setCalc]       = useState<AuctionCalculation | null>(null)
  const [calcError,  setCalcError]  = useState('')
  const [groupRules, setGroupRules] = useState<any>(null)
  
  const [winnerBalance, setWinnerBalance] = useState(0)
  const [winnerAging, setWinnerAging] = useState(0)
  const [acknowledge, setAcknowledge] = useState(false)

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id

    let gQ  = withFirmScope(supabase.from('groups').select('*, firms(name)').neq('status','closed'), targetId).is('deleted_at', null).order('name')
    let mQ  = withFirmScope(supabase.from('members').select('*, persons(*)').in('status',['active','foreman']), targetId).is('deleted_at', null)
    let aQ  = withFirmScope(supabase.from('auctions').select('*, firms(name)'), targetId).is('deleted_at', null).order('month', { ascending: false })
    let fcQ = withFirmScope(supabase.from('foreman_commissions').select('*'), targetId).order('month') // No deleted_at on join table usually, but logic depends on parent
    let pQ  = withFirmScope(supabase.from('payments').select('*'), targetId).is('deleted_at', null)
    
    const [g, m, a, fc, p] = await Promise.all([gQ, mQ, aQ, fcQ, pQ])
    
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setCommissions(fc.data || [])
    setPayments(p.data || [])

    if (role === 'superadmin' && firms.length === 0) {
      const { data: f } = await supabase.from('firms').select('*').order('name')
      setFirms(f || [])
    }
    setLoading(false)
  }, [supabase, firm, role, switchedFirmId, firms.length])

  const filteredAuctions = useMemo(() => auctions, [auctions])
  const filteredCommissions = useMemo(() => commissions, [commissions])

  useEffect(() => { load(true) }, [load])

  async function onGroupChange(groupId: string) {
    const g = groups.find(x => x.id === +groupId)
    if (!g) return
    const done       = auctions.filter(a => a.group_id === g.id).length
    const winnerIds  = auctions.filter(a => a.group_id === g.id).map(a => a.winner_id)
    const gMembers   = members.filter(m => m.group_id === g.id && !winnerIds.includes(m.id))
    const foremanM   = members.filter(m => m.group_id === g.id && m.status === 'foreman')

    const targetId = role === 'superadmin' ? switchedFirmId : firm?.id
    const { data: rules } = await withFirmScope(supabase.from('groups').select('*').eq('id', +groupId), targetId).is('deleted_at', null).single()
    setGroupRules(rules)
    setEligible(gMembers)
    setForm(f => ({
      ...f, group_id: groupId, month: String(done + 1),
      bid_amount: '', winner_id: '', foreman_member_id: foremanM[0]?.id?.toString() || ''
    }))
    setCalc(null); setCalcError('')
  }

  async function onBidChange(bid: string) {
    setForm(f => ({ ...f, bid_amount: bid }))
    setCalc(null); setCalcError('')
    if (!bid || !form.group_id || isNaN(+bid)) return
    const { data, error } = await supabase.rpc('calculate_auction', {
      p_group_id:   +form.group_id,
      p_bid_amount: +bid
    })
    if (error) { setCalcError(error.message); return }
    setCalc(data)
  }

  // Calculate winner balance on change
  useEffect(() => {
    if (!form.winner_id || !form.group_id) {
      setWinnerBalance(0); setWinnerAging(0); setAcknowledge(false); return
    }
    const mem = members.find(m => m.id === +form.winner_id)
    const grp = groups.find(g => g.id === +form.group_id)
    if (!mem || !grp) return

    const gAucs = auctions.filter(a => a.group_id === grp.id)
    const mPays = payments.filter(p => p.member_id === mem.id && p.group_id === grp.id)
    const currentMonth = Math.min(grp.duration, gAucs.length + 1)
    
    let totalDue = 0
    let missedCount = 0
    for (let m = 1; m <= currentMonth; m++) {
      const prevAuc = gAucs.find(a => a.month === m - 1)
      const div = prevAuc ? Number(prevAuc.dividend || 0) : 0
      const due = Number(grp.monthly_contribution) - div
      const paid = mPays.filter((p: any) => p.month === m).reduce((s: number, p: any) => s + Number(p.amount), 0)
      if (due - paid > 0.01) {
        totalDue += (due - paid)
        missedCount++
      }
    }
    setWinnerBalance(totalDue)
    setWinnerAging(missedCount)
    setAcknowledge(totalDue <= 0.01)
  }, [form.winner_id, form.group_id, members, groups, auctions, payments])

  async function handleSave() {
    if (!form.group_id || !form.winner_id || !form.bid_amount) {
      show('Fill in group, winner and bid amount.', 'error'); return
    }
    if (winnerBalance > 0.01 && !acknowledge) {
      show('Please acknowledge the member outstanding dues first.', 'error'); return
    }
    if (calcError) { show('Fix bid amount error first.', 'error'); return }
    setSaving(true)
    const { error } = await supabase.rpc('record_auction_with_commission', {
      p_group_id:           +form.group_id,
      p_month:              +form.month,
      p_auction_date:       form.auction_date || null,
      p_winner_id:          +form.winner_id,
      p_bid_amount:         +form.bid_amount,
      p_foreman_member_id:  form.foreman_member_id ? +form.foreman_member_id : null,
      p_notes:              ''
    })

    if (error) { show(error.message, 'error'); setSaving(false) }
    else { 
      show('Auction recorded!'); 
      if (firm) {
        await logActivity(
          firm.id,
          'AUCTION_RECORDED',
          'auction',
          null,
          { 
            group_id: form.group_id, 
            month: form.month, 
            bid_amount: form.bid_amount 
          }
        );
      }
      show('Auction recorded successfully!', 'success'); setAddOpen(false); load()
    }
    setSaving(false)
  }
  
  const handleExport = () => {
    const data = auctions.map(a => ({
      Month: a.month,
      Group: groups.find(g => g.id === a.group_id)?.name || 'Unknown',
      Bid: a.bid_amount,
      Dividend: a.dividend,
      Payout: a.net_payout
    }))
    downloadCSV(data, 'auction_ledger')
  }

  async function del(id: number) {
    if (!can('deleteAuction')) return
    if (!confirm('Are you sure you want to move this auction to trash?')) return
    
    // Find auction for logging
    const auc = auctions.find(a => a.id === id);
    
    const { error } = await supabase.from('auctions').update({ deleted_at: new Date() }).eq('id', id)
    if (error) show(error.message, 'error')
    else { 
      show('Auction moved to trash'); 
      if (auc && firm) {
        await logActivity(
          firm.id,
          'AUCTION_ARCHIVED',
          'auction',
          id,
          { month: auc.month, group_id: auc.group_id }
        );
      }
      load(); 
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4" id="tour-auction-title">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)]">{t('auction_ledger')}</h1>
          <p className="text-xs opacity-60 mt-1 flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-[var(--success)] animate-pulse" />
            Owners and Staff can record auctions for all active groups.
          </p>
        </div>
        <div className="flex gap-2" id="tour-auction-add">
           {isOwner && <Btn variant="secondary" size="sm" onClick={handleExport} icon={FileSpreadsheet} title={t('export_people')}>CSV</Btn>}
           {can('recordAuction') && <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)} icon={Plus}>{t('record_auction')}</Btn>}
        </div>
      </div>

      <TableCard title="Auction History & Settlement" subtitle="Manage monthly bidding outcomes, calculate prize money, and track member dividends with precision.">
        <div id="tour-auction-list">
          {auctions.length === 0 
            ? <Empty 
                icon="⚖️" 
                text="No auctions recorded. Owners and Staff can start by clicking 'Record Auction' below." 
                action={can('recordAuction') && <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)} icon={Plus}>Record Auction</Btn>}
              />
            : <Table>
                <thead><tr>
                  {role === 'superadmin' && <Th>Firm</Th>}
                  <Th>Group</Th>
                  <Th>Month</Th>
                  <Th className="hidden md:table-cell">Date</Th>
                  <Th>Winner</Th>
                  <Th right>Bid</Th>
                  <Th right className="hidden lg:table-cell">To Surplus</Th>
                  <Th right>Payout</Th>
                  <Th right className="hidden md:table-cell">Comm.</Th>
                  <Th right className="hidden sm:table-cell">Due</Th>
                  <Th>Action</Th>
                </tr></thead>
                <tbody>
                  {filteredAuctions.map(a => {
                    const g  = groups.find(x => x.id === a.group_id)
                    const w  = members.find(x => x.id === a.winner_id)
                    const fc = commissions.find(c => c.auction_id === a.id)
                    return (
                      <Tr key={a.id}>
                        {role === 'superadmin' && (
                          <Td><Badge variant="gray">{(a as any).firms?.name || '—'}</Badge></Td>
                        )}
                        <Td><span className="font-semibold">{g?.name || `#${a.group_id}`}</span></Td>
                        <Td><Badge variant="info">{fmtMonth(a.month, g?.start_date)}</Badge></Td>
                        <Td className="hidden md:table-cell">{fmtDate(a.auction_date)}</Td>
                        <Td>👑 <span className="font-semibold text-xs md:text-sm">{w?.persons?.name || '—'}</span></Td>
                        <Td right>{fmt(a.bid_amount)}</Td>
                        <Td right className="hidden lg:table-cell">
                           {g?.auction_scheme === 'ACCUMULATION' 
                             ? <span style={{ color: 'var(--accent)' }}>+{fmt(a.bid_amount)}</span>
                             : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </Td>
                        <Td right className="font-bold text-[var(--success)]">{fmt(a.net_payout || a.bid_amount)}</Td>
                        <Td right className="hidden md:table-cell">
                          {fc
                            ? <span style={{ color: 'var(--danger)' }}>{fmt(fc.commission_amt)}</span>
                            : <span style={{ color: 'var(--text3)' }}>—</span>}
                        </Td>
                        <Td right className="hidden sm:table-cell">
                          {g ? <span style={{ color: 'var(--text)' }}>{fmt(Number(g.monthly_contribution) - Number(a.dividend))}</span> : '—'}
                        </Td>
                        <Td>
                          {can('deleteAuction') && (
                            <Btn size="sm" variant="danger" onClick={() => del(a.id)} icon={Trash2}>Delete</Btn>
                          )}
                        </Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
          }
        </div>
      </TableCard>

      {commissions.length > 0 && (
        <TableCard title="👑 Foreman Commission Summary">
          <Table>
            <thead><tr>
              {role === 'superadmin' && <Th>Firm</Th>}
              {['Group','Month','Chit Value','Bid','Discount','Commission','Net Dividend','Per Member','Goes To'].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {filteredCommissions.map(fc => {
                const g = groups.find(x => x.id === fc.group_id)
                const fm = members.find(x => x.id === fc.foreman_member_id)
                return (
                  <Tr key={fc.id}>
                    {role === 'superadmin' && (
                      <Td><Badge variant="gray">{(fc as any).firms?.name || '—'}</Badge></Td>
                    )}
                    <Td>{g?.name || '—'}</Td>
                    <Td><Badge variant="info">{fmtMonth(fc.month, g?.start_date)}</Badge></Td>
                    <Td right>{fmt(fc.chit_value)}</Td>
                    <Td right>{fmt(fc.bid_amount)}</Td>
                    <Td right><span style={{ color: 'var(--danger)' }}>{fmt(fc.discount)}</span></Td>
                    <Td right>
                      <div style={{ color: 'var(--accent)' }}>{fmt(fc.commission_amt)}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text3)' }}>
                        {fc.commission_type === 'fixed_amount' ? 'Fixed' : `${fc.commission_rate}%`}
                      </div>
                    </Td>
                    <Td right><span style={{ color: 'var(--success)' }}>{fmt(fc.net_dividend)}</span></Td>
                    <Td right><span style={{ color: 'var(--success)' }}>{fmt(fc.per_member_div)}</span></Td>
                    <Td>
                      {fc.paid_to === 'foreman' && fm
                        ? <Badge variant="accent">👑 {fm.persons?.name}</Badge>
                        : <Badge variant="info">🏦 Firm</Badge>}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </TableCard>
      )}

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Record Auction" size="lg">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Chit Group" className="col-span-2">
            <select className={inputClass} style={inputStyle} value={form.group_id}
              onChange={e => onGroupChange(e.target.value)}>
              <option value="">Select group</option>
              {groups.map(g => {
                const done = auctions.filter(a => a.group_id === g.id).length
                return <option key={g.id} value={g.id}>{g.name} — {fmtMonth(done+1, g.start_date)}</option>
              })}
            </select>
          </Field>

          {groupRules && (
            <div className="col-span-2 p-3 rounded-xl text-xs flex gap-4 flex-wrap"
              style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
              <span>🎯 Bid range: <strong style={{ color: 'var(--accent)' }}>{fmt(groupRules.chit_value * groupRules.min_bid_pct)} – {fmt(groupRules.chit_value * groupRules.max_bid_pct)}</strong></span>
            </div>
          )}

          <Field label="Month No.">
            <input className={inputClass} style={{ ...inputStyle, opacity: 0.7 }} value={form.month} readOnly />
          </Field>
          <Field label="Auction Date">
            <input className={inputClass} style={inputStyle} type="date" value={form.auction_date}
              onChange={e => setForm(f => ({...f, auction_date: e.target.value}))} />
          </Field>
          <Field label="Winner (Bidder)" className="col-span-2">
            <select className={inputClass} style={inputStyle} value={form.winner_id}
              onChange={e => setForm(f => ({...f, winner_id: e.target.value}))}>
              <option value="">Select winner</option>
              {eligible.map(m => {
                // Quick balance check for dropdown label
                const mPays = payments.filter((p: any) => p.member_id === m.id && p.group_id === +form.group_id)
                const paidTotal = mPays.reduce((s: number, p: any) => s + Number(p.amount), 0)
                // Note: Simplified check for dropdown to keep it fast
                return <option key={m.id} value={m.id}>{m.persons?.name} (#{m.ticket_no}) {paidTotal === 0 ? '⚠️ No Payments' : ''}</option>
              })}
            </select>
          </Field>

          {form.winner_id && winnerBalance > 0.01 && (
            <div className="col-span-2 p-4 rounded-2xl border bg-danger-500/5 border-danger-500/20 space-y-3">
              <div className="flex items-start gap-3">
                <div className="p-2 rounded-lg bg-danger-500/10 text-danger-500">
                  <ShieldAlert size={20} />
                </div>
                <div className="flex-1">
                  <div className="font-bold text-danger-600 text-sm">Defaulter Warning</div>
                  <div className="text-xs opacity-70">
                    This member is <strong>{winnerAging} months</strong> behind with a total outstanding balance of <strong>{fmt(winnerBalance)}</strong>.
                  </div>
                </div>
              </div>
              <label className="flex items-center gap-2 p-2 rounded-lg bg-white/50 border border-danger-500/10 cursor-pointer select-none hover:bg-white transition-colors">
                <input type="checkbox" checked={acknowledge} onChange={e => setAcknowledge(e.target.checked)} />
                <span className="text-[10px] font-bold uppercase tracking-tight text-danger-700">I acknowledge these dues and wish to proceed</span>
              </label>
            </div>
          )}

          {groupRules?.commission_recipient === 'foreman' && (
            <Field label="Foreman Member" className="col-span-2">
              <select className={inputClass} style={inputStyle} value={form.foreman_member_id}
                onChange={e => setForm(f => ({...f, foreman_member_id: e.target.value}))}>
                <option value="">Select foreman (optional)</option>
                {members.filter(m => m.group_id === +form.group_id && m.status === 'foreman').map(m =>
                  <option key={m.id} value={m.id}>{m.persons?.name}</option>
                )}
              </select>
            </Field>
          )}

          <Field label="Winning Bid (₹)" className="col-span-2">
            <input className={inputClass}
              style={{ ...inputStyle, borderColor: calcError ? 'var(--danger)' : calc ? 'var(--success)' : undefined }}
              type="number" value={form.bid_amount}
              onChange={e => onBidChange(e.target.value)} />
            {calcError && <span className="text-[10px] mt-1" style={{ color: 'var(--danger)' }}>✗ {calcError}</span>}
          </Field>
        </div>

        {calc && (
          <div className="mt-4 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <div className="p-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Net Payout',       value: fmt(calc.net_payout),      color: 'var(--success)' },
                { label: 'Firm Comm.',  value: fmt(calc.commission_amt),  color: 'var(--danger)'  },
                { 
                  label: groupRules?.auction_scheme === 'ACCUMULATION' ? 'Group Surplus' : 'Per Member Div',   
                  value: groupRules?.auction_scheme === 'ACCUMULATION' ? fmt(calc.bid_amount) : fmt(calc.per_member_div),  
                  color: 'var(--info)'  
                },
              ].map(r => (
                <div key={r.label} className="bg-[var(--surface2)] p-2 rounded-xl text-center">
                   <div className="text-[10px] opacity-40 uppercase tracking-widest">{r.label}</div>
                   <div className="font-bold font-mono" style={{color:r.color}}>{r.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={handleSave} disabled={!!calcError}>Record Auction</Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
