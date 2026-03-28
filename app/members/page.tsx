'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
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
import type { Group, Member, Auction, Payment, Person } from '@/types'

interface Contact extends Person {
  tickets: Member[];
  totalPaid: number;
  totalBalance: number;
  activeCount: number;
  pastCount: number;
}

export default function MembersPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can } = useFirm()
  const isSuper = role === 'superadmin'
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [allGroups, setAllGroups] = useState<Group[]>([])
  const [members,   setMembers]   = useState<Member[]>([])
  const [persons,   setPersons]   = useState<Person[]>([])
  const [auctions,  setAuctions]  = useState<Auction[]>([])
  const [payments,  setPayments]  = useState<Payment[]>([])
  const [loading,   setLoading]   = useState(true)
  
  const [view,   setView]   = useState<'people' | 'groups'>('people')
  const [filter, setFilter] = useState<number | 'all'>('all')
  const [search, setSearch] = useState('')

  const [addOpen,       setAddOpen]       = useState(false)
  const [detailContact, setDetailContact] = useState<Contact | null>(null)
  const [actionMember,  setActionMember]  = useState<Member | null>(null)
  const [payMember,     setPayMember]     = useState<Member | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [addTab,        setAddTab]        = useState<'new'|'existing'>('new')

  const [form, setForm] = useState({ name:'', nickname: '', phone:'', address:'', group_id:'', num_tickets: '1', existing_id: '' })
  const [editForm, setEditForm] = useState({ name:'', nickname: '', phone:'', address:'' })
  const [payForm,  setPayForm]  = useState({ amount: '', payment_date: new Date().toISOString().substring(0, 10), mode: 'Cash', month: '' })
  const [isEditing, setIsEditing] = useState(false)

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const [g, m, p, a, pay] = await Promise.all([
      supabase.from('groups').select('*, firms(name)').order('name'),
      supabase.from('members').select('*, persons(*)').order('ticket_no'),
      supabase.from('persons').select('*').order('name'),
      supabase.from('auctions').select('*').order('month'),
      supabase.from('payments').select('*'),
    ])
    setAllGroups(g.data || [])
    setMembers(m.data || [])
    setPersons(p.data || [])
    setAuctions(a.data || [])
    setPayments(pay.data || [])
    setLoading(false)
  }, [supabase])

  useEffect(() => { if (firm) load(true) }, [load])

  useEffect(() => {
    if (payMember) {
      const p = payMember.persons
      const group = allGroups.find(g => g.id === payMember.group_id)
      if (!group || !p) return

      const mPayments = payments.filter(pay => pay.member_id === payMember.id && pay.group_id === payMember.group_id)

      const allMonths = Array.from({ length: group.duration }, (_, i) => i + 1)
      const payableMonths = allMonths.filter(month => {
        const paidForMonth = mPayments.filter(pay => pay.month === month).reduce((sum, pay) => sum + Number(pay.amount), 0)
        return paidForMonth < group.monthly_contribution
      })

      const defaultMonth = payableMonths.length > 0 ? payableMonths[0] : null
      if (defaultMonth) {
        const paid = mPayments.filter(pay => pay.month === defaultMonth).reduce((sum, pay) => sum + Number(pay.amount), 0)
        const balance = Math.max(0, group.monthly_contribution - paid)
        setPayForm({
          month: String(defaultMonth),
          amount: String(balance),
          payment_date: new Date().toISOString().substring(0, 10),
          mode: 'Cash',
        })
      } else {
        showToast('All payments for this member are settled!', 'success')
        setPayMember(null)
      }
    }
  }, [payMember, allGroups, payments, showToast])

  const contacts: Contact[] = useMemo(() => {
    return persons.map(p => {
       const pMembers = members.filter(m => m.person_id === p.id)
       const activeCount = pMembers.filter(m => {
          const g = allGroups.find(x => x.id === m.group_id)
          return g && g.status !== 'archived'
       }).length
       const pastCount = pMembers.filter(m => {
          const g = allGroups.find(x => x.id === m.group_id)
          return g && g.status === 'archived'
       }).length
       
       const totalPaid = payments
         .filter(pay => pMembers.some(m => m.id === pay.member_id))
         .reduce((s, pay) => s + Number(pay.amount), 0)

       // Consolidated Balance Calculation
       let totalBalance = 0;
       pMembers.forEach(m => {
          const group = allGroups.find(g => g.id === m.group_id);
          if (!group || group.status === 'archived') return;
          const gAucs = auctions.filter(a => a.group_id === group.id);
          const mPays = payments.filter(pay => pay.member_id === m.id && pay.group_id === group.id);
          const currentMonth = Math.min(group.duration, gAucs.length + 1);
          
          for (let month = 1; month <= currentMonth; month++) {
            const auc = gAucs.find(a => a.month === month);
            const dividend = auc ? Number(auc.dividend || 0) : 0;
            const amountDue = Number(group.monthly_contribution) - dividend;
            const amountPaid = mPays.filter(pay => pay.month === month).reduce((s, p) => s + Number(p.amount), 0);
            totalBalance += Math.max(0, amountDue - amountPaid);
          }
       });

       return {
         ...p,
         tickets: pMembers,
         totalPaid,
         totalBalance,
         activeCount,
         pastCount
       } as Contact
    })
  }, [persons, members, allGroups, payments, auctions])

  const filteredPeople = contacts.filter(c => 
    c.name.toLowerCase().includes(search.toLowerCase()) || 
    (c.phone && c.phone.includes(search))
  ).sort((a,b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))

  async function saveMember() {
    if (!firm) { showToast('Session error!', 'error'); return }
    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    
    const { data: pData, error: pErr } = await supabase.from('persons')
      .insert({
        name: form.name,
        nickname: form.nickname,
        phone: form.phone,
        address: form.address,
        firm_id: firm.id,
        created_by: authData.user?.id
      })
      .select()
      .single()
      
    if (pErr) { showToast(pErr.message, 'error'); setSaving(false); return }

    showToast('Person registered!'); 
    setAddOpen(false)
    setForm({ name:'',nickname:'',phone:'',address:'',group_id:'',num_tickets:'1',existing_id:'' })
    load()
    setSaving(false)
  }

  async function updateContact() {
    if (!detailContact) return
    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    const { error } = await supabase.from('persons')
      .update({ 
        name: editForm.name, 
        nickname: editForm.nickname,
        phone: editForm.phone, 
        address: editForm.address,
        updated_by: authData.user?.id,
        updated_at: new Date().toISOString()
      })
      .eq('id', detailContact.id)
      
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

    showToast('Payment recorded successfully!', 'success')
    setPayMember(null); setSaving(false); load()
  }

  async function deleteMember(m: Member) {
    if (!confirm('Are you sure you want to remove this ticket?')) return
    const { error } = await supabase.from('members').delete().eq('id', m.id)
    if (error) showToast(error.message, 'error')
    else { showToast('Ticket removed!'); setActionMember(null); load() }
  }

  async function deletePerson(pId: number) {
    if (!confirm('Are you sure? This will remove the person and ALL their tickets across ALL groups!')) return
    const { error } = await supabase.from('persons').delete().eq('id', pId)
    if (error) showToast(error.message, 'error')
    else { showToast('Person and all tickets removed!'); setDetailContact(null); load() }
  }

  async function transferTicket(targetMember: Member, exitM: number, newP: { name: string, phone: string, address: string }) {
     if (!firm) return
     setSaving(true)
     // This would now need to create a NEW person or find existing then link to a NEW member
     showToast('Transfer needs Person selection/creation logic. Coming soon.', 'success')
     setSaving(false)
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
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
         {can('addMember') && <Btn variant="primary" onClick={() => setAddOpen(true)} icon={Plus}>Register Person</Btn>}
      </div>

      {view === 'people' ? (
        <TableCard title={`Total Registry (${filteredPeople.length} People)`} subtitle="All unique individuals registered in the system.">
          <Table>
            <thead><tr>
              {isSuper && <Th>Firm</Th>}
              <Th>Person</Th>
              <Th className="hidden md:table-cell">Phone</Th>
              <Th className="hidden sm:table-cell">Active</Th>
              <Th>Total Balance</Th>
              <Th right>Action</Th>
            </tr></thead>
            <tbody>
              {filteredPeople.map(c => (
                <Tr key={c.id}>
                  {isSuper && <Td><Badge variant="gray">{c.tickets[0]?.firms?.name}</Badge></Td>}
                  <Td>
                    <div className="font-bold text-[var(--text)]">{c.name} {c.nickname && <span className="text-[var(--gold)] ml-1">({c.nickname})</span>}</div>
                    <div className="text-[10px] opacity-50 flex items-center gap-1 mt-0.5"><MapPin size={10}/> {c.address || 'No address'}</div>
                  </Td>
                  <Td className="hidden md:table-cell font-mono text-xs">{c.phone || '—'}</Td>
                  <Td className="hidden sm:table-cell">
                    {c.activeCount > 0 ? <Badge variant="blue">{c.activeCount} Active</Badge> : <span className="text-xs opacity-30">None</span>}
                  </Td>
                  <Td>
                     <div className={cn("font-bold font-mono transition-all", c.totalBalance > 0.01 ? "text-[var(--red)]" : "text-[var(--green)]")}>
                        {fmt(c.totalBalance)}
                     </div>
                     {c.totalPaid > 0 && <div className="text-[9px] opacity-40">Paid: {fmt(c.totalPaid)}</div>}
                  </Td>
                  <Td right>
                    <div className="flex gap-1.5 justify-end">
                      <Btn size="sm" variant="ghost" icon={Info} onClick={() => { setDetailContact(c); setEditForm({ name: c.name, nickname: c.nickname || '', phone: c.phone || '', address: c.address || '' }); setIsEditing(false) }} style={{ color: 'var(--blue)' }}>Profile</Btn>
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
                <TableCard key={g.id} title={g.name} subtitle={`${gMembers.length} tickets enrolled`}
                  actions={isSuper && <Badge variant="gold">Owned by: {g.firms?.name}</Badge>}>
                  <Table>
                      <thead><tr>
                        <Th>Ticket</Th>
                        <Th>Name</Th>
                        <Th className="hidden md:table-cell">Phone</Th>
                        <Th className="hidden sm:table-cell">Status</Th>
                        <Th>Action</Th>
                      </tr></thead>
                      <tbody>
                        {gMembers.map(m => (
                          <Tr key={m.id}>
                            <Td className="font-mono font-bold">#{m.ticket_no}</Td>
                            <Td className="font-semibold">{m.persons?.name} {m.persons?.nickname && <span className="text-[var(--gold)] ml-1 opacity-70">({m.persons.nickname})</span>}</Td>
                            <Td className="hidden md:table-cell text-xs">{m.persons?.phone}</Td>
                            <Td className="hidden sm:table-cell">
                               {m.status === 'foreman' ? <Badge variant="blue">Foreman</Badge> : <Badge variant="green">Active</Badge>}
                            </Td>
                            <Td>
                               <div className="flex gap-1">
                                  <Btn size="sm" variant="ghost" icon={CreditCard} onClick={() => setPayMember(m)}>Pay</Btn>
                                  <Btn size="sm" variant="ghost" icon={Info} onClick={() => { 
                                     const p = contacts.find(x => x.id === m.person_id)
                                     if(p) {
                                        setDetailContact(p)
                                        setEditForm({ name: p.name, nickname: p.nickname||'', phone: p.phone||'', address: p.address||'' })
                                     }
                                  }}>Profile</Btn>
                               </div>
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Register New Person">
        <div className="grid grid-cols-2 gap-4">
          <Field label="Full Name"><input className={inputClass} style={inputStyle} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Full name" /></Field>
          <Field label="Nickname (Alias)"><input className={inputClass} style={inputStyle} value={form.nickname} onChange={e => setForm(f => ({...f, nickname: e.target.value}))} placeholder="JD" /></Field>
          <Field label="Phone"><input className={inputClass} style={inputStyle} value={form.phone} type="tel" maxLength={10} onChange={e => setForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} placeholder="Mobile" /></Field>
          <Field label="Address"><input className={inputClass} style={inputStyle} value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="City/Town" /></Field>
          <div className="col-span-2 mt-4 p-3 rounded-xl text-[11px] opacity-60 leading-relaxed border border-dashed text-center" style={{ borderColor: 'var(--border)' }}>
            This registers the person in the master Registry. Use the Group Enrollment form to assign tickets.
          </div>
        </div>
        <div className="flex justify-end gap-3 mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
          <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
          <Btn variant="primary" loading={saving} onClick={saveMember}>Save to Registry</Btn>
        </div>
      </Modal>

      {payMember && (() => {
        const m = payMember
        const group = allGroups.find(g => g.id === m.group_id)
        if (!group) return null
        const mPayments = payments.filter(p => p.member_id === m.id && p.group_id === m.group_id)
        const allMonths = Array.from({ length: group.duration }, (_, i) => i + 1)
        const payableMonths = allMonths.filter(month => {
          const paidForMonth = mPayments.filter(p => p.month === month).reduce((sum, p) => sum + Number(p.amount), 0)
          return paidForMonth < group.monthly_contribution
        })
        const balance = Math.max(0, group.monthly_contribution - mPayments.filter(p => p.month === +payForm.month).reduce((s, p) => s + Number(p.amount), 0))

        return (
          <Modal open={!!payMember} onClose={() => setPayMember(null)} title="Record Payment">
            <div className="p-3 rounded-xl mb-5 text-sm font-medium bg-[var(--surface2)]">
              {m.persons?.name} · {group.name} · Ticket #{m.ticket_no}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Month">
                <select className={inputClass} style={inputStyle} value={payForm.month} onChange={e => setPayForm(f => ({...f, month: e.target.value}))}>
                  {payableMonths.map(month => <option key={month} value={month}>Month {month}</option>)}
                </select>
              </Field>
              <Field label={`Amount (${fmt(balance)} due)`}><input className={inputClass} style={inputStyle} type="number" value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} /></Field>
              <Field label="Date"><input className={inputClass} style={inputStyle} type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({...f, payment_date: e.target.value}))} /></Field>
              <Field label="Mode"><select className={inputClass} style={inputStyle} value={payForm.mode} onChange={e => setPayForm(f => ({...f, mode: e.target.value}))}><option>Cash</option><option>Bank Transfer</option><option>UPI</option></select></Field>
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
          <Modal open={!!detailContact} onClose={() => setDetailContact(null)} title={isEditing ? `Edit: ${c.name}` : `${c.name} Profile`} size="lg">
            {!isEditing ? (
              <div className="space-y-6">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                   <div className="bg-[var(--surface2)] p-4 rounded-2xl">
                      <div className="flex items-center gap-3 mb-4">
                         <div className="w-12 h-12 rounded-full bg-[var(--gold)] flex items-center justify-center text-white text-xl font-bold">{c.name.charAt(0)}</div>
                         <div><div className="font-bold text-lg">{c.name}</div><div className="text-sm opacity-50 flex items-center gap-1"><Phone size={12}/> {c.phone}</div></div>
                      </div>
                      <div className="text-xs flex items-center gap-1 opacity-50"><MapPin size={12}/> {c.address}</div>
                   </div>
                   <div className="bg-[var(--gold-dim)] p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-xs uppercase tracking-widest opacity-50 mb-1">Total Paid</div>
                      <div className="text-3xl font-black text-[var(--gold)]">{fmt(c.totalPaid)}</div>
                   </div>
                </div>
                <div className="space-y-3">
                   <div className="text-xs font-bold uppercase tracking-wider opacity-50">Active Tickets</div>
                   <div className="grid gap-2">
                      {c.tickets.map(m => {
                         const g = allGroups.find(x => x.id === m.group_id)
                         if (!g || g.status === 'archived') return null
                         return (
                            <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                               <div className="flex items-center gap-3"><UserCheck size={16} className="text-[var(--blue)]"/><div><div className="font-bold text-sm">{g.name} <span className="opacity-40 ml-1">#{m.ticket_no}</span></div></div></div>
                               <Btn size="sm" variant="ghost" onClick={() => { setPayMember(m); setDetailContact(null) }}>Pay</Btn>
                            </div>
                         )
                      })}
                   </div>
                </div>
              </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label="Name"><input className={inputClass} style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} /></Field>
                  <Field label="Nickname"><input className={inputClass} style={inputStyle} value={editForm.nickname} onChange={e => setEditForm(f => ({...f, nickname: e.target.value}))} /></Field>
                  <Field label="Phone"><input className={inputClass} style={inputStyle} value={editForm.phone} type="tel" maxLength={10} onChange={e => setEditForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} /></Field>
                  <Field label="Address"><input className={inputClass} style={inputStyle} value={editForm.address} onChange={e => setEditForm(f => ({...f, address: e.target.value}))} /></Field>
                </div>
            )}
            <div className="flex justify-end gap-3 mt-8 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              {isEditing ? (
                 <><Btn variant="secondary" onClick={() => setIsEditing(false)}>Cancel</Btn><Btn variant="primary" loading={saving} onClick={updateContact}>Save Profile</Btn></>
              ) : (
                 <><Btn variant="secondary" onClick={() => setDetailContact(null)}>Close</Btn>{can('editMember') && <Btn variant="primary" icon={Edit} onClick={() => setIsEditing(true)}>Edit Profile</Btn>}{can('deleteMember') && <Btn variant="danger" icon={Trash2} onClick={() => deletePerson(c.id)}>Delete</Btn>}</>
              )}
            </div>
          </Modal>
        )
      })()}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
