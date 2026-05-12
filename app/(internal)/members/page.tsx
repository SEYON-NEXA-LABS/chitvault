'use client'

import { useEffect, useState, useCallback, useMemo } from 'react'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, cn, getToday, amountDue } from '@/lib/utils'
import { haptics } from '@/lib/utils/haptics'
import {
  Btn, Badge, TableCard, Table, Th, Td, Tr,
  Modal, Field, Loading, Empty, Toast, Pagination, CSVImportModal, StatCard
} from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { logActivity } from '@/lib/utils/logger'
import type { Group, Member, Auction, Payment, Person, Firm, MemberStatus } from '@/types'
import { useI18n } from '@/lib/i18n/context'
import { downloadCSV } from '@/lib/utils/csv'
import { Plus, Trash2, CreditCard, Info, User, UserCheck, History, MapPin, Upload, FileSpreadsheet, ChevronDown, ChevronRight, TrendingUp, Users, CheckCircle2, Wallet, Activity, ArrowRight } from 'lucide-react'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'
import { CascadeDeleteModal } from '@/components/features/CascadeDeleteModal'

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

  const [delModal, setDelModal] = useState<{ open: boolean, id: number | string | null, name: string, isBulk: boolean }>({ open: false, id: null, name: '', isBulk: false })
  const [expandedGroups, setExpandedGroups] = useState<Set<number>>(new Set())

  const [summaryStats, setSummaryStats] = useState({ 
    activePeople: 0, 
    totalPeople: 0, 
    activeTickets: 0, 
    totalTickets: 0,
    totalOutstanding: 0, 
    totalPaid: 0,
    totalPayouts: 0,
    totalChitValue: 0
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
        const d = Array.isArray(sData.data) ? sData.data[0] : sData.data;
        setSummaryStats({
          activePeople: d.activePeople || d.active_people || 0,
          activeTickets: d.activeTickets || d.active_tickets || 0,
          totalOutstanding: d.totalOutstanding || d.total_outstanding || 0,
          totalPaid: d.totalPaid || d.total_paid || 0,
          totalPeople: totalPCount.count || d.totalPeople || d.total_people || 0,
          totalTickets: totalTCount.count || d.totalTickets || d.total_tickets || 0,
          totalPayouts: d.totalPayouts || d.total_payouts || 0,
          totalChitValue: d.totalChitValue || d.total_chit_value || 0
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
      const relevantMemberIds = mData.map(m => m.id)

      // 3. Fetch Collateral Data
      const [g, a, pay] = await Promise.all([
        withFirmScope(supabase.from('groups').select('id, name, duration, monthly_contribution, chit_value, status, auction_scheme, accumulated_surplus, num_members'), targetId)
          .in('id', relevantGroupIds)
          .is('deleted_at', null),
        withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_discount, dividend, winner_id, status, payout_amount, is_payout_settled'), targetId)
          .in('group_id', relevantGroupIds)
          .is('deleted_at', null)
          .order('month'),
        withFirmScope(supabase.from('payments').select('id, member_id, group_id, amount, month, payment_date, created_at'), targetId)
          .in('member_id', relevantMemberIds)
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
    if (selectedIds.size === 0 || !isOwner || !firm) return
    if (!confirm(`Update status to ${newStatus} for ${selectedIds.size} selected members?`)) return
    
    setSaving(true)
    const { error } = await supabase.from('members').update({ status: newStatus }).in('id', Array.from(selectedIds)).eq('firm_id', firm.id)
    
    if (error) showToast(error.message, 'error')
    else {
      showToast(`${selectedIds.size} members updated!`, 'success')
      load()
    }
    setSaving(false)
  }

  async function handleBulkMoveToTrash() {
    if (selectedIds.size === 0 || !can('deleteMember') || !firm) return
    if (!confirm(`Move ${selectedIds.size} selected tickets to trash?`)) return
    haptics.heavy()
    
    setSaving(true)
    const { error } = await supabase.from('members').update({ deleted_at: new Date() }).in('id', Array.from(selectedIds)).eq('firm_id', firm.id)
    
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
        const auc = auctions.find(a => a.group_id === group.id && a.month === month && a.status === 'confirmed')
        const div = auc?.dividend || 0
        const due = amountDue(group.monthly_contribution, div, group.auction_scheme)
        const paidForMonth = mPayments.filter(pay => pay.month === month).reduce((sum, pay) => sum + Number(pay.amount), 0)
        return paidForMonth < (due - 0.01)
      })

      const defaultMonth = payableMonths.length > 0 ? payableMonths[0] : null
      if (defaultMonth) {
        const auc = auctions.find(a => a.group_id === group.id && a.month === defaultMonth && a.status === 'confirmed')
        const div = auc?.dividend || 0
        const targetDue = amountDue(group.monthly_contribution, div, group.auction_scheme)
        const paid = mPayments.filter(pay => pay.month === defaultMonth).reduce((sum, pay) => sum + Number(pay.amount), 0)
        const balance = Math.max(0, targetDue - paid)
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
    if (!form.name) { showToast('Name is required', 'error'); return }

    setSaving(true)
    const { data: authData, error: authErr } = await supabase.auth.getUser()
    if (authErr || !authData.user) { showToast('Authentication error!', 'error'); setSaving(false); return }
    
    let personId;

    const { data: pData, error: pErr } = await supabase.from('persons')
      .insert({
        name: form.name,
        nickname: form.nickname,
        phone: form.phone || null,
        address: form.address,
        firm_id: firm.id,
        created_by: authData.user?.id
      })
      .select('id')
      .single()
      
    if (pErr) { showToast(pErr.message, 'error'); setSaving(false); return }
    personId = pData.id;
    showToast('Person registered!');

    // Now Enroll in Group
    if (form.group_id) {
      const groupId = Number(form.group_id);
      const numTickets = Number(form.num_tickets) || 1;
      
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
      }
    }

    setAddOpen(false)
    setForm({ name:'',nickname:'',phone:'',address:'',group_id:'',num_tickets:'1',existing_id:'' })
    load()
    setSaving(false)
  }

  const isOwner = role === 'owner' || role === 'superadmin'

  const handleExport = async () => {
    if (!isOwner && !isSuper) return
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) return
    
    setLoading(true)
    try {
      const { data: allPeople } = await withFirmScope(supabase.from('persons').select('id, name, nickname, phone, address'), targetId).is('deleted_at', null).order('name')
      if (!allPeople) return

      // Since we need totals, we also need ALL members for these people
      const { data: allMembers } = await withFirmScope(supabase.from('members').select('id, person_id, group_id, status'), targetId).is('deleted_at', null)
      
      const data = allPeople.map((p: any) => {
        const pMembers = (allMembers || []).filter((m: any) => m.person_id === p.id)
        const activeCount = pMembers.filter((m: any) => {
          const g = allGroups.find(x => x.id === m.group_id)
          return g && g.status !== 'archived'
        }).length
        
        return {
          ID: p.id, 
          Name: p.name, 
          Nickname: p.nickname || '', 
          Phone: p.phone || '', 
          Address: p.address || '',
          'Active Tickets': activeCount
        }
      })
      downloadCSV(data, 'people_directory_full')
    } finally {
      setLoading(false)
    }
  }
  
  const handleExportGroup = async (g: Group) => {
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) return
    setLoading(true)
    try {
      const { data: gMembers } = await withFirmScope(supabase.from('members').select('ticket_no, status, persons(name, nickname, phone)'), targetId)
        .eq('group_id', g.id)
        .is('deleted_at', null)
        .order('ticket_no')
        
      if (!gMembers) return
      const data = gMembers.map((m: any) => ({
        'Ticket No': m.ticket_no, Member: m.persons?.name, Nickname: m.persons?.nickname || '', Phone: m.persons?.phone || '', Status: m.status
      }))
      downloadCSV(data, `enrollment_${g.name.toLowerCase().replace(/\s+/g,'_')}`)
    } finally {
      setLoading(false)
    }
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
    const auc = auctions.find(a => a.group_id === payMember.group_id && a.month === +payForm.month && a.status === 'confirmed')
    const div = auc?.dividend || 0
    const targetDue = amountDue(group?.monthly_contribution || 0, div, group?.auction_scheme)
    const alreadyPaid = payments.filter(p => p.member_id === payMember.id && p.group_id === payMember.group_id && p.month === +payForm.month).reduce((s, p) => s + Number(p.amount), 0)
    const balanceDue = Math.max(0, targetDue - alreadyPaid - (+payForm.amount || 0))
    const isPartial = balanceDue > 0.01

    const payload: Omit<Payment, 'id'|'created_at'> = {
      firm_id: payMember.firm_id, member_id: payMember.id, group_id: payMember.group_id,
      month: +payForm.month, amount: +payForm.amount, payment_date: payForm.payment_date, mode: payForm.mode as any,
      status: 'paid', amount_due: targetDue, balance_due: balanceDue, payment_type: isPartial ? 'partial' : 'full',
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
    const p = persons.find(x => x.id === pId)
    setDelModal({ open: true, id: pId, name: p?.name || 'this person', isBulk: false })
  }

  async function confirmDeletePerson() {
    if (!delModal.id) return
    setSaving(true)
    haptics.heavy()
    
    try {
      if (delModal.isBulk) {
        const ids = Array.from(selectedIds)
        await supabase.from('persons').update({ deleted_at: new Date() }).in('id', ids)
        await supabase.from('members').update({ deleted_at: new Date() }).in('person_id', ids)
        showToast(`${ids.length} people moved to trash!`, 'success')
      } else {
        const pId = delModal.id
        const { error: pErr } = await supabase.from('persons').update({ deleted_at: new Date() }).eq('id', pId)
        if (pErr) throw pErr
        await supabase.from('members').update({ deleted_at: new Date() }).eq('person_id', pId)
        showToast('Person and tickets moved to trash!', 'success')
      }
      load()
      setDelModal({ open: false, id: null, name: '', isBulk: false })
    } catch (err: any) {
      showToast(err.message, 'error')
    } finally {
      setSaving(false)
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-24">
      {/* Redesigned Header Section */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 px-1">
        <div>
          <h1 className="text-3xl font-black text-[var(--text)] tracking-tighter leading-none">{t('member_directory')}</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="accent" className="py-0.5 px-2 text-[10px] font-bold">
              {summaryStats.activePeople} {t('registry_label')}
            </Badge>
            <span className="text-[11px] font-medium text-[var(--text3)]">
              {summaryStats.totalPeople} Total Registered
            </span>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <div className="flex p-0.5 bg-[var(--surface2)] rounded-lg border border-[var(--border)]">
            <button 
              onClick={() => { setView('people'); setSelectedIds(new Set()) }}
              className={cn(
                "px-3 py-1 rounded-md text-[11px] font-bold transition-all",
                view === 'people' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm" : "opacity-40 hover:opacity-100"
              )}
            >
              {t('all_people')}
            </button>
            <button 
              onClick={() => { setView('groups'); setSelectedIds(new Set()) }}
              className={cn(
                "px-3 py-1 rounded-md text-[11px] font-bold transition-all",
                view === 'groups' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm" : "opacity-40 hover:opacity-100"
              )}
            >
              {t('by_groups')}
            </button>
          </div>
          {view === 'people' && can('addMember') && (
            <div className="flex gap-1.5">
               <Btn variant="secondary" size="sm" className="text-xs font-bold" onClick={handleExport} icon={FileSpreadsheet}>Export</Btn>
               <Btn variant="secondary" size="sm" className="text-xs font-bold" onClick={() => setImportOpen(true)} icon={Upload}>Import</Btn>
            </div>
          )}
          {can('addMember') && (
            <Btn variant="primary" size="sm" className="text-xs font-bold px-4" onClick={() => setAddOpen(true)} icon={Plus}>
              {t('register_person')}
            </Btn>
          )}
        </div>
      </div>

      {/* Stats Summary Bar */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard label="Active Registry" value={summaryStats.activePeople} icon={Users} sub={`${summaryStats.totalPeople} Registered`} color="accent" compact />
        <StatCard label="Active Subscriptions" value={summaryStats.activeTickets} icon={Activity} sub={`${summaryStats.totalTickets} Total Tickets`} color="info" compact />
        <StatCard label="Total Exposure" value={fmt(summaryStats.totalChitValue)} icon={TrendingUp} sub="Sum of Chit Values" color="success" compact />
        <StatCard label="Total Payouts" value={fmt(summaryStats.totalPayouts)} icon={Wallet} sub="Owed to Winners" color="warning" compact />
      </div>

      <div className="flex flex-col md:flex-row gap-4 items-center">
        <div className="relative flex-1 group">
           <input 
              className="w-full bg-[var(--surface)] border rounded-md p-2.5 pl-10 font-medium text-sm focus:border-[var(--accent)] transition-all outline-none"
              style={{ borderColor: 'var(--border)' }}
              placeholder="Search by name, phone, or address..."
              value={search}
              onChange={e => setSearch(e.target.value)}
           />
           <Plus className="absolute left-3 top-1/2 -translate-y-1/2 rotate-45 text-[var(--text3)]" size={18} />
        </div>
        
        <label className="flex items-center gap-2 cursor-pointer bg-[var(--surface2)] px-2 py-1.5 rounded-lg border hover:border-[var(--accent)] transition-all shrink-0" style={{ borderColor: 'var(--border)' }}>
          <input 
            type="checkbox" 
            className="w-4 h-4 rounded-md bg-[var(--surface)] text-[var(--accent)] border-none ring-offset-0 focus:ring-0" 
            checked={showInactive} 
            onChange={e => setShowInactive(e.target.checked)} 
          />
          <span className="text-[11px] font-bold opacity-60">{t('past_members_label')}</span>
        </label>
      </div>


      {view === 'people' ? (
        <TableCard title={
          <div className="flex items-center justify-between">
            <div className="text-[11px] font-bold text-[var(--text2)] opacity-40">{t('total_registry_label')}</div>
            <div className="text-[11px] font-bold text-[var(--text2)] opacity-40">{summaryStats.activePeople} {t('registry_label')}</div>
          </div>
        }>
          <Table responsive>
            <thead>
              <Tr className="bg-[var(--surface2)]/30">
                <Th className="w-10 px-3">
                  <input type="checkbox" className="rounded border-slate-300" checked={selectedIds.size === filteredPeople.length && filteredPeople.length > 0} onChange={() => toggleAll(filteredPeople.map(p => p.id))} />
                </Th>
                {isSuper && <Th className="text-[11px] font-bold py-2">{t('firm')}</Th>}
                <Th className="text-[11px] font-bold py-2">{t('register_person')}</Th>
                <Th className="hidden md:table-cell text-[11px] font-bold">{t('phone')}</Th>
                <Th className="hidden sm:table-cell text-[11px] font-bold">{t('active_tickets')}</Th>
                <Th className="text-[11px] font-bold">{t('total_outstanding')}</Th>
                <Th right className="text-[11px] font-bold px-3">{t('action')}</Th>
              </Tr>
            </thead>
            <tbody className="divide-y divide-slate-50">
              {filteredPeople.map(c => {
                const isSelected = selectedIds.has(c.id)
                return (
                  <Tr key={c.id} className={cn(isSelected ? "bg-[var(--accent-dim)]" : "hover:bg-[var(--surface2)]/50 group/row transition-colors cursor-pointer")} onClick={() => toggleSelect(c.id)}>
                    <Td label="Select" className="px-3"><input type="checkbox" className="rounded border-slate-300" checked={isSelected} readOnly /></Td>
                    {isSuper && <Td label="Firm"><Badge variant="gray" className="text-[10px] font-bold">{c.firms?.name || '—'}</Badge></Td>}
                    <Td label="Person">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-xl bg-[var(--surface2)] border border-[var(--border)] flex items-center justify-center text-[var(--accent)] font-bold text-xs transition-colors">
                          {c.name.substring(0, 2)}
                        </div>
                        <div>
                          <div className="font-bold text-sm text-[var(--text)] tracking-tight">
                            {c.name} {c.nickname && <span className="text-[var(--accent)] font-bold text-[10px] ml-1 opacity-60">({c.nickname})</span>}
                          </div>
                          <div className="text-[11px] font-medium text-[var(--text3)] flex items-center gap-1 mt-0.5 opacity-60">
                            <MapPin size={10} className="opacity-40" /> {c.address || t('no_address')}
                          </div>
                        </div>
                      </div>
                    </Td>
                    <Td label="Phone" className="hidden md:table-cell font-mono text-xs font-medium text-[var(--text3)] opacity-60">{c.phone || '—'}</Td>
                    <Td label="Tickets" className="hidden sm:table-cell">
                      {c.activeCount > 0 ? (
                        <div className="flex items-center gap-2">
                          <Badge variant="info" className="text-[10px] font-bold">{c.activeCount} {t('status_active')}</Badge>
                        </div>
                      ) : <span className="text-[10px] font-medium opacity-20 tracking-wider">No active enrollment</span>}
                    </Td>
                    <Td label="Outstanding">
                       <div className={cn("font-bold font-mono text-sm tracking-tighter", c.totalBalance > 0.01 ? "text-[var(--danger)]" : "text-[var(--success)]")}>
                          {fmt(c.totalBalance)}
                       </div>
                       {c.totalPaid > 0 && <div className="text-[10px] font-medium opacity-40 mt-0.5">Paid: {fmt(c.totalPaid)}</div>}
                    </Td>
                    <Td label="Action" right className="px-3">
                      <div className="flex gap-1.5 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
                        <Btn size="sm" variant="secondary" className="h-7 w-7 p-0 rounded-lg shadow-sm" onClick={(e: any) => { e.stopPropagation(); router.push(`/members/${c.id}`) }}>
                          <ChevronRight size={14} />
                        </Btn>
                        <Btn size="sm" variant="danger" className="h-7 w-7 p-0 rounded-lg shadow-sm" onClick={(e: any) => { e.stopPropagation(); deletePerson(c.id) }}>
                          <Trash2 size={14} />
                        </Btn>
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
          {view === 'people' && (
            <div className="p-4 bg-slate-50/30 border-t border-slate-100">
              <Pagination 
                current={page} 
                total={totalCount} 
                pageSize={PAGE_SIZE} 
                onPageChange={setPage} 
              />
            </div>
          )}
        </TableCard>
      ) : (
        <div className="space-y-4">
          <div className="flex justify-end gap-1.5 mb-1 no-print">
            <Btn size="sm" variant="secondary" className="text-[11px] font-bold" onClick={() => setExpandedGroups(new Set(allGroups.map(g => g.id)))}>Expand All</Btn>
            <Btn size="sm" variant="secondary" className="text-[11px] font-bold" onClick={() => setExpandedGroups(new Set())}>Collapse All</Btn>
          </div>
          
          {allGroups.filter(g => g.status !== 'archived').map(g => {
            const gMembers = members.filter(m => m.group_id === g.id)
            const isOpen = expandedGroups.has(g.id)
            const gSelectedCount = gMembers.filter(m => selectedIds.has(m.id)).length
            
            return (
              <div key={g.id} className={cn(
                "bg-[var(--surface)] border rounded-2xl overflow-hidden transition-all shadow-sm",
                isOpen ? "border-[var(--accent)]" : "border-[var(--border)]"
              )}>
                <div 
                  className="px-4 py-2 flex items-center justify-between cursor-pointer hover:bg-[var(--surface2)]/50 transition-colors"
                  onClick={() => {
                    const next = new Set(expandedGroups)
                    if (next.has(g.id)) next.delete(g.id)
                    else next.add(g.id)
                    setExpandedGroups(next)
                  }}
                >
                  <div className="flex items-center gap-3">
                    <div className={cn("w-8 h-8 rounded-xl flex items-center justify-center transition-all", isOpen ? "bg-[var(--text)] text-white" : "bg-[var(--surface2)] opacity-40")}>
                      <ChevronDown size={16} className={cn("transition-transform duration-300", isOpen && "rotate-180")} />
                    </div>
                    <div>
                       <div className="font-bold text-sm text-[var(--text)] tracking-tight">{g.name}</div>
                      <div className="text-[11px] font-medium opacity-50">{fmt(g.chit_value)} · {gMembers.length} {t('members')}</div>
                    </div>
                  </div>
                  <div className="flex items-center gap-2">
                    {isSuper && <Badge variant="gray" className="hidden sm:flex text-[10px] font-bold">{g.firms?.name}</Badge>}
                    <Btn variant="secondary" size="sm" className="h-8 px-3 text-xs font-bold bg-white" icon={FileSpreadsheet} onClick={(e: any) => { e.stopPropagation(); handleExportGroup(g) }}>{t('export')}</Btn>
                  </div>
                </div>

                {isOpen && (
                  <div className="border-t animate-in slide-in-from-top-2 duration-300" style={{ borderColor: 'var(--border)' }}>
                    <Table responsive>
                        <thead>
                          <Tr className="bg-[var(--surface2)]/30">
                            <Th className="w-10 px-3">
                               <input type="checkbox" className="rounded border-slate-300" checked={gSelectedCount === gMembers.length && gMembers.length > 0} onChange={() => toggleAll(gMembers.map(m => m.id))} />
                            </Th>
                            <Th className="text-[11px] font-bold py-2">Ticket</Th>
                            <Th className="text-[11px] font-bold py-2">{t('register_person')}</Th>
                            <Th className="hidden md:table-cell text-[11px] font-bold">{t('phone')}</Th>
                            <Th className="hidden sm:table-cell text-[11px] font-bold">{t('group_status')}</Th>
                            <Th right className="text-[11px] font-bold px-3">{t('action')}</Th>
                          </Tr>
                        </thead>
                        <tbody className="divide-y divide-slate-50">
                          {gMembers.map(m => {
                            const isSelected = selectedIds.has(m.id)
                            const isWinner = auctions.some(a => a.winner_id === m.id)
                            return (
                              <Tr key={m.id} className={cn(isSelected ? "bg-[var(--accent-dim)]" : "hover:bg-[var(--surface2)]/30 group/row transition-colors cursor-pointer")} onClick={() => toggleSelect(m.id)}>
                                <Td label="Select" className="px-3"><input type="checkbox" className="rounded border-slate-300" checked={isSelected} readOnly /></Td>
                                <Td label="Ticket" className="font-mono font-bold text-sm text-[var(--accent)] tracking-tighter">#{String(m.ticket_no).padStart(2, '0')}</Td>
                                <Td label="Person">
                                   <div className="flex items-center gap-2">
                                     <span className="font-bold text-sm text-[var(--text)] tracking-tight">{m.persons?.name}</span>
                                     {m.persons?.nickname && <span className="text-[var(--accent)] font-bold text-[10px] opacity-60">({m.persons.nickname})</span>}
                                     {isWinner && <Badge variant="accent" className="text-[10px] font-bold">Winner</Badge>}
                                   </div>
                                </Td>
                                <Td label="Phone" className="hidden md:table-cell text-xs font-medium text-[var(--text3)] font-mono opacity-60">{m.persons?.phone || '—'}</Td>
                                <Td label="Status" className="hidden sm:table-cell">
                                   {m.status === 'foreman' 
                                    ? <Badge variant="info" className="text-[10px] font-bold">Foreman</Badge> 
                                    : <Badge variant="success" className="text-[10px] font-bold">Active</Badge>}
                                </Td>
                                <Td label="Action" right className="px-3">
                                   <div className="flex gap-1.5 justify-end opacity-0 group-hover/row:opacity-100 transition-opacity">
                                      <button onClick={(e: any) => { e.stopPropagation(); setPayMember(m) }} className="h-7 w-7 flex items-center justify-center rounded-lg bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--accent)] transition-all">
                                        <Wallet size={14} />
                                      </button>
                                      <button onClick={(e: any) => { e.stopPropagation(); router.push(`/members/${m.person_id}`) }} className="h-7 w-7 flex items-center justify-center rounded-lg bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--accent)] transition-all">
                                        <ChevronRight size={14} />
                                      </button>
                                   </div>
                                </Td>
                              </Tr>
                            )
                          })}
                        </tbody>
                    </Table>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}

      {/* Enrollment Modal */}
      <Modal open={addOpen} onClose={() => setAddOpen(false)} title={t('register_person')} size="lg">
        <div className="space-y-6">
            <div className="grid grid-cols-2 gap-4">
              <Field label={t('register_person')}><input className={inputClass} style={inputStyle} value={form.name} onChange={e => setForm(f => ({...f, name: e.target.value}))} placeholder="Full name" /></Field>
              <Field label={t('nickname')}><input className={inputClass} style={inputStyle} value={form.nickname} onChange={e => setForm(f => ({...f, nickname: e.target.value}))} placeholder="JD" /></Field>
              <Field label={`${t('phone')} (Optional)`}><input className={inputClass} style={inputStyle} value={form.phone} type="tel" maxLength={10} onChange={e => setForm(f => ({...f, phone: e.target.value.replace(/\D/g,'')}))} placeholder="Mobile" /></Field>
              <Field label={t('address')}><input className={inputClass} style={inputStyle} value={form.address} onChange={e => setForm(f => ({...f, address: e.target.value}))} placeholder="City/Town" /></Field>
            </div>

          <div className="pt-4 border-t" style={{ borderColor: 'var(--border)' }}>
            <div className="text-sub mb-4">{t('enrollment_details')}</div>
            <div className="grid grid-cols-2 gap-4">
              <Field label={`${t('target_group')} (Optional)`}>
                <select className={inputClass} style={inputStyle} value={form.group_id} onChange={e => setForm(f => ({ ...f, group_id: e.target.value }))}>
                   <option value="">-- {t('select_group')} --</option>
                   {allGroups.filter(g => g.status === 'active').map(g => (
                     <option key={g.id} value={g.id}>{g.name} ({fmt(g.chit_value)} · {g.duration}m)</option>
                   ))}
                </select>
              </Field>
              <Field label={`${t('tickets_to_add')} (Optional)`}>
                <input className={inputClass} style={inputStyle} type="number" min="1" max="10" value={form.num_tickets} onChange={e => setForm(f => ({ ...f, num_tickets: e.target.value }))} disabled={!form.group_id} />
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
      
      <CascadeDeleteModal 
        open={delModal.open}
        onClose={() => setDelModal({ open: false, id: null, name: '', isBulk: false })}
        onConfirm={confirmDeletePerson}
        title={delModal.isBulk ? `Move ${selectedIds.size} people to Trash?` : `Move "${delModal.name}" to Trash?`}
        targetId={delModal.isBulk ? Array.from(selectedIds).join(',') : (delModal.id || '')}
        targetType="person"
        loading={saving}
      />
      
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
                           setDelModal({ open: true, id: 'bulk', name: `${selectedIds.size} people`, isBulk: true })
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
