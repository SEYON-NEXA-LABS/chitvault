'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, cn, getToday } from '@/lib/utils'
import { haptics } from '@/lib/utils/haptics'
import {
  Btn, Badge, TableCard, Table, Th, Td, Tr,
  Modal, Field, Loading, Empty, Toast
} from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { logActivity } from '@/lib/utils/logger'
import type { Group, Member, Auction, Payment, Person, Firm, MemberStatus } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { downloadCSV } from '@/lib/utils/csv'
import { Plus, Trash2, CreditCard, Info, User, UserCheck, History, MapPin, Upload, FileSpreadsheet } from 'lucide-react'
import { CSVImportModal } from '@/components/ui'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'

interface Contact extends Person {
  tickets: Member[];
  totalPaid: number;
  totalBalance: number;
  activeCount: number;
  pastCount: number;
}

export default function MembersPage() {
  const router = useRouter()
  const supabase = useMemo(() => createClient(), [])
  const { firm, profile, role, can, switchedFirmId } = useFirm()
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
  const [search, setSearch] = useState('')
  const [showInactive, setShowInactive] = useState(false)
  const [firms,  setFirms]  = useState<Firm[]>([])

  const [addOpen,       setAddOpen]       = useState(false)
  const [actionMember,  setActionMember]  = useState<Member | null>(null)
  const [payMember,     setPayMember]     = useState<Member | null>(null)
  const [saving,        setSaving]        = useState(false)
  const [addTab,        setAddTab]        = useState<'new'|'existing'>('new')

  const [form, setForm] = useState({ name:'', nickname: '', phone:'', address:'', group_id:'', num_tickets: '1', existing_id: '' })
  const [payForm,  setPayForm]  = useState({ amount: '', payment_date: new Date().toISOString().substring(0, 10), mode: 'Cash', month: '' })
  const [importOpen, setImportOpen] = useState(false)
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set())
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 20

  const [summaryStats, setSummaryStats] = useState({ 
    activePeople: 0, 
    totalPeople: 0, 
    activeTickets: 0, 
    totalTickets: 0,
    totalOutstanding: 0, 
    totalPaid: 0 
  })

  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) return

    try {
      // 1. Fetch Global Stats
      const [sData, totalPCount, totalTCount] = await Promise.all([
        supabase.rpc('get_firm_registry_stats', { p_firm_id: targetId }),
        withFirmScope(supabase.from('persons').select('id', { count: 'exact', head: true }), targetId).is('deleted_at', null),
        withFirmScope(supabase.from('members').select('id', { count: 'exact', head: true }), targetId).is('deleted_at', null)
      ])
      
      if (sData.data) {
        setSummaryStats({
          ...sData.data,
          totalPeople: totalPCount.count || 0,
          totalTickets: totalTCount.count || 0
        })
      }

      // 2. Fetch Context based on view & showInactive filter
      const isPeopleView = view === 'people'
      const activeStatuses = ['active', 'foreman', 'defaulter']
      
      let pData: Person[] = []
      let mData: any[] = []
      let gData: Group[] = []
      let aData: Auction[] = []
      let payData: Payment[] = []

      if (isPeopleView) {
        // Mode A: Paginated People Directory
        let pQuery = withFirmScope(supabase.from('persons').select('id, name, nickname, phone, address', { count: 'exact' }), targetId).is('deleted_at', null)
        if (search) pQuery = pQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
        
        // If not showing inactive, we might still show the person, but they'll have 0 tickets in summary
        const { data, count, error: pErr } = await pQuery
          .order('name')
          .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

        if (pErr) showToast(pErr.message, 'error')
        pData = data || []
        setTotalCount(count || 0)
        
        const pIds = pData.map(p => p.id)
        
        // Fetch members for these people
        let mQuery = withFirmScope(supabase.from('members').select('id, group_id, person_id, ticket_no, status, notes'), targetId)
          .in('person_id', pIds)
          .is('deleted_at', null)
        
        if (!showInactive) mQuery = mQuery.in('status', activeStatuses)
        
        const { data: mems } = await mQuery
        mData = mems || []
      } else {
        // Mode B: Complete Group Enrollment Context (Optimized Deep Join)
        let mQuery = withFirmScope(supabase.from('members').select('id, group_id, person_id, ticket_no, status, notes, persons(id, name, nickname, phone)'), targetId).is('deleted_at', null)
        
        if (!showInactive) mQuery = mQuery.in('status', activeStatuses)
        if (search) mQuery = mQuery.or(`persons.name.ilike.%${search}%,persons.phone.ilike.%${search}%`)
        
        const { data: mems, error: mErr } = await mQuery.order('ticket_no')
        if (mErr) showToast(mErr.message, 'error')
        
        mData = mems || []
        const pMap = new Map()
        mData.forEach(m => { if (m.persons) pMap.set(m.persons.id, m.persons) })
        pData = Array.from(pMap.values())
      }

      const relevantGroupIds = Array.from(new Set(mData.map(m => m.group_id)))
      const relevantPersonIds = Array.from(new Set(mData.map(m => m.person_id)))

      // 3. Fetch Collateral Data
      const [g, a, pay] = await Promise.all([
        withFirmScope(supabase.from('groups').select('id, name, duration, monthly_contribution, chit_value, status, auction_scheme, accumulated_surplus, num_members'), targetId)
          .in('id', relevantGroupIds)
          .is('deleted_at', null),
        withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_discount, dividend, winner_id, status, payout_amount, is_payout_settled'), targetId)
          .in('group_id', relevantGroupIds)
          .is('deleted_at', null)
          .order('month'),
        withFirmScope(supabase.from('payments').select('id, member_id, group_id, person_id, amount, month, payment_date, created_at'), targetId)
          .in('person_id', relevantPersonIds)
          .is('deleted_at', null)
      ])

      setMembers(mData)
      setPersons(pData)
      setAllGroups(g.data || [])
      setAuctions(a.data || [])
      setPayments(pay.data || [])

      if (isInitial) {
        const { data: allG } = await withFirmScope(supabase.from('groups').select('id, name, chit_value, duration, status'), targetId).is('deleted_at', null).order('name')
        setAllGroups(allG || [])
      }

    } finally {
      if (isSuper && firms.length === 0) {
        const { data: f } = await supabase.from('firms').select('id, name').order('name')
        setFirms(f || [])
      }
      setLoading(false)
      setSelectedIds(new Set())
    }
  }, [supabase, isSuper, switchedFirmId, firm?.id, page, search, showToast, view, firms.length, showInactive])

  // Reset to page 1 when search changes
  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => { load(true) }, [load])

  const toggleSelect = (id: number) => {
    const next = new Set(selectedIds)
    if (next.has(id)) next.delete(id)
    else next.add(id)
    setSelectedIds(next)
  }

  const toggleAll = (ids: number[]) => {
    if (selectedIds.size === ids.length) setSelectedIds(new Set())
    else setSelectedIds(new Set(ids))
  }

  async function handleBulkStatusUpdate(newStatus: MemberStatus) {
    if (selectedIds.size === 0 || !isOwner) return
    if (!confirm(`Update status to ${newStatus} for ${selectedIds.size} selected members?`)) return
    
    setSaving(true)
    const { error } = await supabase.from('members').update({ status: newStatus }).in('id', Array.from(selectedIds))
    
    if (error) showToast(error.message, 'error')
    else {
      showToast(`${selectedIds.size} members updated!`, 'success')
      load()
    }
    setSaving(false)
  }

  async function handleBulkMoveToTrash() {
    if (selectedIds.size === 0 || !can('deleteMember')) return
    if (!confirm(`Move ${selectedIds.size} selected tickets to trash?`)) return
    haptics.heavy()
    
    setSaving(true)
    const { error } = await supabase.from('members').update({ deleted_at: new Date() }).in('id', Array.from(selectedIds))
    
    if (error) showToast(error.message, 'error')
    else {
      showToast(`${selectedIds.size} tickets moved to trash!`, 'success')
      load()
    }
    setSaving(false)
  }

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

       // Consolidated Balance Calculation using standardized logic
       let totalBalance = 0;
       pMembers.forEach(m => {
          const group = allGroups.find(g => g.id === m.group_id);
          if (!group || group.status === 'archived') return;
          const gAucs = auctions.filter(a => Number(a.group_id) === Number(group.id));
          const mPays = payments.filter(pay => Number(pay.member_id) === Number(m.id) && Number(pay.group_id) === Number(group.id));
          
          const financial = getMemberFinancialStatus(m, group, gAucs, mPays);
          totalBalance += financial.balance;
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

  const filteredPeople = contacts.sort((a,b) => b.activeCount - a.activeCount || a.name.localeCompare(b.name))


  async function saveMember() {
    if (!firm) { showToast('Session error!', 'error'); return }
    if (addTab === 'new' && (!form.name || !form.phone)) { showToast('Name and Phone are required', 'error'); return }
    if (addTab === 'existing' && !form.existing_id) { showToast('Please select a person', 'error'); return }
    if (!form.group_id) { showToast('Please select a group', 'error'); return }

    setSaving(true)
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData.user) { showToast('Authentication error!', 'error'); setSaving(false); return }
    
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
        .select('id')
        .single()
        
      if (pErr) { showToast(pErr.message, 'error'); setSaving(false); return }
      personId = pData.id;
      showToast('Person registered!');
    }

    // Now Enroll in Group
    const groupId = Number(form.group_id);
    const numTickets = Number(form.num_tickets);
    
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
      await logActivity(firm.id, 'MEMBER_CREATED', 'person', personId, { group_id: groupId, tickets: numTickets });
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
      ID: p.id, Name: p.name, Nickname: p.nickname || '', Phone: p.phone || '', Address: p.address || '',
      'Active Tickets': p.activeCount, 'Total Paid': p.totalPaid, 'Balance Due': p.totalBalance
    }))
    downloadCSV(data, 'people_directory')
  }
  
  const handleExportGroup = (g: Group) => {
    const gMembers = members.filter(m => m.group_id === g.id).sort((a,b) => a.ticket_no - b.ticket_no)
    const data = gMembers.map(m => ({
      'Ticket No': m.ticket_no, Member: m.persons?.name, Nickname: m.persons?.nickname || '', Phone: m.persons?.phone || '', Status: m.status
    }))
    downloadCSV(data, `enrollment_${g.name.toLowerCase().replace(/\s+/g,'_')}`)
  }

  const handleImport = async (data: any[]) => {
    if (!firm) return
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) { showToast('Authentication error!', 'error'); return }
    const payload = data.map(row => ({
      firm_id: firm.id,
      name: (row.Name || row.name)?.trim(),
      nickname: (row.Nickname || row.nickname)?.trim() || null,
      phone: (row.Phone || row.phone)?.toString()?.replace(/\D/g,'') || null,
      address: (row.Address || row.address)?.trim() || null,
      created_by: user?.id, updated_by: user?.id, updated_at: new Date().toISOString()
    }))

    const { error } = await supabase.from('persons').upsert(payload, { onConflict: 'firm_id,name,phone' })
    if (error) showToast(error.message, 'error')
    else { showToast(`Successfully imported ${data.length} persons!`, 'success'); load() }
  }

  async function savePay() {
    if (!payMember || !payForm.month || !payForm.amount) { showToast('Missing details', 'error'); return }
    setSaving(true)
    haptics.heavy()
    const { data: { user }, error: authErr } = await supabase.auth.getUser()
    if (authErr || !user) { showToast('Authentication error!', 'error'); setSaving(false); return }

    const group = allGroups.find(g => g.id === payMember.group_id)
    const amountDue = group?.monthly_contribution || 0
    const alreadyPaid = payments.filter(p => p.member_id === payMember.id && p.group_id === payMember.group_id && p.month === +payForm.month).reduce((s, p) => s + Number(p.amount), 0)
    const balanceDue = Math.max(0, amountDue - alreadyPaid - (+payForm.amount || 0))
    const isPartial = balanceDue > 0

    const payload: Omit<Payment, 'id'|'created_at'> = {
      firm_id: payMember.firm_id, member_id: payMember.id, group_id: payMember.group_id,
      month: +payForm.month, amount: +payForm.amount, payment_date: payForm.payment_date, mode: payForm.mode as any,
      status: 'paid', amount_due: amountDue, balance_due: balanceDue, payment_type: isPartial ? 'partial' : 'full',
      collected_by: profile?.id || null,
    }
    const { error } = await supabase.from('payments').insert(payload)
    if (error) { showToast(error.message, 'error'); setSaving(false); return }

    if (!isPartial) {
      await supabase.from('payments').update({ status: 'paid', balance_due: 0 })
        .eq('member_id', payMember.id).eq('group_id', payMember.group_id).eq('month', +payForm.month)
    }

    showToast('Payment recorded successfully!', 'success')
    if (firm) {
      await logActivity(firm.id, 'PAYMENT_RECORDED', 'payment', null, { person_name: payMember.persons?.name, amount: payForm.amount, month: payForm.month });
    }
    setPayMember(null); setSaving(false); load()
  }

  async function deletePerson(pId: number) {
    if (!can('deleteMember')) return
    if (!confirm('Are you sure? This will move the person and ALL their tickets to trash!')) return
    haptics.heavy()
    const { error: pErr } = await supabase.from('persons').update({ deleted_at: new Date() }).eq('id', pId)
    if (pErr) { showToast(pErr.message, 'error'); return }
    await supabase.from('members').update({ deleted_at: new Date() }).eq('person_id', pId)
    showToast('Person and tickets moved to trash!'); load()
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-24">
      {/* Redesigned Header Section */}
      <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-6">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-[var(--text)] tracking-tight">
            {t('member_directory')}
          </h1>
          <p className="text-xs font-medium opacity-40 mt-1 uppercase tracking-widest leading-loose">
            {t('members_page_desc')}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-1 bg-[var(--surface2)] rounded-xl border" style={{ borderColor: 'var(--border)' }}>
            <button 
              onClick={() => { setView('people'); setSelectedIds(new Set()) }}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                view === 'people' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm border" : "opacity-40 hover:opacity-100"
              )}
              style={view === 'people' ? { borderColor: 'var(--border)' } : {}}
            >
              {t('all_people')}
            </button>
            <button 
              onClick={() => { setView('groups'); setSelectedIds(new Set()) }}
              className={cn(
                "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                view === 'groups' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm border" : "opacity-40 hover:opacity-100"
              )}
              style={view === 'groups' ? { borderColor: 'var(--border)' } : {}}
            >
              {t('by_groups')}
            </button>
          </div>
          {view === 'people' && can('addMember') && (
            <div className="flex gap-2">
               <Btn variant="secondary" size="sm" onClick={handleExport} icon={FileSpreadsheet}>CSV</Btn>
               <Btn variant="secondary" size="sm" onClick={() => setImportOpen(true)} icon={Upload}>Import</Btn>
            </div>
          )}
          {can('addMember') && (
            <Btn variant="primary" onClick={() => setAddOpen(true)} icon={Plus}>
              {t('register_person')}
            </Btn>
          )}
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="p-4 rounded-2xl border-2 bg-[var(--surface)] flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
             <div className="p-2 rounded-lg bg-[var(--accent-dim)] text-[var(--accent)]"><User size={18}/></div>
             <Badge variant="accent">{t('registry_label')}</Badge>
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text)]">
              {summaryStats.activePeople} <span className="text-sm opacity-30">/ {summaryStats.totalPeople}</span>
            </div>
            <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-0.5">{t('registry_members')}</div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border-2 bg-[var(--surface)] flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
          <div className="flex items-center justify-between mb-4">
             <div className="p-2 rounded-lg bg-[var(--info-dim)] text-[var(--info)]"><UserCheck size={18}/></div>
             <Badge variant="info">{t('subscribers_label')}</Badge>
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text)]">
              {summaryStats.activeTickets} <span className="text-sm opacity-30">/ {summaryStats.totalTickets}</span>
            </div>
            <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-0.5">{t('active_tickets_label')}</div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border-2 bg-[var(--surface)] flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
           <div className="flex items-center justify-between mb-4">
             <div className="p-2 rounded-lg bg-[var(--danger-dim)] text-[var(--danger)]"><CreditCard size={18}/></div>
             <Badge variant="danger">{t('market_debt_label')}</Badge>
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text)]">{fmt(summaryStats.totalOutstanding)}</div>
            <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-0.5">{t('total_outstanding')}</div>
          </div>
        </div>
        <div className="p-4 rounded-2xl border-2 bg-[var(--surface)] flex flex-col justify-between" style={{ borderColor: 'var(--border)' }}>
           <div className="flex items-center justify-between mb-4">
             <div className="p-2 rounded-lg bg-[var(--success-dim)] text-[var(--success)]"><History size={18}/></div>
             <Badge variant="success">{t('life_time_label')}</Badge>
          </div>
          <div>
            <div className="text-2xl font-black text-[var(--text)]">{fmt(summaryStats.totalPaid)}</div>
            <div className="text-[10px] font-bold opacity-40 uppercase tracking-widest mt-0.5">{t('paid_label')}</div>
          </div>
        </div>
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group">
           <input 
              className="w-full bg-[var(--surface)] border-2 rounded-2xl p-4 pl-12 font-bold text-sm focus:border-[var(--accent)] transition-all outline-none"
              style={{ borderColor: 'var(--border)' }}
              placeholder="Search by name, phone, or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
           />
           <Plus className="absolute left-4 top-1/2 -translate-y-1/2 rotate-45 opacity-30" size={20} />
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer bg-[var(--surface2)] px-4 py-3 rounded-2xl border-2 hover:border-[var(--accent)] transition-all shrink-0" style={{ borderColor: 'var(--border)' }}>
          <input 
            type="checkbox" 
            className="w-4 h-4 rounded-lg bg-[var(--surface)] text-[var(--accent)] border-none ring-offset-0 focus:ring-0" 
            checked={showInactive} 
            onChange={e => setShowInactive(e.target.checked)} 
          />
          <span className="text-[10px] font-black uppercase tracking-wider opacity-60">{t('past_members_label')}</span>
        </label>
      </div>

      {view === 'people' && (
         <div className="flex items-center justify-between text-xs font-bold opacity-60 uppercase tracking-widest px-2">
            <span>{t('showing')} {(page-1)*PAGE_SIZE + 1} {t('to')} {Math.min(page*PAGE_SIZE, totalCount)} {t('of')} {totalCount} {t('people')}</span>
            <div className="flex gap-2">
               <button 
                disabled={page === 1}
                onClick={() => setPage(p => Math.max(1, p - 1))}
                className="px-3 py-1 rounded-lg bg-[var(--surface)] border disabled:opacity-20 hover:border-[var(--accent)] transition-all"
               >
                 {t('previous')}
               </button>
               <button 
                disabled={page * PAGE_SIZE >= totalCount}
                onClick={() => setPage(p => p + 1)}
                className="px-3 py-1 rounded-lg bg-[var(--surface)] border disabled:opacity-20 hover:border-[var(--accent)] transition-all"
               >
                 {t('next')}
               </button>
            </div>
         </div>
      )}

      {view === 'people' ? (
        <TableCard title={`${t('total_registry_label')} (${summaryStats.activePeople} / ${summaryStats.totalPeople})`} subtitle={t('members_page_desc')}>
          <Table responsive>
            <thead><tr>
              <Th className="w-10">
                 <input type="checkbox" checked={selectedIds.size === filteredPeople.length && filteredPeople.length > 0} onChange={() => toggleAll(filteredPeople.map(p => p.id))} />
              </Th>
              {isSuper && <Th>Firm</Th>}
              <Th>{t('register_person')}</Th>
              <Th className="hidden md:table-cell">{t('phone')}</Th>
              <Th className="hidden sm:table-cell">{t('active_tickets')}</Th>
              <Th>{t('total_outstanding')}</Th>
              <Th right>{t('action')}</Th>
            </tr></thead>
            <tbody>
              {filteredPeople.map(c => {
                const isSelected = selectedIds.has(c.id)
                return (
                  <Tr key={c.id} className={cn(isSelected ? "bg-[var(--accent-dim)]" : "hover:bg-[var(--surface2)]/50 transition-colors cursor-pointer")} onClick={() => toggleSelect(c.id)}>
                    <Td label="Select"><input type="checkbox" checked={isSelected} readOnly /></Td>
                    {isSuper && <Td label="Firm"><Badge variant="gray">{c.firms?.name || '—'}</Badge></Td>}
                    <Td label="Person">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] font-bold text-xs uppercase overflow-hidden shrink-0">
                          {c.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-[var(--text)] tracking-tight leading-tight">
                            {c.name} {c.nickname && <span className="text-[var(--accent)] font-medium text-xs ml-1 opacity-70">({c.nickname})</span>}
                          </div>
                          <div className="text-[10px] opacity-40 flex items-center gap-1 mt-1 font-medium italic"><MapPin size={10}/> {c.address || t('no_address')}</div>
                        </div>
                      </div>
                    </Td>
                    <Td label="Phone" className="hidden md:table-cell font-mono text-xs opacity-60 tracking-tighter">{c.phone || '—'}</Td>
                    <Td label="Tickets" className="hidden sm:table-cell">
                      {c.activeCount > 0 ? (
                        <div className="flex items-center gap-1.5">
                          <Badge variant="info">{c.activeCount} {t('status_active')}</Badge>
                          <div className="flex -space-x-1 ml-1 opacity-40 group-hover:opacity-100 transition-opacity">
                            {c.tickets.slice(0, 3).map((t, i) => (
                              <div key={i} className="w-4 h-4 rounded-full border border-white bg-[var(--info)]" />
                            ))}
                          </div>
                        </div>
                      ) : <span className="text-[10px] uppercase font-bold opacity-20">None</span>}
                    </Td>
                    <Td label="Outstanding">
                       <div className={cn("font-bold font-mono text-base tracking-tighter", c.totalBalance > 0.01 ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                          {fmt(c.totalBalance)}
                       </div>
                       {c.totalPaid > 0 && <div className="text-[10px] font-bold opacity-30 mt-0.5">PAID: {fmt(c.totalPaid)}</div>}
                    </Td>
                    <Td label="Action" right>
                      <div className="flex gap-2 justify-end">
                        <Btn size="sm" variant="secondary" onClick={(e: any) => { e.stopPropagation(); router.push(`/members/${c.id}`) }}>{t('profile')}</Btn>
                        <Btn size="sm" variant="ghost" icon={Trash2} onClick={(e: any) => { e.stopPropagation(); deletePerson(c.id) }} className="text-[var(--danger)]" />
                      </div>
                    </Td>
                  </Tr>
                )
              })}
              {filteredPeople.length === 0 && (
                <Tr><Td colSpan={isSuper ? 7 : 6}><Empty title="No persons found" subtitle="Try adjusting your search filter" icon={User} /></Td></Tr>
              )}
            </tbody>
          </Table>
        </TableCard>
      ) : (
        <div className="space-y-6">
           {allGroups.filter(g => g.status !== 'archived').map(g => {
              const gMembers = members.filter(m => m.group_id === g.id)
              const gSelectedCount = gMembers.filter(m => selectedIds.has(m.id)).length
              
              return (
                <TableCard key={g.id} title={g.name} subtitle={`${gMembers.length} active enrollments · ${fmt(g.chit_value)} chit`}
                  actions={
                    <div className="flex items-center gap-2">
                       {isSuper && <Badge variant="accent">Owned by: {g.firms?.name}</Badge>}
                       <Btn variant="secondary" size="sm" icon={FileSpreadsheet} onClick={() => handleExportGroup(g)}>{t('export')}</Btn>
                    </div>
                  }>
                  <Table responsive>
                      <thead><tr>
                        <Th className="w-10">
                           <input type="checkbox" checked={gSelectedCount === gMembers.length && gMembers.length > 0} onChange={() => toggleAll(gMembers.map(m => m.id))} />
                        </Th>
                        <Th>Ticket</Th>
                        <Th>{t('register_person')}</Th>
                        <Th className="hidden md:table-cell">{t('phone')}</Th>
                        <Th className="hidden sm:table-cell">{t('group_status')}</Th>
                        <Th right>{t('action')}</Th>
                      </tr></thead>
                      <tbody>
                        {gMembers.map(m => {
                          const isSelected = selectedIds.has(m.id)
                          const isWinner = auctions.some(a => a.winner_id === m.id)
                          return (
                            <Tr key={m.id} className={cn(isSelected ? "bg-[var(--accent-dim)]" : "hover:bg-[var(--surface2)]/30 transition-colors")} onClick={() => toggleSelect(m.id)}>
                              <Td label="Select"><input type="checkbox" checked={isSelected} readOnly /></Td>
                              <Td label="Ticket" className="font-mono font-black text-sm text-[var(--accent)]">#{m.ticket_no}</Td>
                              <Td label="Person" className="font-bold">
                                 <div className="flex items-center gap-2">
                                   {m.persons?.name} 
                                   {m.persons?.nickname && <span className="text-[var(--accent)] font-medium text-xs opacity-70">({m.persons.nickname})</span>}
                                   {isWinner && <Badge variant="accent" className="text-[9px] py-0.5">Winner</Badge>}
                                 </div>
                              </Td>
                              <Td label="Phone" className="hidden md:table-cell text-xs font-medium opacity-50">{m.persons?.phone || '—'}</Td>
                              <Td label="Status" className="hidden sm:table-cell">
                                 {m.status === 'foreman' ? <Badge variant="info">Foreman</Badge> : <Badge variant="success">Active</Badge>}
                              </Td>
                              <Td label="Action" right>
                                 <div className="flex gap-2 justify-end">
                                    <Btn size="sm" variant="ghost" icon={CreditCard} onClick={(e: any) => { e.stopPropagation(); setPayMember(m) }}>{t('record_payment')}</Btn>
                                    <Btn size="sm" variant="ghost" icon={Info} onClick={(e: any) => { e.stopPropagation(); router.push(`/members/${m.person_id}`) }} />
                                 </div>
                              </Td>
                            </Tr>
                          )
                        })}
                      </tbody>
                  </Table>
                </TableCard>
              )
           })}
        </div>
      )}

      {/* Enrollment Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title="Enroll Member" size="lg">
        <div className="space-y-6">
           <div className="flex p-1 bg-[var(--surface2)] rounded-xl border w-fit" style={{ borderColor: 'var(--border)' }}>
              <button 
                onClick={() => setAddTab('new')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  addTab === 'new' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm border" : "opacity-40 hover:opacity-100"
                )}
                style={addTab === 'new' ? { borderColor: 'var(--border)' } : {}}
              >
                {t('new_person')}
              </button>
              <button 
                onClick={() => setAddTab('existing')}
                className={cn(
                  "px-4 py-1.5 rounded-lg text-xs font-bold transition-all",
                  addTab === 'existing' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm border" : "opacity-40 hover:opacity-100"
                )}
                style={addTab === 'existing' ? { borderColor: 'var(--border)' } : {}}
              >
                {t('existing_person')}
              </button>
           </div>

          {addTab === 'existing' ? (
            <Field label={t('select_person')}>
              <select className={inputClass} style={inputStyle} value={form.existing_id} onChange={e => {
                const p = persons.find(x => x.id === Number(e.target.value));
                setForm(f => ({ ...f, existing_id: e.target.value, name: p?.name || '', phone: p?.phone || '' }));
              }}>
                <option value="">{t('choose_from_registry')}</option>
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
            <div className="text-xs font-bold uppercase opacity-40 mb-4 tracking-widest">{t('enrollment_details')}</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('target_group')}>
                <select className={inputClass} style={inputStyle} value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                   <option value="">-- {t('select_group')} --</option>
                   {allGroups.filter(g => g.status === 'active').map(g => (
                     <option key={g.id} value={g.id}>{g.name} ({fmt(g.chit_value)} · {g.duration}m)</option>
                   ))}
                </select>
              </Field>
              <Field label={t('tickets_to_add')}>
                <input className={inputClass} style={inputStyle} type="number" min="1" max="10" value={form.num_tickets} onChange={e => setForm(f => ({ ...f, num_tickets: e.target.value }))} />
              </Field>
            </div>
          </div>

          <div className="flex justify-end gap-3 mt-4 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
            <Btn variant="secondary" onClick={() => setAddOpen(false)}>{t('cancel')}</Btn>
            <Btn variant="primary" loading={saving} onClick={saveMember}>{t('register_and_enroll')}</Btn>
          </div>
        </div>
      </Modal>

      {/* Payment Modal */}
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
            <div className="p-3 rounded-xl mb-5 text-sm font-medium bg-[var(--surface2)] border" style={{ borderColor: 'var(--border)' }}>
              {m.persons?.name} · {group.name} · Ticket #{m.ticket_no}
            </div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('auction_month')}>
                <select className={inputClass} style={inputStyle} value={payForm.month} onChange={e => setPayForm(f => ({...f, month: e.target.value}))}>
                  {payableMonths.map(month => <option key={month} value={month}>Month {month}</option>)}
                </select>
              </Field>
              <Field label={`${t('amount')} (${fmt(balance)} due)`}><input className={inputClass} style={inputStyle} type="number" value={payForm.amount} onChange={e => setPayForm(f => ({...f, amount: e.target.value}))} /></Field>
              <Field label={t('date')}><input className={inputClass} style={inputStyle} type="date" value={payForm.payment_date} onChange={e => setPayForm(f => ({...f, payment_date: e.target.value}))} /></Field>
              <Field label={t('payment_mode')}><select className={inputClass} style={inputStyle} value={payForm.mode} onChange={e => setPayForm(f => ({...f, mode: e.target.value}))}><option>Cash</option><option>Bank Transfer</option><option>UPI</option></select></Field>
            </div>
            <div className="flex justify-end gap-3 mt-5 pt-5 border-t" style={{ borderColor: 'var(--border)' }}>
              <Btn variant="secondary" onClick={() => setPayMember(null)}>{t('cancel')}</Btn>
              <Btn variant="primary" loading={saving} onClick={savePay}>{t('record_payment')}</Btn>
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
      
      {/* Floating ActionBar */}
      {selectedIds.size > 0 && (
         <div className="fixed bottom-8 left-1/2 -translate-x-1/2 z-50 animate-in slide-in-from-bottom-5 duration-300">
            <div className="bg-[var(--surface)] border-2 border-[var(--accent)] shadow-2xl rounded-2xl p-2 px-4 flex items-center gap-6 backdrop-blur-md">
               <div className="flex items-center gap-3">
                  <div className="w-8 h-8 rounded-full bg-[var(--accent)] text-white flex items-center justify-center font-black text-sm">
                     {selectedIds.size}
                  </div>
                  <div className="text-sm font-bold opacity-60 uppercase tracking-widest">{view === 'people' ? 'People' : 'Members'}</div>
               </div>
               <div className="h-8 w-px bg-[var(--border)]" />
               <div className="flex items-center gap-2">
                  {view === 'people' ? (
                     can('deleteMember') && (
                        <Btn variant="danger" size="sm" icon={Trash2} onClick={() => {
                           if(confirm(`Move ${selectedIds.size} people and ALL their tickets to trash?`)) {
                              showToast('Bulk person delete coming soon', 'success')
                           }
                        }}>Trash All</Btn>
                     )
                  ) : (
                    <>
                      <Btn variant="primary" size="sm" icon={UserCheck} onClick={() => handleBulkStatusUpdate('active')}>Mark Active</Btn>
                      <Btn variant="secondary" size="sm" onClick={() => handleBulkStatusUpdate('defaulter')}>Mark Defaulter</Btn>
                      {can('deleteMember') && <Btn variant="danger" size="sm" icon={Trash2} onClick={handleBulkMoveToTrash}>Trash All</Btn>}
                    </>
                  )}
                  <Btn variant="ghost" size="sm" onClick={() => setSelectedIds(new Set())}>{t('deselect')}</Btn>
               </div>
            </div>
         </div>
      )}
    </div>
  )
}
