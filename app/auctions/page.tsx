'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import { Btn, Badge, TableCard, Table, Th, Td, Tr, Modal, Field, Loading, Empty, Toast, StatCard } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Plus, Trash2, Settings2, TrendingDown } from 'lucide-react'
import { useRouter } from 'next/navigation'
import type { Group, Member, Auction, AuctionCalculation, ForemanCommission } from '@/types'

export default function AuctionsPage() {
  const supabase = createClient()
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

  const load = useCallback(async () => {
    if (!firm) return
    setLoading(true)
    const [g, m, a, fc] = await Promise.all([
      supabase.from('groups').select('*').eq('firm_id', firm.id).neq('status','closed').order('name'),
      supabase.from('members').select('*').eq('firm_id', firm.id).in('status',['active','foreman']),
      supabase.from('auctions').select('*').eq('firm_id', firm.id).order('id', { ascending: false }),
      supabase.from('foreman_commissions').select('*').eq('firm_id', firm.id).order('month'),
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setCommissions(fc.data || [])
    setLoading(false)
  }, [firm, supabase])

  useEffect(() => { if (firm) load() }, [firm, load])

  // When group changes: load its rules + set next month + eligible members
  async function onGroupChange(groupId: string) {
    const g = groups.find(x => x.id === +groupId)
    if (!g) return
    const done       = auctions.filter(a => a.group_id === g.id).length
    const winnerIds  = auctions.filter(a => a.group_id === g.id).map(a => a.winner_id)
    const gMembers   = members.filter(m => m.group_id === g.id && !winnerIds.includes(m.id))
    const foremanM   = members.filter(m => m.group_id === g.id && m.status === 'foreman')

    // Load rules from DB to get min/max bid
    const { data: rules } = await supabase.from('groups').select('*').eq('id', +groupId).single()
    setGroupRules(rules)
    setEligible(gMembers)
    setForm(f => ({
      ...f, group_id: groupId, month: String(done + 1),
      bid_amount: '', winner_id: '', foreman_member_id: foremanM[0]?.id?.toString() || ''
    }))
    setCalc(null); setCalcError('')
  }

  // Live calculation as bid changes
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
    const { data, error } = await supabase.rpc('record_auction_with_commission', {
      p_group_id:           +form.group_id,
      p_month:              +form.month,
      p_auction_date:       form.auction_date || null,
      p_winner_id:          +form.winner_id,
      p_bid_amount:         +form.bid_amount,
      p_foreman_member_id:  form.foreman_member_id ? +form.foreman_member_id : null,
    })
    setSaving(false)
    if (error) { show(error.message, 'error'); return }
    show('Auction recorded! 🎉')
    setAddOpen(false)
    setForm({ group_id:'', month:'', auction_date:'', winner_id:'', bid_amount:'', foreman_member_id:'' })
    setCalc(null); setGroupRules(null)
    load()
  }

  async function del(id: number) {
    if (!confirm('Delete this auction and its commission record?')) return
    await supabase.from('auctions').delete().eq('id', id)
    show('Deleted.'); load()
  }

  // Stats
  const totalCommissions = commissions.reduce((s, c) => s + Number(c.commission_amt), 0)
  const avgDiscount = auctions.length > 0
    ? auctions.reduce((s, a) => s + (Number(a.total_pot) - Number(a.bid_amount)), 0) / auctions.length : 0

  if (loading) return <Loading />

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Total Auctions" value={auctions.length} color="blue" />
        <StatCard label="Avg Discount" value={fmt(avgDiscount)} sub="per auction" color="gold" />
        <StatCard label="Total Commission" value={fmt(totalCommissions)} sub="foreman earnings" color="green" />
      </div>

      <div className="p-4 rounded-xl border mb-5 text-sm flex items-center gap-2"
        style={{ background: 'rgba(201,168,76,0.08)', borderColor: 'rgba(201,168,76,0.3)', color: 'var(--gold)' }}>
        <TrendingDown size={15} />
        Bid limits and commission rules are set per group. Go to <strong>Chit Groups → Rules</strong> to configure them.
      </div>

      <TableCard title={`All Auctions (${auctions.length})`}
        actions={can('recordAuction') ? (
          <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}>
            <Plus size={14}/> Record Auction
          </Btn>
        ) : undefined}>
        {auctions.length === 0
          ? <Empty icon="🔨" text="No auctions recorded yet." />
          : <Table>
              <thead><tr>
                {['Group','Month','Date','Winner','Bid','To Surplus','Net Payout','Commission','Pays','Action'].map(h => <Th key={h}>{h}</Th>)}
              </tr></thead>
              <tbody>
                {auctions.map(a => {
                  const g  = groups.find(x => x.id === a.group_id)
                  const w  = members.find(x => x.id === a.winner_id)
                  const fc = commissions.find(c => c.auction_id === a.id)
                  const disc = Number(a.total_pot) - Number(a.bid_amount)
                  return (
                    <Tr key={a.id}>
                      <Td><span className="font-semibold">{g?.name || `#${a.group_id}`}</span></Td>
                      <Td><Badge variant="blue">M{a.month}</Badge></Td>
                      <Td>{fmtDate(a.auction_date)}</Td>
                      <Td>👑 <span className="font-semibold">{w?.name || '—'}</span></Td>
                      <Td right>{fmt(a.bid_amount)}</Td>
                      <Td right>
                         {g?.auction_scheme === 'ACCUMULATION' 
                           ? <span style={{ color: 'var(--gold)' }}>+{fmt(Number(a.total_pot) - Number(a.bid_amount))}</span>
                           : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </Td>
                      <Td right className="font-bold text-green-600">{fmt(a.net_payout || a.bid_amount)}</Td>
                      <Td right>
                        {fc
                          ? <span style={{ color: 'var(--red)' }}>{fmt(fc.commission_amt)}</span>
                          : <span style={{ color: 'var(--text3)' }}>—</span>}
                      </Td>
                      <Td right>
                        {g ? <span style={{ color: 'var(--text)' }}>{fmt(Number(g.monthly_contribution) - Number(a.dividend))}</span> : '—'}
                      </Td>
                      <Td>
                        {can('deleteAuction') && (
                          <Btn size="sm" variant="danger" onClick={() => del(a.id)}><Trash2 size={13}/></Btn>
                        )}
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
        }
      </TableCard>

      {/* Commission Summary Table */}
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
                      <div className="text-xs" style={{ color: 'var(--text3)' }}>
                        {fc.commission_type === 'fixed_amount' ? 'Fixed' : `${fc.commission_rate}%`}
                      </div>
                    </Td>
                    <Td right><span style={{ color: 'var(--green)' }}>{fmt(fc.net_dividend)}</span></Td>
                    <Td right><span style={{ color: 'var(--green)' }}>{fmt(fc.per_member_div)}</span></Td>
                    <Td>
                      {fc.paid_to === 'foreman' && fm
                        ? <Badge variant="gold">👑 {fm.name}</Badge>
                        : <Badge variant="blue">🏦 Firm</Badge>}
                    </Td>
                  </Tr>
                )
              })}
              {/* Totals row */}
              <Tr style={{ background: 'var(--surface2)', fontWeight: 700 }}>
                <Td><strong>Total</strong></Td>
                <Td>—</Td>
                <Td right>{fmt(commissions.reduce((s,c) => s+Number(c.chit_value),0))}</Td>
                <Td>—</Td>
                <Td right style={{ color: 'var(--red)' }}>{fmt(commissions.reduce((s,c) => s+Number(c.discount),0))}</Td>
                <Td right style={{ color: 'var(--gold)' }}>{fmt(commissions.reduce((s,c) => s+Number(c.commission_amt),0))}</Td>
                <Td right style={{ color: 'var(--green)' }}>{fmt(commissions.reduce((s,c) => s+Number(c.net_dividend),0))}</Td>
                <Td>—</Td>
                <Td>—</Td>
              </Tr>
            </tbody>
          </Table>
        </TableCard>
      )}

      {/* Record Auction Modal */}
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
              <span>👑 Commission: <strong style={{ color: 'var(--gold)' }}>
                {groupRules.commission_type === 'fixed_amount'
                  ? fmt(groupRules.commission_value)
                  : `${groupRules.commission_value}% of ${groupRules.commission_type === 'percent_of_chit' ? 'chit value' : 'discount'}`}
              </strong></span>
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
              {eligible.map(m => <option key={m.id} value={m.id}>{m.name} (#{m.ticket_no})</option>)}
            </select>
          </Field>

          {/* Foreman member selector if recipient = foreman */}
          {groupRules?.commission_recipient === 'foreman' && (
            <Field label="Foreman Member" className="col-span-2">
              <select className={inputClass} style={inputStyle} value={form.foreman_member_id}
                onChange={e => setForm(f => ({...f, foreman_member_id: e.target.value}))}>
                <option value="">Select foreman (optional)</option>
                {members.filter(m => m.group_id === +form.group_id && m.status === 'foreman').map(m =>
                  <option key={m.id} value={m.id}>{m.name}</option>
                )}
              </select>
            </Field>
          )}

          <Field label="Winning Bid (₹)" className="col-span-2">
            <input className={inputClass}
              style={{ ...inputStyle, borderColor: calcError ? 'var(--red)' : calc ? 'var(--green)' : undefined }}
              type="number" value={form.bid_amount}
              placeholder={groupRules ? `${fmt(groupRules.chit_value * groupRules.min_bid_pct)} – ${fmt(groupRules.chit_value)}` : 'Amount winner receives'}
              onChange={e => onBidChange(e.target.value)} />
            {calcError && <span className="text-xs mt-1" style={{ color: 'var(--red)' }}>✗ {calcError}</span>}
          </Field>
        </div>

        {/* Live calculation result */}
        {calc && (
          <div className="mt-4 rounded-xl overflow-hidden border" style={{ borderColor: 'var(--border)' }}>
            <div className="px-4 py-2.5 text-xs font-bold uppercase tracking-wide"
              style={{ background: 'var(--surface2)', color: 'var(--text2)', borderBottom: '1px solid var(--border)' }}>
              Auction Breakdown
            </div>
            <div className="p-4 grid grid-cols-3 gap-3">
              {[
                { label: 'Raw Payout',       value: fmt((calc.net_payout || 0) + (calc.commission_amt || 0)),  color: 'var(--text)'   },
                { label: 'Firm Commission',  value: fmt(calc.commission_amt),  color: 'var(--red)'  },
                { label: groupRules?.auction_scheme === 'ACCUMULATION' ? 'To Surplus Pool' : 'Net Dividend', value: fmt(groupRules?.auction_scheme === 'ACCUMULATION' ? calc.discount : calc.net_dividend), color: 'var(--gold)' },
                { label: 'Net Payout',       value: fmt(calc.net_payout),      color: 'var(--green)' },
                { label: 'Per Member Div',   value: fmt(calc.per_member_div),  color: 'var(--blue)'  },
                { label: 'Total Members',    value: String(calc.num_members),  color: 'var(--text2)' },
              ].map(r => (
                <div key={r.label} className="rounded-lg p-2.5" style={{ background: 'var(--surface2)' }}>
                  <div className="text-xs mb-0.5" style={{ color: 'var(--text3)' }}>{r.label}</div>
                  <div className="font-mono font-bold text-sm" style={{ color: r.color }}>{r.value}</div>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="flex justify-end gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={handleSave} disabled={!!calcError}>
            Record Auction
          </Btn>
        </div>
      </Modal>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
