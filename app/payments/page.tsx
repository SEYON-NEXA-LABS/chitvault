'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate, cn } from '@/lib/utils'
import { Btn, Badge, Card, Loading, Empty, Toast, Chip, Modal, Field, StatCard, Table, Th, Td, Tr } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { useFirm } from '@/lib/firm/context'
import type { Group, Member, Auction, Payment, Person } from '@/types'
import { CreditCard } from 'lucide-react'

export default function PaymentsPage() {
  const supabase = useMemo(() => createClient(), [])
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

  const load = useCallback(async (isInitial = false) => {
    if (!firm) return
    if (isInitial) setLoading(true)
    const { data: { user } } = await supabase.auth.getUser()
    setCurrentUser(user?.id || '')
    const [g, m, a, p] = await Promise.all([
      supabase.from('groups').select('*').eq('firm_id', firm.id).neq('status','archived').order('name'),
      supabase.from('members').select('*, persons(*)').eq('firm_id', firm.id).order('ticket_no'),
      supabase.from('auctions').select('*').eq('firm_id', firm.id).order('month'),
      supabase.from('payments').select('*').eq('firm_id', firm.id).order('created_at', { ascending: false }),
    ])
    setGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setPayments(p.data || [])
    setLoading(false)
  }, [firm, supabase])

  useEffect(() => { if (firm) load(true) }, [firm, load])

  function paidForMonth(memberId: number, groupId: number, month: number) {
    return payments
      .filter(p => p.member_id === memberId && p.group_id === groupId && p.month === month)
      .reduce((s, p) => s + Number(p.amount), 0)
  }

  function openPay(memberId: number, groupId: number, month?: number) {
    const g = groups.find(x => x.id === groupId)
    const gAucs = auctions.filter(a => a.group_id === groupId)
    if (!gAucs.length) { show('No auctions recorded yet.', 'error'); return }

    let targetMonth = month
    if (!targetMonth) {
      const unpaid = gAucs.find(a => {
        const paid = paidForMonth(memberId, groupId, a.month)
        const due  = g ? Number(g.monthly_contribution) - Number(a.dividend || 0) : 0
        return paid < due
      })
      if (!unpaid) { show('No pending payments.', 'error'); return }
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
    if (amount <= 0) { show('Enter valid amount', 'error'); return }
    setSaving(true)

    const balAfter = Math.max(0, amountDue - alreadyPaid - amount)
    const isPartial = balAfter > 0

    const payload: Omit<Payment, 'id' | 'created_at'> = {
      firm_id: firm.id,
      member_id: payModal.memberId,
      group_id: payModal.groupId,
      month: +payForm.month,
      amount,
      status: isPartial ? 'partial' : 'paid',
      amount_due: amountDue,
      balance_due: balAfter,
      payment_date: payForm.date,
      mode: payForm.mode as any,
      payment_type: isPartial ? 'partial' : 'full',
      collected_by: currentUser,
    }

    const { error } = await supabase.from('payments').insert(payload)
    if (error) { show(error.message, 'error'); setSaving(false); return }

    if (!isPartial) {
      // Mark all previous partials for this month as paid (redundant but cleaner for some queries)
      await supabase.from('payments').update({ status: 'paid', balance_due: 0 })
        .eq('member_id', payModal.memberId).eq('group_id', payModal.groupId).eq('month', +payForm.month)
    }

    show('Payment recorded!'); setPayModal(null); load()
    setSaving(false)
  }

  const displayGroups = useMemo(() => 
    filter === 'all' ? groups : groups.filter(g => g.id === filter)
  , [groups, filter])

  const totalCollectedToday = useMemo(() => {
    const today = new Date().toISOString().split('T')[0]
    return payments.filter(p => p.payment_date === today).reduce((s, p) => s + Number(p.amount), 0)
  }, [payments])

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Collected Today" value={fmt(totalCollectedToday)} color="green" />
        <StatCard label="Pending (Total)" value={fmt(displayGroups.reduce((s, g) => s + Number(g.chit_value), 0) - payments.filter(p => displayGroups.some(g => g.id === p.group_id)).reduce((s, p) => s + Number(p.amount), 0))} color="red" />
        <StatCard label="Active Groups" value={displayGroups.length} color="blue" />
      </div>

      <div className="flex gap-2 flex-wrap bg-[var(--surface)] p-2 rounded-2xl border" style={{ borderColor: 'var(--border)' }}>
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All Groups</Chip>
        {groups.map(g => (
          <Chip key={g.id} active={filter === g.id} onClick={() => setFilter(g.id)}>{g.name}</Chip>
        ))}
      </div>

      <div className="space-y-6">
        {displayGroups.map(g => {
          const gAucs = auctions.filter(a => a.group_id === g.id)
          const gMembers = members.filter(m => m.group_id === g.id)
          if (!gAucs.length) return null

          return (
            <Card key={g.id} title={g.name} subtitle={`${gAucs.length} auctions held`}>
              <div className="overflow-x-auto">
                <table className="w-full text-sm border-collapse">
                  <thead>
                    <tr style={{ background: 'var(--surface2)' }}>
                      {['Member','Ticket', ...gAucs.map(a => `M${a.month}`), 'Total Paid','Action'].map((h, i) => (
                        <th key={i} className="px-3 py-3 text-left text-[10px] font-black uppercase tracking-wider whitespace-nowrap"
                          style={{ color: 'var(--text3)', borderBottom: '1px solid var(--border)' }}>{h}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {gMembers.map(m => {
                      const totalPaid = payments.filter(p => p.member_id === m.id && p.group_id === g.id).reduce((s, p) => s + Number(p.amount), 0)
                      return (
                        <Tr key={m.id}>
                          <Td className="font-bold whitespace-nowrap">
                            {m.persons?.name} {m.persons?.nickname && <span className="text-[10px] opacity-40 ml-1">({m.persons.nickname})</span>}
                          </Td>
                          <Td className="font-mono text-xs opacity-50">#{m.ticket_no}</Td>
                          {gAucs.map(a => {
                            const due  = Number(g.monthly_contribution) - Number(a.dividend || 0)
                            const paid = paidForMonth(m.id, g.id, a.month)
                            const full = paid >= due
                            const partial = paid > 0 && !full
                            const pct = due > 0 ? Math.round((paid / due) * 100) : 0

                            return (
                              <td key={a.month} className="px-1 py-1 text-center" style={{ borderBottom: '1px solid var(--border)' }}>
                                <button onClick={() => (full || partial) ? setHistoryModal({ memberId: m.id, groupId: g.id, month: a.month }) : openPay(m.id, g.id, a.month)}
                                  className={cn("w-9 h-9 rounded-lg text-[10px] font-black transition-all", 
                                    full ? 'bg-[var(--green-dim)] text-[var(--green)]' : 
                                    partial ? 'bg-[var(--gold-dim)] text-[var(--gold)] border border-dashed border-[var(--gold)]' : 
                                    'bg-[var(--surface3)] text-[var(--text3)] hover:bg-[var(--border)]')}
                                  title={full ? 'Paid' : partial ? `Partial ${fmt(paid)}` : `Due ${fmt(due)}`}>
                                  {full ? '✓' : partial ? `${pct}%` : a.month}
                                </button>
                              </td>
                            )
                          })}
                          <Td className="font-bold text-[var(--green)]">{fmt(totalPaid)}</Td>
                          <Td right>
                            <Btn size="sm" variant="ghost" icon={CreditCard} onClick={() => openPay(m.id, g.id)}>Pay</Btn>
                          </Td>
                        </Tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </Card>
          )
        })}
      </div>

      {payModal && (() => {
        const m = members.find(x => x.id === payModal.memberId)
        const g = groups.find(x => x.id === payModal.groupId)
        const bal = Math.max(0, amountDue - alreadyPaid - (+payForm.amount || 0))
        const isPartial = bal > 0 && (+payForm.amount || 0) > 0

        return (
          <Modal open={!!payModal} onClose={() => setPayModal(null)} title="Record Payment">
            <div className="p-3 rounded-xl mb-5 text-sm font-medium bg-[var(--surface2)]">
               {m?.persons?.name} · {g?.name} · Ticket #{m?.ticket_no} · Month {payForm.month}
            </div>
            <div className="grid grid-cols-3 gap-3 mb-5">
              {[{l:'Due',v:fmt(amountDue),c:'var(--text)'}, {l:'Paid',v:fmt(alreadyPaid),c:'var(--green)'}, {l:'Remaining',v:fmt(amountDue-alreadyPaid),c:'var(--red)'}].map(x=>(
                <div key={x.l} className="bg-[var(--surface2)] p-2 rounded-xl text-center">
                   <div className="text-[10px] opacity-40 uppercase tracking-widest">{x.l}</div>
                   <div className="font-bold font-mono" style={{color:x.c}}>{x.v}</div>
                </div>
              ))}
            </div>
            <div className="grid grid-cols-2 gap-4">
               <Field label="Amount"><input className={inputClass} style={inputStyle} type="number" value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} /></Field>
               <Field label="Date"><input className={inputClass} style={inputStyle} type="date" value={payForm.date} onChange={e => setPayForm(f => ({...f, date: e.target.value}))} /></Field>
               <Field label="Mode"><select className={inputClass} style={inputStyle} value={payForm.mode} onChange={e => setPayForm(f => ({...f, mode: e.target.value}))}><option>Cash</option><option>UPI</option><option>Bank Transfer</option></select></Field>
            </div>
            <div className="flex justify-end gap-3 mt-6 pt-5 border-t">
              <Btn variant="secondary" onClick={() => setPayModal(null)}>Cancel</Btn>
              <Btn variant="primary" loading={saving} onClick={savePay}>Record Payment</Btn>
            </div>
          </Modal>
        )
      })()}

      {historyModal && (() => {
        const m = members.find(x => x.id === historyModal.memberId)
        const pays = payments.filter(p => p.member_id === historyModal.memberId && p.group_id === historyModal.groupId && p.month === historyModal.month)
        return (
          <Modal open={!!historyModal} onClose={() => setHistoryModal(null)} title="Payment History">
            <div className="p-3 rounded-xl mb-5 text-sm font-medium bg-[var(--surface2)]">{m?.persons?.name} · Month {historyModal.month}</div>
            <Table>
              <thead><Tr><Th>Date</Th><Th>Amount</Th><Th>Mode</Th></Tr></thead>
              <tbody>
                {pays.map(p => <Tr key={p.id}><Td>{fmtDate(p.payment_date)}</Td><Td className="font-bold text-[var(--green)]">{fmt(p.amount)}</Td><Td>{p.mode}</Td></Tr>)}
              </tbody>
            </Table>
            <div className="flex justify-end mt-6 pt-4 border-t"><Btn variant="secondary" onClick={() => setHistoryModal(null)}>Close</Btn></div>
          </Modal>
        )
      })()}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hide} />}
    </div>
  )
}
