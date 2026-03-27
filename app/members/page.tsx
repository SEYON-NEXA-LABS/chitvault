'use client'

import { useEffect, useState, useCallback } from 'react'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, cn } from '@/lib/utils'
import {
  Btn, Badge, TableCard, Table, Th, Td, Tr,
  Modal, Field, Loading, Empty, Toast, Chip
} from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { Plus, Trash2, MoreHorizontal, CreditCard, Info, Edit, User, UserCheck, History, Phone, MapPin } from 'lucide-react'
import type { Group, Member, Auction, Payment } from '@/types'

interface Contact {
  id: number;
  name: string;
  phone: string;
  address: string;
  tickets: Member[];
  totalPaid: number;
  activeCount: number;
  pastCount: number;
}

export default function MembersPage() {
  const supabase = createClient()
  const { firm, role, can } = useFirm()
  const isSuper = role === 'superadmin'
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [members,   setMembers]   = useState<Member[]>([])
  const [auctions,  setAuctions]  = useState<Auction[]>([])
  const [payments,  setPayments]  = useState<Payment[]>([])
  const [loading,   setLoading]   = useState(true)
  
  const [view,   setView]   = useState<'people' | 'groups'>('people')
  const [filter, setFilter] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')

  const [addOpen,      setAddOpen]      = useState(false)
  const [detailContact, setDetailContact] = useState<Contact | null>(null)
  const [actionMember,  setActionMember]  = useState<Member | null>(null)
  const [payMember,     setPayMember]     = useState<Member | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [addTab,        setAddTab]        = useState<'new'|'existing'>('new')

  const [form, setForm] = useState({ name:'', phone:'', address:'', group_id:'', ticket_no:'', existing_id: '' })
  const [editForm, setEditForm] = useState({ name:'', phone:'', address:'' })
  const [payForm,  setPayForm]  = useState({ amount: '', payment_date: new Date().toISOString().substring(0, 10), mode: 'Cash', month: '' })
  const [isEditing, setIsEditing] = useState(false)

  const load = useCallback(async () => {
    setLoading(true)
    const [g, m, a, p] = await Promise.all([
      supabase.from('groups').select('*, firms(name)').order('name'),
      supabase.from('members').select('*, firms(name)').order('ticket_no'),
      supabase.from('auctions').select('*').order('month'),
      supabase.from('payments').select('*'),
    ])
    setAllGroups(g.data || [])
    setMembers(m.data || [])
    setAuctions(a.data || [])
    setPayments(p.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { load() }, [load])

  useEffect(() => {
    // When payMember is set, initialize the form
    if (payMember) {
      const group = allGroups.find(g => g.id === payMember.group_id)
      if (!group) return

      const memberPayments = payments.filter(p => p.member_id === payMember.id && p.group_id === payMember.group_id)

      // Find all months that aren't fully paid
      const allMonths = Array.from({ length: group.duration }, (_, i) => i + 1)
      const payableMonths = allMonths.filter(month => {
        const paidForMonth = memberPayments
          .filter(p => p.month === month)
          .reduce((sum, p) => sum + Number(p.amount), 0)
        return paidForMonth < group.monthly_contribution
      })

      // Default to the first payable month (which will be the first pending month)
      const defaultMonth = payableMonths.length > 0 ? payableMonths[0] : null

      if (defaultMonth) {
        const paidForMonth = memberPayments
          .filter(p => p.month === defaultMonth)
          .reduce((sum, p) => sum + Number(p.amount), 0)
        const balance = Math.max(0, group.monthly_contribution - paidForMonth)

        setPayForm({
          month: String(defaultMonth),
          amount: String(balance),
          payment_date: new Date().toISOString().substring(0, 10),
          mode: 'Cash',
        })
      } else {
        // All payments are settled
        showToast('All payments for this member are settled!', 'success')
        setPayMember(null)
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [payMember])

  const contacts: Contact[] = useCallback(() => {
    const map = new Map<number, Contact>()
    
    // Group members by their contact identity
    members.forEach(m => {
       const cid = m.contact_id || m.id
       const g = allGroups.find(x => x.id === m.group_id)
       const isArchived = g?.status === 'archived'
       
       const mPays = payments.filter(p => p.member_id === m.id && p.group_id === m.group_id && p.status === 'paid')
       const paid = mPays.reduce((s, p) => s + Number(p.amount), 0)

       if (!map.has(cid)) {
         map.set(cid, {
           id: cid, name: m.name, phone: m.phone || '', address: m.address || '',
           tickets: [m], totalPaid: paid, 
           activeCount: isArchived ? 0 : 1, pastCount: isArchived ? 1 : 0
         })
       } else {
         const c = map.get(cid)!
         c.tickets.push(m)
         c.totalPaid += paid
         if (isArchived) c.pastCount++
         else c.activeCount++
         // Use the person details from the most recent or main group if needed
       }
    })
    
    return Array.from(map.values())
  }, [members, allGroups, payments])()

  const filteredPeople = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    c.phone.includes(search)
  ).sort((a,b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))

  async function saveMember() {
    setSaving(true)
    let payload: any
    if (addTab === 'existing' && form.existing_id) {
      const src = contacts.find(c => c.id === +form.existing_id)
      payload = { name: src?.name, phone: src?.phone, address: src?.address, group_id: +form.group_id, ticket_no: +form.ticket_no, contact_id: src?.id }
    } else {
      payload = { name: form.name, phone: form.phone, address: form.address, group_id: +form.group_id, ticket_no: +form.ticket_no }
    }
    const { data: userData } = await supabase.auth.getUser()
    const { data: ins, error } = await supabase.from('members').insert({ ...payload, created_by: userData.user?.id }).select().single()
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    if (addTab === 'new' && ins) {
      await supabase.from('members').update({ contact_id: ins.id }).eq('id', ins.id)
    }
    showToast('Member enrolled!'); setAddOpen(false)
    setForm({ name:'',phone:'',address:'',group_id:'',ticket_no:'',existing_id:'' })
    load()
    setSaving(false)
  }

  async function updateContact() {
    if (!detailContact) return
    setSaving(true)
    const { data: userData } = await supabase.auth.getUser()
    // Update all member records linked to this contact_id for consistency
    const { error } = await supabase.from('members')
      .update({ 
        name: editForm.name, 
        phone: editForm.phone, 
        address: editForm.address,
        updated_by: userData.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('contact_id', detailContact.id)
      
    if (error) { showToast(error.message, 'error'); setSaving(false); return }
    showToast('Contact updated!')
    setSaving(false); setIsEditing(false); setDetailContact(null); load()
  }

  async function savePay() {
    if (!payMember || !payForm.month || !payForm.amount) { showToast('Missing details', 'error'); return }
    setSaving(true)
    const group = allGroups.find(g => g.id === payMember.group_id)
    const amountDue = group?.monthly_contribution || 0
    const alreadyPaid = payments.filter(p => p.member_id === payMember.id && p.group_id === payMember.group_id && p.month === +payForm.month).reduce((s, p) => s + Number(p.amount), 0)
    const balanceDue = Math.max(0, amountDue - alreadyPaid - (+payForm.amount || 0))
    const isPartial = balanceDue > 0

    const payload: Omit<Payment, 'id'|'created_at'> = {
      firm_id: payMember.firm_id,
      member_id: payMember.id,
      group_id: payMember.group_id,
      month: +payForm.month,
      amount: +payForm.amount,
      payment_date: payForm.payment_date,
      mode: payForm.mode as any,
      status: isPartial ? 'partial' : 'paid',
      amount_due: amountDue,
      balance_due: balanceDue,
      payment_type: isPartial ? 'partial' : 'full',
      collected_by: null,
    }
    const { error } = await supabase.from('payments').insert(payload)
    if (error) { showToast(error.message, 'error'); setSaving(false); return }

    if (!isPartial) {
      await supabase.from('payments')
        .update({ status: 'paid', balance_due: 0 })
        .eq('member_id', payMember.id)
        .eq('group_id', payMember.group_id)
        .eq('month', +payForm.month)
    }
    showToast('Payment recorded!')
    setSaving(false); setPayMember(null); load()
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
    if (!actionMember || !exitMonth || !newTransfer.name || !firm) return
    await supabase.from('members').update({ status: 'exited', exit_month: +exitMonth }).eq('id', actionMember.id)
    await supabase.from('members').insert({ name: newTransfer.name, phone: newTransfer.phone, address: newTransfer.address, group_id: actionMember.group_id, ticket_no: actionMember.ticket_no, status: 'active', firm_id: firm.id, transfer_from_id: actionMember.id })
    showToast(`Ticket #${actionMember.ticket_no} transferred.`); setActionMember(null); load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      {/* ── View Controls ─────────────────────────────── */}
      <div className="flex items-center justify-between gap-4 flex-wrap bg-[var(--surface)] p-2 rounded-2xl border shadow-sm" style={{ borderColor: 'var(--border)' }}>
         <div className="flex gap-1">
            <button onClick={() => setView('people')} 
              className={cn("px-5 py-2 rounded-xl text-sm font-bold transition-all", view === 'people' ? 'bg-[var(--gold)] text-white shadow-md' : 'text-[var(--text3)] hover:text-[var(--text2)]')}>
              People Directory
            </button>
            <button onClick={() => setView('groups')} 
              className={cn("px-5 py-2 rounded-xl text-sm font-bold transition-all", view === 'groups' ? 'bg-[var(--gold)] text-white shadow-md' : 'text-[var(--text3)] hover:text-[var(--text2)]')}>
              By Groups
            </button>
         </div>
         <div className="flex-1 max-w-sm relative">
            <input className={inputClass} style={{ ...inputStyle, paddingLeft: 40 }} placeholder="Search name or phone..." value={search} onChange={e => setSearch(e.target.value)} />
            <span className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30"><User size={18}/></span>
         </div>
         {can('addMember') && <Btn variant="primary" onClick={() => setAddOpen(true)} icon={Plus}>Enroll Member</Btn>}
      </div>

      {view === 'people' ? (
        <TableCard title={`Total Contacts (${filteredPeople.length})`} subtitle="Persons enrolled across all active & past groups.">
          <Table>
            <thead><tr>
              {isSuper && <Th>Firm</Th>}
              {['Person','Phone','Active Tickets','Past Tickets','Contribution','Actions'].map(h => <Th key={h} right={h === 'Contribution'}>{h}</Th>)}
            </tr></thead>
            <tbody>
              {filteredPeople.map(c => (
                <Tr key={c.id}>
                  {isSuper && <Td><Badge variant="gray">{c.tickets[0]?.firms?.name}</Badge></Td>}
                  <Td>
                    <div className="font-bold text-[var(--text)]">{c.name}</div>
                    <div className="text-[10px] opacity-50 flex items-center gap-1 mt-0.5"><MapPin size={10}/> {c.address || 'No address'}</div>
                  </Td>
                  <Td className="font-mono text-xs">{c.phone || '—'}</Td>
                  <Td>
                    {c.activeCount > 0 ? <Badge variant="blue"><UserCheck size={10} className="mr-1"/> {c.activeCount} Active</Badge> : <span className="text-xs opacity-30">None</span>}
                  </Td>
                  <Td>
                    {c.pastCount > 0 ? <Badge variant="gray"><History size={10} className="mr-1"/> {c.pastCount} Terminated</Badge> : <span className="text-xs opacity-30">None</span>}
                  </Td>
                  <Td right className="font-bold text-[var(--green)]">{fmt(c.totalPaid)}</Td>
                  <Td>
                    <div className="flex gap-1.5 justify-end">
                      <Btn size="sm" variant="ghost" icon={Info} onClick={() => { setDetailContact(c); setEditForm({ name: c.name, phone: c.phone, address: c.address }); setIsEditing(false) }} style={{ color: 'var(--blue)' }}>Profile</Btn>
                      <Btn size="sm" variant="ghost" icon={Plus} onClick={() => { setAddOpen(true); setAddTab('existing'); setForm(f => ({...f, existing_id: String(c.id)})) }}>Add Group</Btn>
                    </div>
                  </Td>
                </Tr>
              ))}
            </tbody>
          </Table>
        </TableCard>
      ) : (
        <div className="space-y-4">
           {allGroups.filter(g => g.status !== 'archived').map(g => {
              const gMembers = members.filter(m => m.group_id === g.id)
              return (
                <TableCard key={g.id} title={g.name} subtitle={`${gMembers.length} members enrolled`}
                  actions={isSuper && <Badge variant="gold">Owned by: {g.firms?.name}</Badge>}>
                  <Table>
                     <thead><tr>{['Ticket','Name','Phone','Status','Action'].map(h => <Th key={h}>{h}</Th>)}</tr></thead>
                     <tbody>
                        {gMembers.map(m => (
                          <Tr key={m.id}>
                            <Td className="font-mono font-bold">#{m.ticket_no}</Td>
                            <Td className="font-semibold">{m.name}</Td>
                            <Td className="text-xs">{m.phone}</Td>
                            <Td>
                               {m.status === 'foreman' ? <Badge variant="blue">Foreman</Badge> : <Badge variant="green">Active</Badge>}
                            </Td>
                            <Td>
                               <Btn size="sm" variant="ghost" icon={CreditCard} onClick={() => setPayMember(m)}>Pay</Btn>
                            </Td>
                          </Tr>
                        ))}
                     </tbody>
                  </Table>
                </TableCard>
              )
           })}
        </div>
      )}

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
                {[...new Map(contacts.map(c => [c.phone || c.name, c])).values()].map(c => (
                  <option key={c.id} value={c.id}>{c.name}{c.phone ? ` — ${c.phone}` : ''}</option>
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
              <input className={inputClass} style={inputStyle} value={form.phone} type="tel" maxLength={10} pattern="[0-9]{10}" title="10-digit mobile number"
                onChange={e => setForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} placeholder="Mobile (10 digits)" />
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
              {allGroups.filter(g => g.status !== 'archived').map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
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

      {actionMember && (
        <Modal open={!!actionMember} onClose={() => setActionMember(null)} title="Member Actions" size="lg">
          <div className="p-3 rounded-lg mb-5 text-sm font-medium" style={{ background: 'var(--surface2)' }}>
            {actionMember.name} · {allGroups.find(g => g.id === actionMember.group_id)?.name} · Ticket #{actionMember.ticket_no}
          </div>
          <div className="space-y-4">
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
                  <input className={inputClass} style={inputStyle} value={newTransfer.phone} type="tel" maxLength={10} pattern="[0-9]{10}" title="10-digit mobile number"
                    onChange={e => setNewTransfer(t => ({...t, phone: e.target.value.replace(/\D/g,'')}))} placeholder="Mobile" />
                </Field>
                <Field label="Address">
                  <input className={inputClass} style={inputStyle} value={newTransfer.address}
                    onChange={e => setNewTransfer(t => ({...t, address: e.target.value}))} />
                </Field>
              </div>
              <Btn variant="primary" size="sm" className="mt-3" onClick={transferTicket}>Transfer Ticket</Btn>
            </div>
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
            <div className="border rounded-xl p-4" style={{ borderColor: 'var(--border)' }}>
              <div className="font-semibold mb-1 text-sm">🏦 Foreman Absorbs Ticket</div>
              <div className="text-xs mb-3" style={{ color: 'var(--text2)' }}>Exit member. Foreman takes over for remaining months.</div>
              <Field label="Exit After Month">
                <select className={inputClass} style={inputStyle} id="fa_exit" defaultValue="">
                  <option value="">Select month</option>
                  {auctions.filter(a => a.group_id === actionMember.group_id).map(a =>
                    <option key={a.month} value={a.month}>Month {a.month}</option>)}
                </select>
              </Field>
              <Btn size="sm" className="mt-3"
                style={{ background: 'var(--blue-dim)', color: 'var(--blue)', border: '1px solid rgba(91,138,245,0.3)' }}
                onClick={async () => {
                  if (!firm) return
                  const sel = document.getElementById('fa_exit') as HTMLSelectElement
                  const em  = +sel.value; if (!em) return
                  await supabase.from('members').update({ status: 'exited', exit_month: em }).eq('id', actionMember.id)
                  await supabase.from('members').insert({ name: 'Foreman', group_id: actionMember.group_id, ticket_no: actionMember.ticket_no, status: 'foreman', transfer_from_id: actionMember.id, firm_id: firm.id })
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

      {payMember && (() => {
        const m = payMember
        const group = allGroups.find(g => g.id === m.group_id)
        if (!group) return null

        const memberPayments = payments.filter(p => p.member_id === m.id && p.group_id === m.group_id)
        
        const allMonths = Array.from({ length: group.duration }, (_, i) => i + 1)
        const payableMonths = allMonths.filter(month => {
          const paidForMonth = memberPayments
            .filter(p => p.month === month)
            .reduce((sum, p) => sum + Number(p.amount), 0)
          return paidForMonth < group.monthly_contribution
        })

        const selectedMonth = +payForm.month
        const alreadyPaid = memberPayments
            .filter(p => p.month === selectedMonth)
            .reduce((s, p) => s + Number(p.amount), 0)

        const balance = Math.max(0, group.monthly_contribution - alreadyPaid)

        return (
          <Modal open={!!payMember} onClose={() => setPayMember(null)} title="Record Payment">
            <div className="p-3 rounded-xl mb-5 text-sm font-medium flex items-center justify-between"
              style={{ background: 'var(--surface2)' }}>
              <span>{m?.name} · {group?.name} · Ticket #{m?.ticket_no}</span>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Month">
                <select className={inputClass} style={inputStyle} value={payForm.month}
                  onChange={e => {
                    const newMonth = +e.target.value
                    const paidForMonth = memberPayments.filter(p => p.month === newMonth).reduce((s, p) => s + Number(p.amount), 0)
                    const newBalance = Math.max(0, group.monthly_contribution - paidForMonth)
                    setPayForm(f => ({...f, month: e.target.value, amount: String(newBalance)})) 
                  }}>
                  <option value="">Select month</option>
                  {payableMonths.map(month => <option key={month} value={month}>Month {month}</option>)}
                </select>
              </Field>
              <Field label={`Amount (Balance: ${fmt(balance)})`}>
                <input className={inputClass} style={inputStyle} type="number" value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} placeholder={String(balance)} />
              </Field>
              <Field label="Payment Date">
                <input className={inputClass} style={inputStyle} type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({...f, payment_date: e.target.value}))} />
              </Field>
              <Field label="Mode">
                <select className={inputClass} style={inputStyle} value={payForm.mode} onChange={e => setPayForm(f => ({...f, mode: e.target.value}))}>
                  <option>Cash</option> <option>Bank Transfer</option> <option>UPI</option>
                </select>
              </Field>
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="secondary" onClick={() => setPayMember(null)}>Cancel</Btn>
              <Btn variant="primary" loading={saving} onClick={savePay}>Record Payment</Btn>
            </div>
          </Modal>
        )
      })()}

      {detailContact && (() => {
        const c = detailContact
        return (
          <Modal open={!!detailContact} onClose={() => setDetailContact(null)} title={isEditing ? `Edit Contact: ${c.name}` : `${c.name} Profile`} size="lg">
            {!isEditing ? (
              <div className="space-y-6">
                <div className="grid grid-cols-2 gap-4">
                   <div className="bg-[var(--surface2)] p-4 rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-12 h-12 rounded-full bg-[var(--gold)] flex items-center justify-center text-white text-xl font-bold">
                            {c.name.charAt(0)}
                         </div>
                         <div>
                            <div className="font-bold text-lg">{c.name}</div>
                            <div className="text-sm opacity-50 flex items-center gap-1"><Phone size={12}/> {c.phone}</div>
                         </div>
                      </div>
                      <div className="text-xs flex items-center gap-1 opacity-50"><MapPin size={12}/> {c.address}</div>
                   </div>
                   <div className="bg-[var(--gold-dim)] p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-xs uppercase tracking-widest opacity-50 mb-1">Total Contribution</div>
                      <div className="text-3xl font-black text-[var(--gold)]">{fmt(c.totalPaid)}</div>
                      <div className="text-xs mt-2 opacity-50">Across {c.tickets.length} tickets</div>
                   </div>
                </div>

                <div className="space-y-3">
                   <div className="text-xs font-bold uppercase tracking-wider opacity-50">Group Involvements</div>
                   <div className="grid gap-2">
                      {c.tickets.map(m => {
                         const g = allGroups.find(x => x.id === m.group_id)
                         const isArchived = g?.status === 'archived'
                         return (
                            <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                               <div className="flex items-center gap-3">
                                  {isArchived ? <History size={16} className="text-[var(--text3)]"/> : <UserCheck size={16} className="text-[var(--blue)]"/>}
                                  <div>
                                     <div className="font-bold text-sm">{g?.name} <span className="text-[10px] opacity-40 ml-1">#{m.ticket_no}</span></div>
                                     <div className="text-[10px] opacity-50">{isArchived ? 'Completed & Archived' : 'Currently Active'}</div>
                                  </div>
                               </div>
                               <div className="flex items-center gap-2">
                                  {!isArchived && <Btn size="sm" variant="ghost" onClick={() => { setPayMember(m); setDetailContact(null) }}>Pay</Btn>}
                                  <Btn size="sm" variant="ghost" onClick={() => { setActionMember(m); setDetailContact(null) }}><MoreHorizontal size={14}/></Btn>
                               </div>
                            </div>
                         )
                      })}
                   </div>
                </div>
              </div>
            ) : (
                <div className="grid grid-cols-2 gap-4">
                  <Field label="Full Name">
                    <input className={inputClass} style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} />
                  </Field>
                  <Field label="Phone">
                    <input className={inputClass} style={inputStyle} value={editForm.phone} type="tel" maxLength={10} onChange={e => setEditForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} />
                  </Field>
                  <Field label="Address" className="col-span-2">
                    <input className={inputClass} style={inputStyle} value={editForm.address} onChange={e => setEditForm(f => ({...f, address: e.target.value}))} />
                  </Field>
                </div>
            )}

            <div className="flex justify-end gap-3 mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              {isEditing ? (
                 <>
                   <Btn variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Btn>
                   <Btn variant="primary" loading={saving} onClick={updateContact}>Save Profile</Btn>
                 </>
              ) : (
                 <>
                   <Btn variant="secondary" onClick={() => setDetailContact(null)}>Close</Btn>
                   {can('editMember') && <Btn variant="primary" icon={Edit} onClick={() => setIsEditing(true)}>Edit Profile</Btn>}
                 </>
              )}
            </div>
          </Modal>
        )
      })()}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
