'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate } from '@/lib/utils'
import { Btn, Badge, Card, Loading, Empty, Toast, Chip, Modal, Field } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import type { Group, Member, Auction, Payment } from '@/types'

export default function PaymentsPage() {
  const supabase = createClient()
  const { toast, show, hide } = useToast()

  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<number | 'all'>('all')

  const [payModal, setPayModal]   = useState<{ memberId: number; groupId: number } | null>(null)
  const [payForm,  setPayForm]    = useState({ month: '', amount: '', date: '', mode: 'Cash' })
  const [saving,   setSaving]     = useState(false)
  const [unpaidMonths, setUnpaid] = useState<Auction[]>([])

  const load = useCallback(async () => {
    setLoading(true)
    const [g, m, a, p] = await Promise.all([
      supabase.from('groups').select('*').neq('status','archived').order('name'),
      supabase.from('members').select('*').order('ticket_no'),
      supabase.from('auctions').select('*').order('month'),
      supabase.from('payments').select('*'),
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setPayments(p.data || [])
    setLoading(false)
  }, [])

  useEffect(() => { load() }, [load])

  function openPay(memberId: number, groupId: number) {
    const mPaid   = payments.filter(p => p.member_id === memberId && p.group_id === groupId && p.status === 'paid')
    const paidMos = mPaid.map(p => p.month)
    const gAucs   = auctions.filter(a => a.group_id === groupId)
    const unpaid  = gAucs.filter(a => !paidMos.includes(a.month))
    if (!unpaid.length) { show('No pending payments.', 'error'); return }
    setUnpaid(unpaid)
    const g   = groups.find(x => x.id === groupId)
    const last = gAucs[gAucs.length - 1]
    const suggested = g ? Number(g.monthly_contribution) - Number(last?.dividend || 0) : 0
    setPayForm({ month: String(unpaid[0].month), amount: String(suggested), date: new Date().toISOString().split('T')[0], mode: 'Cash' })
    setPayModal({ memberId, groupId })
  }

  async function savePay() {
    if (!payModal) return
    setSaving(true)
    const { error } = await supabase.from('payments').insert({
      member_id: payModal.memberId, group_id: payModal.groupId,
      month: +payForm.month, amount: +payForm.amount,
      payment_date: payForm.date, mode: payForm.mode, status: 'paid', firm_id: firmId!
    })
    setSaving(false)
    if (error) { show(error.message, 'error'); return }
    show('Payment recorded! ✓'); setPayModal(null); load()
  }

  const displayGroups = filter === 'all' ? groups : groups.filter(g => g.id === filter)

  if (loading) return <Loading />

  return (
    <div>
      {/* Chips */}
      <div className="flex gap-2 flex-wrap mb-5">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All Groups</Chip>
        {groups.map(g => (
          <Chip key={g.id} active={filter === g.id} onClick={() => setFilter(g.id)}>{g.name}</Chip>
        ))}
      </div>

      {displayGroups.map(g => {
        const gAucs   = auctions.filter(a => a.group_id === g.id)
        const gMembers = members.filter(m => m.group_id === g.id)
        if (!gAucs.length) return null
        const winnerIds = gAucs.map(a => a.winner_id)

        return (
          <Card key={g.id} className="overflow-hidden mb-5">
            <div className="flex items-center justify-between px-5 py-4 border-b"
              style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold text-sm" style={{ color: 'var(--text)' }}>{g.name}</div>
              <Badge variant="blue">{gAucs.length}/{g.duration} months</Badge>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr style={{ background: 'var(--surface2)' }}>
                    <th className="px-4 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>Member</th>
                    <th className="px-3 py-2.5 text-left text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>Ticket</th>
                    {gAucs.map(a => (
                      <th key={a.month} className="px-2 py-2.5 text-center text-xs font-semibold"
                        style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)', minWidth: '36px' }}>
                        M{a.month}
                      </th>
                    ))}
                    <th className="px-4 py-2.5 text-right text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>Total Paid</th>
                    <th className="px-4 py-2.5 text-xs font-semibold uppercase tracking-wide"
                      style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {gMembers.map(m => {
                    const mPays   = payments.filter(p => p.member_id === m.id && p.group_id === g.id)
                    const paidMos = mPays.filter(p => p.status === 'paid').map(p => p.month)
                    const totalPaid = mPays.reduce((s, p) => s + Number(p.amount), 0)
                    const won = winnerIds.includes(m.id)
                    return (
                      <tr key={m.id} className="transition-colors hover:bg-[var(--surface2)]">
                        <td className="px-4 py-3 font-medium" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text)' }}>
                          {m.name}{won ? ' 👑' : ''}
                        </td>
                        <td className="px-3 py-3 text-xs" style={{ borderBottom: '1px solid var(--border)', color: 'var(--text2)' }}>
                          #{m.ticket_no}
                        </td>
                        {gAucs.map(a => {
                          const paid = paidMos.includes(a.month)
                          const p    = mPays.find(x => x.month === a.month)
                          return (
                            <td key={a.month} className="px-2 py-3 text-center"
                              style={{ borderBottom: '1px solid var(--border)' }}>
                              <span className={`pmonth ${paid ? 'paid' : 'unpaid'}`}
                                title={`Month ${a.month}: ${paid ? `Paid ${fmt(p?.amount || 0)}` : 'Pending'}`}>
                                {a.month}
                              </span>
                            </td>
                          )
                        })}
                        <td className="px-4 py-3 text-right font-mono text-sm"
                          style={{ borderBottom: '1px solid var(--border)', color: 'var(--green)' }}>
                          {fmt(totalPaid)}
                        </td>
                        <td className="px-4 py-3" style={{ borderBottom: '1px solid var(--border)' }}>
                          <Btn size="sm" variant="green" onClick={() => openPay(m.id, g.id)}>Pay</Btn>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </Card>
        )
      })}

      {displayGroups.every(g => !auctions.some(a => a.group_id === g.id)) && (
        <Empty icon="💳" text="No completed auction months yet. Record an auction first." />
      )}

      {/* Pay Modal */}
      {payModal && (
        <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Payment">
          {(() => {
            const m = members.find(x => x.id === payModal.memberId)
            const g = groups.find(x => x.id === payModal.groupId)
            return (
              <>
                <div className="p-3 rounded-lg mb-5 text-sm font-medium"
                  style={{ background: 'var(--surface2)' }}>
                  {m?.name} · {g?.name} · Ticket #{m?.ticket_no}
                </div>
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Month">
                    <select className={inputClass} style={inputStyle} value={payForm.month}
                      onChange={e => setPayForm(f => ({...f, month: e.target.value}))}>
                      {unpaidMonths.map(a => (
                        <option key={a.month} value={a.month}>
                          Month {a.month} — {fmtDate(a.auction_date)}
                        </option>
                      ))}
                    </select>
                  </Field>
                  <Field label="Amount (₹)">
                    <input className={inputClass} style={inputStyle} type="number" value={payForm.amount}
                      onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} />
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
                <div className="flex justify-end gap-3 mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
                  <Btn variant="secondary" onClick={() => setPayModal(null)}>Cancel</Btn>
                  <Btn variant="primary" loading={saving} onClick={savePay}>Record Payment</Btn>
                </div>
              </>
            )
          })()}
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
