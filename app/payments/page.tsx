'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate } from '@/lib/utils'
import { Btn, Badge, Card, Loading, Empty, Toast, Chip, Modal, Field, StatCard } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { useFirm } from '@/lib/firm/context'
import type { Group, Member, Auction, Payment } from '@/types'
import { History, CreditCard } from 'lucide-react'

export default function PaymentsPage() {
  const supabase = createClient()
  const { firm } = useFirm()
  const { toast, show, hide } = useToast()

  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<number | 'all'>('all')

  const [payModal,     setPayModal]     = useState<{ memberId: number; groupId: number; month?: number } | null>(null)
  const [historyModal, setHistoryModal] = useState<{ memberId: number; groupId: number; month: number } | null>(null)
  const [payForm, setPayForm]   = useState({ month: '', amount: '', date: new Date().toISOString().split('T')[0], mode: 'Cash', is_partial: false })
  const [saving,  setSaving]    = useState(false)
  const [amountDue, setAmountDue] = useState(0)
  const [alreadyPaid, setAlreadyPaid] = useState(0)
  const [currentUser, setCurrentUser] = useState<string>('')

  const load = useCallback(async () => {
    if (!firm) return
    setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.id || '')
    const [g, m, a, p] = await Promise.all([
      supabase.from('groups').select('*').eq('firm_id', firm.id).neq('status','archived').order('name'),
      supabase.from('members').select('*').eq('firm_id', firm.id).order('ticket_no'),
      supabase.from('auctions').select('*').eq('firm_id', firm.id).order('month'),
      supabase.from('payments').select('*').eq('firm_id', firm.id).order('created_at'),
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setPayments(p.data || [])
    setLoading(false)
  }, [firm])

  useEffect(() => { if (firm) load() }, [firm, load])

  // Calculate paid amount for a member-month
  function paidForMonth(memberId: number, groupId: number, month: number) {
    return payments
      .filter(p => p.member_id === memberId && p.group_id === groupId && p.month === month)
      .reduce((s, p) => s + Number(p.amount), 0)
  }

  function isFullyPaid(memberId: number, groupId: number, month: number, auction: Auction, group: Group) {
    const paid = paidForMonth(memberId, groupId, month)
    const due  = Number(group.monthly_contribution) - Number(auction.dividend)
    return paid >= due
  }

  function openPay(memberId: number, groupId: number, month?: number) {
    const g = groups.find(x => x.id === groupId)
    const gAucs = auctions.filter(a => a.group_id === groupId)
    if (!gAucs.length) { show('No auctions recorded yet.', 'error'); return }

    // Default to first unpaid month if none specified
    let targetMonth = month
    if (!targetMonth) {
      const unpaid = gAucs.find(a => {
        const paid = paidForMonth(memberId, groupId, a.month)
        const due  = g ? Number(g.monthly_contribution) - Number(a.dividend) : 0
        return paid < due
      })
      if (!unpaid) { show('No pending payments for this member.', 'error'); return }
      targetMonth = unpaid.month
    }

    const auc  = gAucs.find(a => a.month === targetMonth)
    const due  = g ? Number(g.monthly_contribution) - Number(auc?.dividend || 0) : 0
    const paid = paidForMonth(memberId, groupId, targetMonth)
    const bal  = Math.max(0, due - paid)

    setAmountDue(due)
    setAlreadyPaid(paid)
    setPayForm({
      month: String(targetMonth), amount: String(bal),
      date: new Date().toISOString().split('T')[0],
      mode: 'Cash', is_partial: false
    })
    setPayModal({ memberId, groupId, month: targetMonth })
  }

  async function savePay() {
    if (!payModal || !firm) return
    const amount = +payForm.amount
    if (!amount || amount <= 0) { show('Enter a valid amount.', 'error'); return }

    const bal = Math.max(0, amountDue - alreadyPaid - amount)
    const isPartial = bal > 0

    setSaving(true)
    const { error } = await supabase.from('payments').insert({
      firm_id:      firm.id,
      member_id:    payModal.memberId,
      group_id:     payModal.groupId,
      month:        +payForm.month,
      amount,
      amount_due:   amountDue,
      balance_due:  bal,
      payment_type: isPartial ? 'partial' : 'full',
      payment_date: payForm.date,
      mode:         payForm.mode,
      status:       'paid',
      collected_by: currentUser || null,
    })
    setSaving(false)
    if (error) { show(error.message, 'error'); return }
    show(isPartial ? `₹${amount} recorded. Balance: ${fmt(bal)}` : 'Full payment recorded! ✓')
    setPayModal(null); load()
  }

  const displayGroups = filter === 'all' ? groups : groups.filter(g => g.id === filter)
  if (loading) return <Loading />

  // Summary stats
  const totalCollectedToday = payments
    .filter(p => p.payment_date === new Date().toISOString().split('T')[0])
    .reduce((s, p) => s + Number(p.amount), 0)
  const partialCount = (() => {
    const seen = new Set<string>()
    let count = 0
    auctions.forEach(a => {
      const g = groups.find(x => x.id === a.group_id)
      if (!g) return
      members.filter(m => m.group_id === a.group_id).forEach(m => {
        const key = `${m.id}-${a.group_id}-${a.month}`
        if (seen.has(key)) return
        seen.add(key)
        const paid = paidForMonth(m.id, a.group_id, a.month)
        const due  = Number(g.monthly_contribution) - Number(a.dividend)
        if (paid > 0 && paid < due) count++
      })
    })
    return count
  })()

  return (
    <div>
      {/* Stats */}
      <div className="grid grid-cols-3 gap-4 mb-5">
        <StatCard label="Collected Today" value={fmt(totalCollectedToday)} color="green" />
        <StatCard label="Partial Payments" value={partialCount} sub="months partially paid" color="gold" />
        <StatCard label="Groups Active" value={displayGroups.length} color="blue" />
      </div>

      {/* Chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All Groups</Chip>
        {groups.map(g => (
          <Chip key={g.id} active={filter === g.id} onClick={() => setFilter(g.id)}>{g.name}</Chip>
        ))}
      </div>

      {displayGroups.map(g => {
        const gAucs    = auctions.filter(a => a.group_id === g.id)
        const gMembers = members.filter(m => m.group_id === g.id)
        if (!gAucs.length) return null

        return (
          <Card key={g.id} className="overflow-hidden mb-5">
            <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{g.name}</div>
              <Badge variant="blue">{gAucs.length}/{g.duration} months</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['Member','Ticket', ...gAucs.map(a => `M${a.month}`), 'Total Paid','Action'].map((h, i) => (
                      <th key={i} className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide whitespace-nowrap"
                        style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)', minWidth: i > 1 ? 44 : undefined }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {gMembers.map(m => {
                    const totalPaid = payments
                      .filter(p => p.member_id === m.id && p.group_id === g.id)
                      .reduce((s, p) => s + Number(p.amount), 0)

                    return (
                      <tr key={m.id} className="transition-colors hover:bg-[var(--surface2)]">
                        <td className="px-3 py-3 font-medium whitespace-nowrap" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                          {m.name}
                        </td>
                        <td className="px-3 py-3 text-xs" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
                          #{m.ticket_no}
                        </td>
                        {gAucs.map(a => {
                          const due  = Number(g.monthly_contribution) - Number(a.dividend)
                          const paid = paidForMonth(m.id, g.id, a.month)
                          const full = paid >= due
                          const partial = paid > 0 && !full
                          const pct = due > 0 ? Math.round((paid / due) * 100) : 0

                          return (
                            <td key={a.month} className="px-2 py-3 text-center"
                              style={{ borderBottom: '1px solid var(--border)' }}>
                              <button
                                onClick={() => partial || full
                                  ? setHistoryModal({ memberId: m.id, groupId: g.id, month: a.month })
                                  : openPay(m.id, g.id, a.month)
                                }
                                title={full ? `Paid ${fmt(paid)}` : partial ? `Partial: ${fmt(paid)} of ${fmt(due)} (${pct}%)` : `Due: ${fmt(due)}`}
                                className="relative inline-flex items-center justify-center rounded-md text-xs font-bold transition-all"
                                style={{
                                  width: 36, height: 36,
                                  background: full ? 'var(--green-dim)' : partial ? 'rgba(201,168,76,0.15)' : 'var(--surface3)',
                                  color: full ? 'var(--green)' : partial ? 'var(--gold)' : 'var(--text3)',
                                  border: partial ? '1px dashed var(--gold)' : 'none',
                                  cursor: 'pointer'
                                }}>
                                {full ? '✓' : partial ? `${pct}%` : a.month}
                                {partial && (
                                  <span style={{ position:'absolute', top:-3, right:-3, width:8, height:8, background:'var(--gold)', borderRadius:'50%' }} />
                                )}
                              </button>
                            </td>
                          )
                        })}
                        <td className="px-3 py-3 font-mono text-sm whitespace-nowrap"
                          style={{ borderBottom: '1px solid var(--border)', color: 'var(--green)' }}>
                          {fmt(totalPaid)}
                        </td>
                        <td className="px-3 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                          <Btn size="sm" variant="green" onClick={() => openPay(m.id, g.id)}>
                            <CreditCard size={12} /> Pay
                          </Btn>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            {/* Legend */}
            <div className="px-5 py-2.5 flex gap-4 text-xs" style={{ borderTop: '1px solid var(--border)', color: 'var(--text3)', background: 'var(--surface2)' }}>
              <span>
                <span style={{ display:'inline-block', width:14, height:14, background:'var(--green-dim)', borderRadius:3, marginRight:4, verticalAlign:'middle' }} />
                Fully paid
              </span>
              <span>
                <span style={{ display:'inline-block', width:14, height:14, background:'rgba(201,168,76,0.15)', border:'1px dashed var(--gold)', borderRadius:3, marginRight:4, verticalAlign:'middle' }} />
                Partial (shows %)
              </span>
              <span>
                <span style={{ display:'inline-block', width:14, height:14, background:'var(--surface3)', borderRadius:3, marginRight:4, verticalAlign:'middle' }} />
                Not paid
              </span>
              <span>Click any cell to pay or view history</span>
            </div>
          </Card>
        )
      })}

      {displayGroups.every(g => !auctions.some(a => a.group_id === g.id)) && (
        <Empty icon="💳" text="No completed auction months yet. Record an auction first." />
      )}

      {/* Pay Modal */}
      {payModal && (() => {
        const m   = members.find(x => x.id === payModal.memberId)
        const g   = groups.find(x => x.id === payModal.groupId)
        const bal = Math.max(0, amountDue - alreadyPaid - (+payForm.amount || 0))
        const isPartial = bal > 0 && (+payForm.amount || 0) > 0

        return (
          <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Payment">
            {/* Member info */}
            <div className="p-3 rounded-xl mb-5 text-sm font-medium flex items-center justify-between"
              style={{ background: 'var(--surface2)' }}>
              <span>{m?.name} · {g?.name} · Ticket #{m?.ticket_no}</span>
              <Badge variant="blue">Month {payForm.month}</Badge>
            </div>

            {/* Amount breakdown */}
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[
                { label: 'Amount Due', value: fmt(amountDue), color: 'var(--text)' },
                { label: 'Already Paid', value: fmt(alreadyPaid), color: 'var(--green)' },
                { label: 'Balance', value: fmt(Math.max(0, amountDue - alreadyPaid)), color: alreadyPaid > 0 ? 'var(--gold)' : 'var(--red)' },
              ].map(c => (
                <div key={c.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface2)' }}>
                  <div className="text-xs mb-1" style={{ color: 'var(--text3)' }}>{c.label}</div>
                  <div className="font-mono font-bold" style={{ color: c.color }}>{c.value}</div>
                </div>
              ))}
            </div>

            <div className="grid grid-cols-2 gap-4">
              <Field label="Month">
                <select className={inputClass} style={inputStyle} value={payForm.month}
                  onChange={e => {
                    const mo = +e.target.value
                    const auc = auctions.find(a => a.group_id === payModal.groupId && a.month === mo)
                    const due = g ? Number(g.monthly_contribution) - Number(auc?.dividend || 0) : 0
                    const paid = paidForMonth(payModal.memberId, payModal.groupId, mo)
                    setAmountDue(due); setAlreadyPaid(paid)
                    setPayForm(f => ({ ...f, month: String(mo), amount: String(Math.max(0, due - paid)) }))
                  }}>
                  {auctions.filter(a => a.group_id === payModal.groupId).map(a => (
                    <option key={a.month} value={a.month}>Month {a.month} — {fmtDate(a.auction_date)}</option>
                  ))}
                </select>
              </Field>
              <Field label={`Amount (₹) ${isPartial ? '— Partial' : ''}`}>
                <input className={inputClass}
                  style={{ ...inputStyle, borderColor: isPartial ? 'var(--gold)' : undefined }}
                  type="number" value={payForm.amount}
                  onChange={e => setPayForm(f => ({...f, amount: e.target.value}))}
                  placeholder={`Due: ${amountDue - alreadyPaid}`} />
              </Field>
              <Field label="Payment Date">
                <input className={inputClass} style={inputStyle} type="date" value={payForm.date}
                  onChange={e => setPayForm(f => ({...f, date: e.target.value}))} />
              </Field>
              <Field label="Mode">
                <select className={inputClass} style={inputStyle} value={payForm.mode}
                  onChange={e => setPayForm(f => ({...f, mode: e.target.value}))}>
                  {['Cash','UPI','Bank Transfer','Cheque'].map(m => <option key={m}>{m}</option>)}
                </select>
              </Field>
            </div>

            {/* Partial payment notice */}
            {isPartial && (
              <div className="mt-4 p-3 rounded-xl text-sm flex items-center gap-2"
                style={{ background: 'rgba(201,168,76,0.08)', border: '1px solid rgba(201,168,76,0.3)', color: 'var(--gold)' }}>
                ⚠ Partial payment — Balance of {fmt(bal)} will remain pending.
              </div>
            )}
            {!isPartial && +payForm.amount >= amountDue - alreadyPaid && +payForm.amount > 0 && (
              <div className="mt-4 p-3 rounded-xl text-sm"
                style={{ background: 'var(--green-dim)', color: 'var(--green)' }}>
                ✓ Full payment — month will be marked as complete.
              </div>
            )}

            <div className="flex justify-end gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="secondary" onClick={() => setPayModal(null)}>Cancel</Btn>
              <Btn variant="primary" loading={saving} onClick={savePay}>Record Payment</Btn>
            </div>
          </Modal>
        )
      })()}

      {/* Payment History Modal (per month) */}
      {historyModal && (() => {
        const m    = members.find(x => x.id === historyModal.memberId)
        const g    = groups.find(x => x.id === historyModal.groupId)
        const auc  = auctions.find(a => a.group_id === historyModal.groupId && a.month === historyModal.month)
        const due  = g && auc ? Number(g.monthly_contribution) - Number(auc.dividend) : 0
        const mPays = payments
          .filter(p => p.member_id === historyModal.memberId && p.group_id === historyModal.groupId && p.month === historyModal.month)
          .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime())
        const totalPaid = mPays.reduce((s, p) => s + Number(p.amount), 0)
        const balance   = Math.max(0, due - totalPaid)
        const isFull    = totalPaid >= due

        return (
          <Modal open={!!historyModal} onClose={() => setHistoryModal(null)} title={`Payment History — Month ${historyModal.month}`}>
            <div className="p-3 rounded-xl mb-5 text-sm font-medium flex items-center justify-between"
              style={{ background: 'var(--surface2)' }}>
              <span>{m?.name} · {g?.name} · #{m?.ticket_no}</span>
              {isFull
                ? <Badge variant="green">✓ Fully Paid</Badge>
                : <Badge variant="gold">Partial — {fmt(balance)} remaining</Badge>}
            </div>

            {/* Progress bar */}
            <div className="mb-5">
              <div className="flex justify-between text-xs mb-1.5" style={{ color: 'var(--text2)' }}>
                <span>Collected {fmt(totalPaid)}</span>
                <span>Due {fmt(due)}</span>
              </div>
              <div style={{ background: 'var(--surface3)', borderRadius: 6, height: 10, overflow: 'hidden' }}>
                <div style={{
                  width: `${Math.min(100, due > 0 ? (totalPaid/due)*100 : 0)}%`,
                  height: '100%',
                  background: isFull ? 'var(--green)' : 'var(--gold)',
                  borderRadius: 6,
                  transition: 'width 0.4s ease'
                }} />
              </div>
              <div className="text-xs mt-1 text-right" style={{ color: isFull ? 'var(--green)' : 'var(--gold)' }}>
                {due > 0 ? Math.round((totalPaid/due)*100) : 0}% collected
              </div>
            </div>

            {/* Payment entries */}
            <div className="rounded-xl border overflow-hidden mb-5" style={{ borderColor: 'var(--border)' }}>
              <table className="w-full text-sm">
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    {['#','Amount','Date','Mode','Type','Balance After'].map(h => (
                      <th key={h} className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                        style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {mPays.map((p, i) => (
                    <tr key={p.id} className="hover:bg-[var(--surface2)] transition-colors">
                      <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text3)' }}>{i+1}</td>
                      <td className="px-4 py-3 font-mono font-semibold" style={{ borderBottom: '1px solid var(--border)', color: 'var(--green)' }}>{fmt(p.amount)}</td>
                      <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>{fmtDate(p.payment_date)}</td>
                      <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>{p.mode}</td>
                      <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                        {p.payment_type === 'partial'
                          ? <Badge variant="gold">Partial</Badge>
                          : <Badge variant="green">Full</Badge>}
                      </td>
                      <td className="px-4 py-3 font-mono" style={{ borderBottom: '1px solid var(--border)', color: p.balance_due > 0 ? 'var(--red)' : 'var(--green)' }}>
                        {fmt(p.balance_due)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex justify-end gap-3 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="secondary" onClick={() => setHistoryModal(null)}>Close</Btn>
              {!isFull && (
                <Btn variant="primary" onClick={() => {
                  setHistoryModal(null)
                  openPay(historyModal.memberId, historyModal.groupId, historyModal.month)
                }}>
                  <CreditCard size={13} /> Pay Balance {fmt(balance)}
                </Btn>
              )}
            </div>
          </Modal>
        )
      })()}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
