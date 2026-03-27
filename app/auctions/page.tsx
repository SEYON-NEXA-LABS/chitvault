'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import { Btn, Badge, TableCard, Table, Th, Td, Tr, Modal, Field, Loading, Empty, Toast, StatCard } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Plus, Trash2, Settings2, TrendingDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Group, Member, Auction, AuctionCalculation, ForemanCommission, Person } from '@/types'

export default function AuctionsPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, can } = useFirm()
  const { toast, show, hide } = useToast()
  const router = useRouter()

  const [groups,      setGroups]      = useState<Group[]>([])
  const [members,     setMembers]     = useState<Member[]>([])
  const [auctions,    setAuctions]    = useState<Auction[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
  const [loading,     setLoading]     = useState(true)
  const [addOpen,     setAddOpen]     = useState(false)
  const [saving,      setSaving]      = useState(false)

  const [form, setForm] = useState({
    group_id: '', month: '', auction_date: '', winner_id: '',
    bid_amount: '', foreman_member_id: ''
  })
  const [eligible,   setEligible]   = useState<Member[]>([])
  const [calc,       setCalc]       = useState<AuctionCalculation | null>(null)
  const [calcError,  setCalcError]  = useState('')
  const [groupRules, setGroupRules] = useState<any>(null)

  const load = useCallback(async (isInitial = false) => {
    if (!firm) return
    if (isInitial) setLoading(true)
    const [g, m, a, fc] = await Promise.all([
      supabase.from('groups').select('*').eq('firm_id', firm.id).neq('status','closed').order('name'),
      supabase.from('members').select('*, persons(*)').eq('firm_id', firm.id).in('status',['active','foreman']),
      supabase.from('auctions').select('*').eq('firm_id', firm.id).order('month', { ascending: false }),
      supabase.from('foreman_commissions').select('*').eq('firm_id', firm.id).order('month'),
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setCommissions(fc.data || [])
    setLoading(false)
  }, [firm, supabase])

  useEffect(() => { if (firm) load(true) }, [firm, load])

  async function onGroupChange(groupId: string) {
    const g = groups.find(x => x.id === +groupId)
    if (!g) return
    const done       = auctions.filter(a => a.group_id === g.id).length
    const winnerIds  = auctions.filter(a => a.group_id === g.id).map(a => a.winner_id)
    const gMembers   = members.filter(m => m.group_id === g.id && !winnerIds.includes(m.id))
    const foremanM   = members.filter(m => m.group_id === g.id && m.status === 'foreman')

    const { data: rules } = await supabase.from('groups').select('*').eq('id', +groupId).single()
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

  async function handleSave() {
    if (!form.group_id || !form.winner_id || !form.bid_amount) {
      show('Fill in group, winner and bid amount.', 'error'); return
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
    else { show('Auction recorded!'); setAddOpen(false); load() }
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm('Are you sure you want to delete this auction? This will revert stats but might leave payment gaps.')) return
    const { error } = await supabase.from('auctions').delete().eq('id', id)
    if (error) show(error.message, 'error')
    else { show('Auction deleted'); load() }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-3xl font-black text-[var(--text)]">Auction Ledger</h1>
        <Btn variant="primary" icon={Plus} onClick={() => setAddOpen(true)}>Record Auction</Btn>
      </div>

      <TableCard title="History" subtitle="All previous auctions across your groups">
        {auctions.length === 0 
          ? <Empty icon="⚖️" text="No auctions recorded. Start by clicking 'Record Auction'." />
          : <Table>
              <thead><tr>
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
                {auctions.map(a => {
                  const g  = groups.find(x => x.id === a.group_id)
                  const w  = members.find(x => x.id === a.winner_id)
                  const fc = commissions.find(c => c.auction_id === a.id)
                  return (
                    <Tr key={a.id}>
                      <Td><span className="font-semibold">{g?.name || `#${a.group_id}`}</span></Td>
                      <Td><Badge variant="blue">M{a.month}</Badge></Td>
                      <Td className="hidden md:table-cell">{fmtDate(a.auction_date)}</Td>
                      <Td>👑 <span className="font-semibold text-xs md:text-sm">{w?.persons?.name || '—'}</span></Td>
                      <Td right>{fmt(a.bid_amount)}</Td>
                      <Td right className="hidden lg:table-cell">
                         {g?.auction_scheme === 'ACCUMULATION' 
                           ? <span style={{ color: 'var(--gold)' }}>+{fmt(Number(a.total_pot) - Number(a.bid_amount))}</span>
                           : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </Td>
                      <Td right className="font-bold text-green-600">{fmt(a.net_payout || a.bid_amount)}</Td>
                      <Td right className="hidden md:table-cell">
                        {fc
                          ? <span style={{ color: 'var(--red)' }}>{fmt(fc.commission_amt)}</span>
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
      </TableCard>

      {commissions.length > 0 && (
        <TableCard title="👑 Foreman Commission Summary">
          <Table>
            <thead><tr>
              {['Group','Month','Chit Value','Bid','Discount','Commission','Net Dividend','Per Member','Goes To'].map(h => <Th key={h}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {commissions.map(fc => {
                const g = groups.find(x => x.id === fc.group_id)
                const fm = members.find(x => x.id === fc.foreman_member_id)
                return (
                  <Tr key={fc.id}>
                    <Td>{g?.name || '—'}</Td>
                    <Td><Badge variant="blue">M{fc.month}</Badge></Td>
                    <Td right>{fmt(fc.chit_value)}</Td>
                    <Td right>{fmt(fc.bid_amount)}</Td>
                    <Td right><span style={{ color: 'var(--red)' }}>{fmt(fc.discount)}</span></Td>
                    <Td right>
                      <div style={{ color: 'var(--gold)' }}>{fmt(fc.commission_amt)}</div>
                      <div className="text-[10px]" style={{ color: 'var(--text3)' }}>
                        {fc.commission_type === 'fixed_amount' ? 'Fixed' : `${fc.commission_rate}%`}
                      </div>
                    </Td>
                    <Td right><span style={{ color: 'var(--green)' }}>{fmt(fc.net_dividend)}</span></Td>
                    <Td right><span style={{ color: 'var(--green)' }}>{fmt(fc.per_member_div)}</span></Td>
                    <Td>
                      {fc.paid_to === 'foreman' && fm
                        ? <Badge variant="gold">👑 {fm.persons?.name}</Badge>
                        : <Badge variant="blue">🏦 Firm</Badge>}
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
                return <option key={g.id} value={g.id}>{g.name} — Month {done+1}</option>
              })}
            </select>
          </Field>

          {groupRules && (
            <div className="col-span-2 p-3 rounded-xl text-xs flex gap-4 flex-wrap"
              style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
              <span>🎯 Bid range: <strong style={{ color: 'var(--gold)' }}>{fmt(groupRules.chit_value * groupRules.min_bid_pct)} – {fmt(groupRules.chit_value * groupRules.max_bid_pct)}</strong></span>
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
              {eligible.map(m => <option key={m.id} value={m.id}>{m.persons?.name} (#{m.ticket_no})</option>)}
            </select>
          </Field>

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
              style={{ ...inputStyle, borderColor: calcError ? 'var(--red)' : calc ? 'var(--green)' : undefined }}
              type="number" value={form.bid_amount}
              onChange={e => onBidChange(e.target.value)} />
            {calcError && <span className="text-[10px] mt-1" style={{ color: 'var(--red)' }}>✗ {calcError}</span>}
          </Field>
        </div>

        {calc && (
          <div className="mt-4 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <div className="p-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Net Payout',       value: fmt(calc.net_payout),      color: 'var(--green)' },
                { label: 'Firm Comm.',  value: fmt(calc.commission_amt),  color: 'var(--red)'  },
                { label: 'Per Member Div',   value: fmt(calc.per_member_div),  color: 'var(--blue)'  },
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
