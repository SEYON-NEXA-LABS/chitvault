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
import { logActivity } from '@/lib/utils/logger'
import type { Group, Member, Auction, Payment, Person, Firm } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { downloadCSV } from '@/lib/utils/csv'
import { Plus, Trash2, MoreHorizontal, CreditCard, Info, Edit, User, UserCheck, History, Phone, MapPin, Download, Upload, FileSpreadsheet } from 'lucide-react'
import { CSVImportModal } from '@/components/ui'
import { withFirmScope } from '@/lib/supabase/firmQuery'

interface Contact extends Person {
  tickets: Member[];
  totalPaid: number;
  totalBalance: number;
  activeCount: number;
  pastCount: number;
}

export default function MembersPage() {
  const supabase = useMemo(() => createClient(), [])
  const { firm, role, can, switchedFirmId } = useFirm()
  const isSuper = role === 'superadmin'
  const { t } = useI18n()
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
  const [firms,  setFirms]  = useState<Firm[]>([])

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
  const [importOpen, setImportOpen] = useState(false)

  const load = useCallback(async (isInitial = false) => {
    if (isInitial && members.length === 0) setLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    
    // Scoped Queries for Multi-Tenancy
    const [g, m, p, a, pay] = await Promise.all([
      withFirmScope(supabase.from('groups').select('*, firms(name)'), targetId).order('name'),
      withFirmScope(supabase.from('members').select('*, persons(*)'), targetId).order('ticket_no'),
      withFirmScope(supabase.from('persons').select('*, firms(name)'), targetId).order('name'),
      withFirmScope(supabase.from('auctions').select('*'), targetId).order('month'),
      withFirmScope(supabase.from('payments').select('*'), targetId),
    ])
    setAllGroups(g.data || [])
    setMembers(m.data || [])
    setPersons(p.data || [])
    setAuctions(a.data || [])
    setPayments(pay.data || [])

    if (isSuper && firms.length === 0) {
      const { data: f } = await supabase.from('firms').select('*').order('name')
      setFirms(f || [])
    }
    setLoading(false)
  }, [supabase, isSuper, switchedFirmId, firm, firms.length])

  useEffect(() => { load(true) }, [load])

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
    if (addTab === 'new' && (!form.name || !form.phone)) { showToast('Name and Phone are required', 'error'); return }
    if (addTab === 'existing' && !form.existing_id) { showToast('Please select a person', 'error'); return }
    if (!form.group_id) { showToast('Please select a group', 'error'); return }

    setSaving(true)
    const { data: authData } = await supabase.auth.getUser()
    
    let personId = Number(form.existing_id);

    if (addTab === 'new') {
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
      personId = pData.id;
      showToast('Person registered!');
    }

    // Now Enroll in Group
    const groupId = Number(form.group_id);
    const numTickets = Number(form.num_tickets);
    
    // Get current max ticket number for this group
    const { data: existingMems } = await supabase.from('members').select('ticket_no').eq('group_id', groupId);
    const maxTicket = existingMems?.reduce((max: number, m: { ticket_no: number }) => Math.max(max, m.ticket_no), 0) || 0;

    const newMembers = Array.from({ length: numTickets }, (_, i) => ({
      firm_id: firm.id,
      group_id: groupId,
      person_id: personId,
      ticket_no: maxTicket + i + 1,
      status: 'active',
      created_by: authData.user?.id
    }))

    const { error: mErr } = await supabase.from('members').insert(newMembers);
    
    if (mErr) {
      showToast(mErr.message, 'error');
    } else {
      showToast(`Enrolled in group with ${numTickets} ticket(s)!`, 'success');
      // Log Activity
      await logActivity(
        firm.id,
        'MEMBER_CREATED',
        'person',
        personId,
        { group_id: groupId, tickets: numTickets }
      );
      setAddOpen(false)
      setForm({ name:'',nickname:'',phone:'',address:'',group_id:'',num_tickets:'1',existing_id:'' })
      load()
    }
    setSaving(false)
  }

  const isOwner = role === 'owner' || role === 'superadmin'

  const handleExport = () => {
    if (!isOwner && !isSuper) return
    const data = filteredPeople.map(p => ({
      ID: p.id,
      Name: p.name,
      Nickname: p.nickname || '',
      Phone: p.phone || '',
      Address: p.address || '',
      'Active Tickets': p.activeCount,
      'Total Paid': p.totalPaid,
      'Balance Due': p.totalBalance
    }))
    downloadCSV(data, 'people_directory')
  }
  
  const handleExportGroup = (g: Group) => {
    const gMembers = members.filter(m => m.group_id === g.id).sort((a,b) => a.ticket_no - b.ticket_no)
    const data = gMembers.map(m => ({
      'Ticket No': m.ticket_no,
      Member: m.persons?.name,
      Nickname: m.persons?.nickname || '',
      Phone: m.persons?.phone || '',
      Status: m.status
    }))
    downloadCSV(data, `enrollment_${g.name.toLowerCase().replace(/\s+/g,'_')}`)
  }

  const handleImport = async (data: any[]) => {
    if (!firm) return
    const { data: { user } } = await supabase.auth.getUser()
    
    const payload = data.map(row => ({
      firm_id: firm.id,
      name: (row.Name || row.name)?.trim(),
      nickname: (row.Nickname || row.nickname)?.trim() || null,
      phone: (row.Phone || row.phone)?.toString()?.replace(/\D/g,'') || null,
      address: (row.Address || row.address)?.trim() || null,
      created_by: user?.id,
      updated_by: user?.id,
      updated_at: new Date().toISOString()
    }))

    const { error } = await supabase.from('persons').upsert(payload, {
      onConflict: 'firm_id,name,phone',
    })
    
    if (error) showToast(error.message, 'error')
    else {
      showToast(`Successfully imported ${data.length} persons!`, 'success')
      load()
    }
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
    
    // Log Activity
    if (firm) {
      await logActivity(
        firm.id,
        'MEMBER_UPDATED',
        'person',
        detailContact.id,
        { name: editForm.name }
      );
    }

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
    
    // Log Activity
    if (firm) {
      await logActivity(
        firm.id,
        'PAYMENT_RECORDED',
        'payment',
        null,
        { 
          person_name: payMember.persons?.name, 
          amount: payForm.amount, 
          month: payForm.month 
        }
      );
    }

    setPayMember(null); setSaving(false); load()
  }

  async function deleteMember(m: Member) {
    if (!can('deleteMember')) return
    if (!confirm('Are you sure you want to remove this ticket?')) return
    const { error } = await supabase.from('members').delete().eq('id', m.id)
    if (error) showToast(error.message, 'error')
    else { showToast('Ticket removed!'); setActionMember(null); load() }
  }

  async function deletePerson(pId: number) {
    if (!can('deleteMember')) return
    if (!confirm('Are you sure? This will remove the person and ALL their tickets across ALL groups!')) return
    const { error } = await supabase.from('persons').delete().eq('id', pId)
    if (error) showToast(error.message, 'error')
    else { 
      showToast('Person and all tickets removed!'); 
      
      // Log Activity
      if (firm) {
        await logActivity(
          firm.id,
          'MEMBER_DELETED',
          'person',
          pId,
          { id: pId }
        );
      }

      setDetailContact(null); 
      load() 
    }
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
         <div className="flex items-center gap-4 px-2">
            <h1 className="text-2xl font-black text-[var(--text)]">{t('member_directory')}</h1>
            <div className="flex bg-[var(--surface2)] p-1 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
               <Chip active={view === 'people'} onClick={() => setView('people')}>{t('all_people')}</Chip>
               <Chip active={view === 'groups'} onClick={() => setView('groups')}>{t('by_groups')}</Chip>
            </div>
         </div>
         <div className="flex flex-1 gap-2 items-center justify-end px-2">
            <div className="flex-1 max-w-sm relative">
               <input className={inputClass} style={{ ...inputStyle, paddingLeft: 40 }} 
                placeholder={t('search')} value={search} onChange={e => setSearch(e.target.value)} />
               <User size={18} className="absolute left-3.5 top-1/2 -translate-y-1/2 opacity-30" />
            </div>
            <div className="flex gap-2">
               {isOwner && (
                  <>
                     <Btn variant="secondary" size="sm" onClick={handleExport} icon={FileSpreadsheet} title={t('export_people')}>CSV</Btn>
                     <Btn variant="secondary" size="sm" onClick={() => setImportOpen(true)} icon={Upload} title={t('import_people')}>Import</Btn>
                  </>
               )}
               {can('addMember') && <Btn variant="primary" size="sm" onClick={() => setAddOpen(true)} icon={Plus}>{t('register_person')}</Btn>}
            </div>
         </div>
      </div>

      {view === 'people' ? (
        <TableCard title={`Total Registry (${filteredPeople.length} People)`} subtitle="All unique individuals registered in the system.">
          <Table>
            <thead><tr>
              {isSuper && <Th>Firm</Th>}
              <Th>{t('register_person')}</Th>
              <Th className="hidden md:table-cell">{t('phone')}</Th>
              <Th className="hidden sm:table-cell">{t('active_tickets')}</Th>
              <Th>{t('total_outstanding')}</Th>
              <Th right>Action</Th>
            </tr></thead>
            <tbody>
              {filteredPeople.map(c => (
                <Tr key={c.id}>
                  {isSuper && <Td><Badge variant="gray">{(c as any).firms?.name || '—'}</Badge></Td>}
                  <Td>
                    <div className="font-bold text-[var(--text)]">{c.name} {c.nickname && <span className="text-[var(--accent)] ml-1">({c.nickname})</span>}</div>
                    <div className="text-[10px] opacity-50 flex items-center gap-1 mt-0.5"><MapPin size={10}/> {c.address || 'No address'}</div>
                  </Td>
                  <Td className="hidden md:table-cell font-mono text-xs">{c.phone || '—'}</Td>
                  <Td className="hidden sm:table-cell">
                    {c.activeCount > 0 ? <Badge variant="info">{c.activeCount} Active</Badge> : <span className="text-xs opacity-30">None</span>}
                  </Td>
                  <Td>
                     <div className={cn("font-bold font-mono transition-all", c.totalBalance > 0.01 ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                        {fmt(c.totalBalance)}
                     </div>
                     {c.totalPaid > 0 && <div className="text-[9px] opacity-40">Paid: {fmt(c.totalPaid)}</div>}
                  </Td>
                  <Td right>
                    <div className="flex gap-1.5 justify-end">
                      <Btn size="sm" variant="ghost" icon={Info} onClick={() => { setDetailContact(c); setEditForm({ name: c.name, nickname: c.nickname || '', phone: c.phone || '', address: c.address || '' }); setIsEditing(false) }} style={{ color: 'var(--info)' }}>Profile</Btn>
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
                  actions={
                    <div className="flex items-center gap-2">
                       {isSuper && <Badge variant="accent">Owned by: {g.firms?.name}</Badge>}
                       <Btn variant="secondary" size="sm" icon={FileSpreadsheet} onClick={() => handleExportGroup(g)}>CSV</Btn>
                    </div>
                  }>
                  <Table>
                      <thead><tr>
                        <Th>Ticket</Th>
                        <Th>{t('register_person')}</Th>
                        <Th className="hidden md:table-cell">{t('phone')}</Th>
                        <Th className="hidden sm:table-cell">{t('group_status')}</Th>
                        <Th>Action</Th>
                      </tr></thead>
                      <tbody>
                        {gMembers.map(m => (
                          <Tr key={m.id}>
                            <Td className="font-mono font-bold">#{m.ticket_no}</Td>
                            <Td className="font-semibold">
                               {m.persons?.name} {m.persons?.nickname && <span className="text-[var(--accent)] ml-1 opacity-70">({m.persons.nickname})</span>}
                               {auctions.some(a => a.winner_id === m.id) && <Badge variant="accent" className="ml-2">Winner</Badge>}
                            </Td>
                            <Td className="hidden md:table-cell text-xs">{m.persons?.phone}</Td>
                            <Td className="hidden sm:table-cell">
                               {m.status === 'foreman' ? <Badge variant="info">Foreman</Badge> : <Badge variant="success">Active</Badge>}
                            </Td>
                            <Td>
                               <div className="flex gap-1">
                                  <Btn size="sm" variant="ghost" icon={CreditCard} onClick={() => setPayMember(m)}>{t('record_payment')}</Btn>
                                  <Btn size="sm" variant="ghost" icon={Info} onClick={() => { 
                                     const p = persons.find(x => x.id === m.person_id)
                                     if(p) {
                                        setDetailContact({ ...p, tickets: [], totalPaid: 0, totalBalance: 0, activeCount: 0, pastCount: 0 })
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

      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Enroll Member" size="lg">
        <div className="space-y-6">
          <div className="flex bg-[var(--surface2)] p-1 rounded-xl border w-fit" style={{ borderColor: 'var(--border)' }}>
             <Chip active={addTab === 'new'} onClick={() => setAddTab('new')}>New Person</Chip>
             <Chip active={addTab === 'existing'} onClick={() => setAddTab('existing')}>Existing Person</Chip>
          </div>

          {addTab === 'existing' ? (
            <Field label="Select Person">
              <select className={inputClass} style={inputStyle} value={form.existing_id} onChange={e => {
                const p = persons.find(x => x.id === Number(e.target.value));
                setForm(f => ({ ...f, existing_id: e.target.value, name: p?.name || '', phone: p?.phone || '' }));
              }}>
                <option value="">-- Choose from Registry --</option>
                {persons.sort((a,b) => a.name.localeCompare(b.name)).map(p => (
                  <option key={p.id} value={p.id}>{p.name} ({p.phone || 'No phone'})</option>
                ))}
              </select>
            </Field>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('register_person')}><input className={inputClass} style={inputStyle} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Full name" /></Field>
              <Field label={t('nickname')}><input className={inputClass} style={inputStyle} value={form.nickname} onChange={e => setForm(f => ({...f, nickname: e.target.value}))} placeholder="JD" /></Field>
              <Field label={t('phone')}><input className={inputClass} style={inputStyle} value={form.phone} type="tel" maxLength={10} onChange={e => setForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} placeholder="Mobile" /></Field>
              <Field label={t('address')}><input className={inputClass} style={inputStyle} value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="City/Town" /></Field>
            </div>
          )}

          <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="text-xs font-bold uppercase opacity-40 mb-4">Enrollment Details</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label="Target Group">
                <select className={inputClass} style={inputStyle} value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                   <option value="">-- Select Group --</option>
                   {allGroups.filter(g => g.status === 'active').map(g => (
                     <option key={g.id} value={g.id}>{g.name} ({fmt(g.chit_value)} · {g.duration}m)</option>
                   ))}
                </select>
              </Field>
              <Field label="Tickets to Add">
                <input className={inputClass} style={inputStyle} type="number" min="1" max="10" value={form.num_tickets} onChange={e => setForm(f => ({ ...f, num_tickets: e.target.value }))} />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>Cancel</Btn>
            <Btn variant="primary" loading={saving} onClick={saveMember}>Register & Enroll</Btn>
          </div>
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
          <Modal open={!!payMember} onClose={() => setPayMember(null)} title={t('record_payment')}>
            <div className="p-3 rounded-xl mb-5 text-sm font-medium bg-[var(--surface2)]">
              {m.persons?.name} · {group.name} · Ticket #{m.ticket_no}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('auction_month')}>
                <select className={inputClass} style={inputStyle} value={payForm.month} onChange={e => setPayForm(f => ({...f, month: e.target.value}))}>
                  {payableMonths.map(month => <option key={month} value={month}>Month {month}</option>)}
                </select>
              </Field>
              <Field label={`${t('payout')} (${fmt(balance)} due)`}><input className={inputClass} style={inputStyle} type="number" value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} /></Field>
              <Field label={t('date')}><input className={inputClass} style={inputStyle} type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({...f, payment_date: e.target.value}))} /></Field>
              <Field label="Mode"><select className={inputClass} style={inputStyle} value={payForm.mode} onChange={e => setPayForm(f => ({...f, mode: e.target.value}))}><option>Cash</option><option>Bank Transfer</option><option>UPI</option></select></Field>
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="secondary" onClick={() => setPayMember(null)}>Cancel</Btn>
              <Btn variant="primary" loading={saving} onClick={savePay}>{t('record_payment')}</Btn>
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
                         <div className="w-12 h-12 rounded-full bg-[var(--accent)] flex items-center justify-center text-white text-xl font-bold">{c.name.charAt(0)}</div>
                         <div><div className="font-bold text-lg">{c.name}</div><div className="text-sm opacity-50 flex items-center gap-1"><Phone size={12}/> {c.phone}</div></div>
                      </div>
                      <div className="text-xs flex items-center gap-1 opacity-50"><MapPin size={12}/> {c.address}</div>
                   </div>
                   <div className="bg-[var(--accent-dim)] p-4 rounded-2xl flex flex-col justify-center">
                      <div className="text-xs uppercase tracking-widest opacity-50 mb-1">Total Paid</div>
                      <div className="text-3xl font-black text-[var(--accent)]">{fmt(c.totalPaid)}</div>
                   </div>
                </div>
                <div className="space-y-3">
                   <div className="text-xs font-bold uppercase tracking-wider opacity-50">{t('active_tickets')}</div>
                   <div className="grid gap-2">
                      {c.tickets.map(m => {
                         const g = allGroups.find(x => x.id === m.group_id)
                         if (!g || g.status === 'archived') return null
                         return (
                            <div key={m.id} className="flex items-center justify-between p-3 rounded-xl border" style={{ borderColor: 'var(--border)' }}>
                               <div className="flex items-center gap-3"><UserCheck size={16} className="text-[var(--info)]"/><div><div className="font-bold text-sm">{g.name} <span className="opacity-40 ml-1">#{m.ticket_no}</span></div></div></div>
                               <Btn size="sm" variant="ghost" onClick={() => { setPayMember(m); setDetailContact(null) }}>{t('record_payment')}</Btn>
                            </div>
                         )
                      })}
                   </div>
                </div>
              </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <Field label={t('register_person')}><input className={inputClass} style={inputStyle} value={editForm.name} onChange={e => setEditForm(f => ({...f, name: e.target.value}))} /></Field>
                  <Field label={t('nickname')}><input className={inputClass} style={inputStyle} value={editForm.nickname} onChange={e => setEditForm(f => ({...f, nickname: e.target.value}))} /></Field>
                  <Field label={t('phone')}><input className={inputClass} style={inputStyle} value={editForm.phone} type="tel" maxLength={10} onChange={e => setEditForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} /></Field>
                  <Field label={t('address')}><input className={inputClass} style={inputStyle} value={editForm.address} onChange={e => setEditForm(f => ({...f, address: e.target.value}))} /></Field>
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

      <CSVImportModal 
        open={importOpen} 
        onClose={() => setImportOpen(false)} 
        onImport={handleImport} 
        title={t('import_people')} 
        requiredFields={['Name']} 
      />

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
