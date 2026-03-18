'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate } from '@/lib/utils'
import {
  Btn, Badge, TableCard, Table, Th, Td, Tr,
  Modal, Field, Loading, Empty, Toast, Chip
} from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Plus, Trash2, MoreHorizontal, CreditCard, Info } from 'lucide-react'
import type { Group, Member, Auction, Payment } from '@/types'

export default function MembersPage() {
  const supabase = createClient()
  const { can } = useFirm()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [loading,  setLoading]  = useState(true)
  const [filter,   setFilter]   = useState<number | 'all'>('all')

  const [addOpen,     setAddOpen]     = useState(false)
  const [detailMember, setDetailMember] = useState<Member | null>(null)
  const [actionMember, setActionMember] = useState<Member | null>(null)
  const [saving, setSaving] = useState(false)
  const [addTab, setAddTab] = useState<'new'|'existing'>('new')

  const [form, setForm] = useState({
    name:'', phone:'', address:'', group_id:'', ticket_no:'',
    existing_id: '', contact_id: ''
  })

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

  const filtered = filter === 'all' ? members : members.filter(m => m.group_id === filter)

  function memberStats(m: Member) {
    const gAucs       = auctions.filter(a => a.group_id === m.group_id)
    const relevant    = m.exit_month ? gAucs.filter(a => a.month <= m.exit_month!) : gAucs
    const mPays       = payments.filter(p => p.member_id === m.id && p.group_id === m.group_id && p.status === 'paid')
    const paidCount   = mPays.length
    const pendingCount = relevant.length - paidCount
    const totalPaid   = mPays.reduce((s, p) => s + Number(p.amount), 0)
    const won         = auctions.some(a => a.winner_id === m.id && a.group_id === m.group_id)
    return { relevant, mPays, paidCount, pendingCount, totalPaid, won }
  }

  function statusBadge(m: Member) {
    if (m.status === 'exited')    return <Badge variant="gray">Exited M{m.exit_month}</Badge>
    if (m.status === 'defaulter') return <Badge variant="red">⚠ Defaulter</Badge>
    if (m.status === 'foreman')   return <Badge variant="blue">Foreman</Badge>
    return <Badge variant="green">Active</Badge>
  }

  async function saveMember() {
    setSaving(true)
    let payload: any
    if (addTab === 'existing' && form.existing_id) {
      const src = members.find(m => m.id === +form.existing_id)
      payload = {
        name: src?.name, phone: src?.phone, address: src?.address,
        group_id: +form.group_id, ticket_no: +form.ticket_no,
        contact_id: src?.contact_id || src?.id
      }
    } else {
      payload = { name: form.name, phone: form.phone, address: form.address,
        group_id: +form.group_id, ticket_no: +form.ticket_no }
    }
    const { data: ins, error } = await supabase.from('members').insert(payload).select().single()
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    if (addTab === 'new' && ins) {
      await supabase.from('members').update({ contact_id: ins.id }).eq('id', ins.id)
    }
    showToast('Member added!'); setAddOpen(false)
    setForm({ name:'',phone:'',address:'',group_id:'',ticket_no:'',existing_id:'',contact_id:'' })
    load()
    setSaving(false)
  }

  async function del(id: number) {
    if (!confirm('Delete this member?')) return
    await supabase.from('members').delete().eq('id', id)
    showToast('Deleted.'); load()
  }

  async function markDefaulter(id: number, notes: string) {
    await supabase.from('members').update({ status: 'defaulter', notes: notes || null }).eq('id', id)
    showToast('Marked as defaulter.'); setActionMember(null); load()
  }

  async function clearDefaulter(id: number) {
    await supabase.from('members').update({ status: 'active', notes: null }).eq('id', id)
    showToast('Status cleared.'); setActionMember(null); load()
  }

  const [defNotes, setDefNotes] = useState('')
  const [exitMonth, setExitMonth] = useState('')
  const [newTransfer, setNewTransfer] = useState({ name:'', phone:'', address:'' })

  async function transferTicket() {
    if (!actionMember || !exitMonth || !newTransfer.name) return
    await supabase.from('members').update({ status: 'exited', exit_month: +exitMonth }).eq('id', actionMember.id)
    await supabase.from('members').insert({
      name: newTransfer.name, phone: newTransfer.phone, address: newTransfer.address,
      group_id: actionMember.group_id, ticket_no: actionMember.ticket_no,
      status: 'active', firm_id: firmId!, transfer_from_id: actionMember.id
    })
    showToast(`Ticket #${actionMember.ticket_no} transferred.`); setActionMember(null); load()
  }

  if (loading) return <Loading />

  return (
    <div>
      {/* Group filter chips */}
      <div className="flex gap-2 flex-wrap mb-4">
        <Chip active={filter === 'all'} onClick={() => setFilter('all')}>All Groups</Chip>
        {groups.map(g => (
          <Chip key={g.id} active={filter === g.id} onClick={() => setFilter(g.id)}>{g.name}</Chip>
        ))}
      </div>

      <TableCard title={`Members (${filtered.length})`}
        subtitle="Green = paid · Red = pending · Faded = exited"
        actions={can('addMember') ? <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)}><Plus size={14}/> Add Member</Btn> : undefined}>
        {filtered.length === 0
          ? <Empty icon="👥" text="No members found." />
          : <Table>
              <thead><tr>
                {['Name','Phone','Group · Ticket','Status','Paid/Pending','Months','Total Paid','Actions'].map(h => <Th key={h}>{h}</Th>)}
              </tr></thead>
              <tbody>
                {filtered.map(m => {
                  const s = memberStats(m)
                  const g = groups.find(x => x.id === m.group_id)
                  const replaced = members.find(x => x.transfer_from_id === m.id)
                  return (
                    <Tr key={m.id} style={{ opacity: m.status === 'exited' ? 0.65 : 1 }}>
                      <Td>
                        <div className="font-semibold">{m.name} {s.won && '👑'}</div>
                        {replaced && <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>→ {replaced.name}</div>}
                        {m.transfer_from_id && <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>
                          ↩ from {members.find(x => x.id === m.transfer_from_id)?.name}
                        </div>}
                      </Td>
                      <Td>{m.phone || '—'}</Td>
                      <Td>{g?.name || '—'} · #{m.ticket_no}</Td>
                      <Td>{statusBadge(m)}</Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <Badge variant="green">✓{s.paidCount}</Badge>
                          {s.pendingCount > 0 && <Badge variant="red">⚠{s.pendingCount}</Badge>}
                        </div>
                      </Td>
                      <Td>
                        <div className="flex flex-wrap gap-0.5 max-w-[180px]">
                          {s.relevant.map(a => {
                            const paid = s.mPays.some(p => p.month === a.month)
                            return (
                              <span key={a.month} title={`Month ${a.month}: ${paid ? 'Paid' : 'Pending'}`}
                                className={`pmonth ${paid ? 'paid' : 'unpaid'}`}>
                                {a.month}
                              </span>
                            )
                          })}
                        </div>
                      </Td>
                      <Td right><span style={{ color: 'var(--green)' }}>{fmt(s.totalPaid)}</span></Td>
                      <Td>
                        <div className="flex items-center gap-1">
                          <Btn size="sm" variant="ghost" onClick={() => setDetailMember(m)}
                            style={{ color: 'var(--blue)' }}><Info size={13}/></Btn>
                          {m.status !== 'exited' && can('memberActions') && <>
                            <Btn size="sm" variant="green" onClick={() => setActionMember(m)} title="Record payment">
                              <CreditCard size={13}/>
                            </Btn>
                            <Btn size="sm" variant="ghost" onClick={() => setActionMember(m)}
                              style={{ color: 'var(--text2)' }}><MoreHorizontal size={13}/></Btn>
                          </>}
                          {can('deleteMember') && <Btn size="sm" variant="danger" onClick={() => del(m.id)}><Trash2 size={13}/></Btn>}
                        </div>
                      </Td>
                    </Tr>
                  )
                })}
              </tbody>
            </Table>
        }
      </TableCard>

      {/* Add Member Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Add Member">
        <div className="flex gap-1 p-1 rounded-xl mb-5" style={{ background: 'var(--surface2)' }}>
          {(['new','existing'] as const).map(t => (
            <button key={t} onClick={() => setAddTab(t)}
              className="flex-1 py-2 rounded-lg text-sm transition-all"
              style={addTab === t
                ? { background: 'var(--gold)', color: '#0d0f14', fontWeight: 700 }
                : { background: 'transparent', color: 'var(--text2)' }}>
              {t === 'new' ? 'New Person' : 'Existing Person'}
            </button>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-4">
          {addTab === 'existing' && (
            <Field label="Select Existing Person" className="col-span-2">
              <select className={inputClass} style={inputStyle}
                value={form.existing_id} onChange={e => setForm(f => ({...f, existing_id: e.target.value}))}>
                <option value="">— Choose —</option>
                {[...new Map(members.filter(m => m.status !== 'foreman')
                  .map(m => [m.phone || m.id, m])).values()].map(m => (
                  <option key={m.id} value={m.id}>{m.name}{m.phone ? ` — ${m.phone}` : ''}</option>
                ))}
              </select>
            </Field>
          )}
          {addTab === 'new' && <>
            <Field label="Full Name" className="col-span-2">
              <input className={inputClass} style={inputStyle} value={form.name}
                onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Member name" />
            </Field>
            <Field label="Phone">
              <input className={inputClass} style={inputStyle} value={form.phone}
                onChange={e => setForm(f => ({...f, phone: e.target.value}))} placeholder="Mobile" />
            </Field>
            <Field label="Address">
              <input className={inputClass} style={inputStyle} value={form.address}
                onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="City" />
            </Field>
          </>}
          <Field label="Chit Group">
            <select className={inputClass} style={inputStyle} value={form.group_id}
              onChange={e => setForm(f => ({...f, group_id: e.target.value}))}>
              <option value="">Select group</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          <Field label="Ticket Number">
            <input className={inputClass} style={inputStyle} type="number" value={form.ticket_no}
              onChange={e => setForm(f => ({...f, ticket_no: e.target.value}))} placeholder="e.g. 5" />
          </Field>
        </div>
        <div className="flex justify-end gap-3 mt-6 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={saveMember}>Add Member</Btn>
        </div>
      </Modal>

      {/* Member Actions Modal */}
      {actionMember && (
        <Modal open={!!actionMember} onClose={() => setActionMember(null)} title="Member Actions" size="lg">
          <div className="p-3 rounded-lg mb-5 text-sm font-medium"
            style={{ background: 'var(--surface2)' }}>
            {actionMember.name} · {groups.find(g => g.id === actionMember.group_id)?.name} · Ticket #{actionMember.ticket_no}
          </div>
          <div className="space-y-4">
            {/* Transfer */}
            <div className="border rounded-xl p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold mb-1 text-sm">🔄 Transfer Ticket to New Member</div>
              <div className="text-xs mb-3" style={{ color: 'var(--text2)' }}>Member exits. New person takes over from a specific month.</div>
              <div className="grid grid-cols-2 gap-3">
                <Field label="Exit After Month">
                  <select className={inputClass} style={inputStyle} value={exitMonth} onChange={e => setExitMonth(e.target.value)}>
                    <option value="">Select month</option>
                    {auctions.filter(a => a.group_id === actionMember.group_id).map(a =>
                      <option key={a.month} value={a.month}>Month {a.month}</option>)}
                  </select>
                </Field>
                <Field label="New Member Name">
                  <input className={inputClass} style={inputStyle} value={newTransfer.name}
                    onChange={e => setNewTransfer(t => ({...t, name: e.target.value}))} placeholder="Full name" />
                </Field>
                <Field label="Phone">
                  <input className={inputClass} style={inputStyle} value={newTransfer.phone}
                    onChange={e => setNewTransfer(t => ({...t, phone: e.target.value}))} />
                </Field>
                <Field label="Address">
                  <input className={inputClass} style={inputStyle} value={newTransfer.address}
                    onChange={e => setNewTransfer(t => ({...t, address: e.target.value}))} />
                </Field>
              </div>
              <Btn variant="primary" size="sm" className="mt-3" onClick={transferTicket}>Transfer Ticket</Btn>
            </div>
            {/* Defaulter */}
            <div className="border rounded-xl p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold mb-1 text-sm">⚠️ Mark as Defaulter</div>
              <div className="text-xs mb-3" style={{ color: 'var(--text2)' }}>Stays on record. Pending tracked as debt in collection report.</div>
              <Field label="Notes (optional)">
                <input className={inputClass} style={inputStyle} value={defNotes}
                  onChange={e => setDefNotes(e.target.value)} placeholder="e.g. Unreachable since March" />
              </Field>
              <div className="flex gap-2 mt-3">
                <Btn variant="danger" size="sm" onClick={() => markDefaulter(actionMember.id, defNotes)}>Mark as Defaulter</Btn>
                {actionMember.status === 'defaulter' &&
                  <Btn variant="secondary" size="sm" onClick={() => clearDefaulter(actionMember.id)}>Clear Status</Btn>}
              </div>
            </div>
            {/* Foreman */}
            <div className="border rounded-xl p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold mb-1 text-sm">🏦 Foreman Absorbs Ticket</div>
              <div className="text-xs mb-3" style={{ color: 'var(--text2)' }}>Exit member. Foreman takes over for remaining months.</div>
              <Field label="Exit After Month">
                <select className={inputClass} style={inputStyle} id="fa_exit"
                  defaultValue="">
                  <option value="">Select month</option>
                  {auctions.filter(a => a.group_id === actionMember.group_id).map(a =>
                    <option key={a.month} value={a.month}>Month {a.month}</option>)}
                </select>
              </Field>
              <Btn size="sm" className="mt-3"
                style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(91,138,245,0.3)' }}
                onClick={async () => {
                  const sel = document.getElementById('fa_exit') as HTMLSelectElement
                  const em  = +sel.value; if (!em) return
                  await supabase.from('members').update({ status: 'exited', exit_month: em }).eq('id', actionMember.id)
                  await supabase.from('members').insert({
                    name: 'Foreman', group_id: actionMember.group_id, ticket_no: actionMember.ticket_no,
                    status: 'foreman', transfer_from_id: actionMember.id
                  })
                  showToast('Foreman absorbed ticket.'); setActionMember(null); load()
                }}>
                Foreman Takes Over
              </Btn>
            </div>
          </div>
          <div className="flex justify-end mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <Btn variant="secondary" onClick={() => setActionMember(null)}>Close</Btn>
          </div>
        </Modal>
      )}

      {/* Detail Modal */}
      {detailMember && (() => {
        const m = detailMember
        const s = memberStats(m)
        const g = groups.find(x => x.id === m.group_id)
        const remaining = g ? g.duration - auctions.filter(a => a.group_id === m.group_id).length : 0
        const pendingList = s.relevant.filter(a => !s.mPays.find(p => p.month === a.month))
        return (
          <Modal open={!!detailMember} onClose={() => setDetailMember(null)} title={m.name} size="lg">
            {/* Summary cards */}
            <div className="grid grid-cols-4 gap-3 mb-5">
              {[
                { label: 'Paid', val: s.paidCount, unit: 'months', color: 'var(--green)' },
                { label: 'Pending', val: s.pendingCount, unit: 'months', color: s.pendingCount > 0 ? 'var(--red)' : 'var(--green)' },
                { label: 'Remaining', val: remaining, unit: 'months left', color: 'var(--blue)' },
                { label: 'Total Paid', val: fmt(s.totalPaid), unit: '', color: 'var(--gold)' },
              ].map(c => (
                <div key={c.label} className="rounded-xl p-3 text-center" style={{ background: 'var(--surface2)' }}>
                  <div className="text-xs uppercase tracking-wide mb-1" style={{ color: 'var(--text3)' }}>{c.label}</div>
                  <div className="font-mono font-bold text-xl" style={{ color: c.color }}>{c.val}</div>
                  {c.unit && <div className="text-xs mt-0.5" style={{ color: 'var(--text3)' }}>{c.unit}</div>}
                </div>
              ))}
            </div>
            {/* Info */}
            <div className="flex gap-4 flex-wrap text-xs mb-4" style={{ color: 'var(--text2)' }}>
              <span>📞 {m.phone||'—'}</span>
              <span>🏠 {m.address||'—'}</span>
              <span>🎟 #{m.ticket_no}</span>
              <span>👥 {g?.name}</span>
              {s.won && <Badge variant="gold">👑 Won</Badge>}
            </div>
            {/* Pending alert */}
            {pendingList.length > 0 && (
              <div className="p-3 rounded-lg mb-4 text-sm" style={{ background: 'var(--red-dim)', color: 'var(--red)' }}>
                ⚠ Pending months: {pendingList.map(a => `Month ${a.month}`).join(', ')}
              </div>
            )}
            {/* Payment rows */}
            <div className="text-xs font-bold uppercase tracking-wide mb-2" style={{ color: 'var(--text2)' }}>Payment History</div>
            <div className="max-h-64 overflow-y-auto rounded-xl border" style={{ borderColor: 'var(--border)' }}>
              <Table>
                <thead><tr>{['Month','Date','Auction','Amount','Paid On','Mode','Status'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                <tbody>
                  {s.relevant.map(a => {
                    const p = s.mPays.find(x => x.month === a.month)
                    return (
                      <Tr key={a.month}>
                        <Td><Badge variant="blue">M{a.month}</Badge></Td>
                        <Td>{fmtDate(a.auction_date)}</Td>
                        <Td>{a.winner_id === m.id ? <Badge variant="gold">👑 Won</Badge> : '—'}</Td>
                        <Td right>{p ? fmt(p.amount) : '—'}</Td>
                        <Td>{p ? fmtDate(p.payment_date) : '—'}</Td>
                        <Td>{p ? <span className="text-xs" style={{ color: 'var(--text2)' }}>{p.mode}</span> : '—'}</Td>
                        <Td>{p ? <Badge variant="green">✓ Paid</Badge> : <Badge variant="red">⚠ Pending</Badge>}</Td>
                      </Tr>
                    )
                  })}
                </tbody>
              </Table>
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="secondary" onClick={() => setDetailMember(null)}>Close</Btn>
            </div>
          </Modal>
        )
      })()}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
