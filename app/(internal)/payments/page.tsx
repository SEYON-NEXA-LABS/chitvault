'use client'

import { useEffect, useState, useCallback, useMemo, Suspense } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, cn, getToday, getGroupDisplayName, fmtMonth } from '@/lib/utils'
import { 
  Card, TableCard, Loading, Badge, StatCard, Btn, 
  Modal, Field, Toast, Empty, Table, Th, Td, Tr 
} from '@/components/ui'
import { useToast } from '@/lib/hooks/useToast'
import { useI18n } from '@/lib/i18n/context'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { MemberLedger } from '@/components/features/MemberLedger'
import { CreditCard, Search, History, Trash2, Printer, Filter } from 'lucide-react'
import type { Group, Member, Auction, Payment, Person, Firm } from '@/types'

interface PersonSummary {
  person: Person;
  memberships: {
    member: Member;
    group: Group;
  }[];
  pendingBreakdown: {
    groupName: string;
    months: number[];
  }[];
  overallTotalBalance: number;
  isOverdue: boolean;
  lastPaymentDate: string | null;
}

export default function PaymentsPage() {
  return (
    <Suspense fallback={<Loading />}>
       <PaymentsContent />
    </Suspense>
  )
}

function PaymentsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const qPersonId = searchParams.get('person_id')

  const supabase = useMemo(() => createClient(), [])
  const { firm, role, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const { toast, show: showToast, hide: hideToast } = useToast()

  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [loading,  setLoading]  = useState(true)
  const [search,   setSearch]   = useState('')
  const [firms,    setFirms]    = useState<Firm[]>([])

  const isSuper = role === 'superadmin'

  const [viewMode, setViewMode] = useState<'pending' | 'all' | 'ledger'>('pending')

  const [historyModal, setHistoryModal] = useState<PersonSummary | null>(null)
  const [payModal,     setPayModal]     = useState<PersonSummary | null>(null)
  const [page, setPage] = useState(1)
  const [totalCount, setTotalCount] = useState(0)
  const PAGE_SIZE = 20
  
  const [personSummariesData, setPersonSummariesData] = useState<any[]>([])
  const [pageAuctions, setPageAuctions] = useState<Auction[]>([])
  const [pagePayments, setPagePayments] = useState<Payment[]>([])
  const [ledgerPayments, setLedgerPayments] = useState<any[]>([])
  
  const load = useCallback(async (isInitial = false) => {
    if (isInitial) setLoading(true)
    const targetId = isSuper ? switchedFirmId : firm?.id
    if (!targetId) return

    try {
      // 1. Fetch Paginated Persons List
      let pQuery = withFirmScope(supabase.from('persons').select('id, name, phone, nickname', { count: 'exact' }), targetId).is('deleted_at', null)
      if (search) pQuery = pQuery.or(`name.ilike.%${search}%,phone.ilike.%${search}%`)
      
      const { data: pData, count, error: pErr } = await pQuery
        .order('name')
        .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

      if (pErr) showToast(pErr.message, 'error')
      const currentPersons = (pData || []) as any[]
      setTotalCount(count || 0)

      const personIds = currentPersons.map(p => p.id)

      // 2. Fetch Summaries via RPC
      const { data: summaries, error: sErr } = await supabase.rpc('get_person_financial_summaries', {
        p_firm_id: targetId,
        p_person_ids: personIds
      })

      if (sErr) console.error('Summary RPC Error:', sErr)

      // 3. Fetch Metadata
      const { data: mData } = await withFirmScope(supabase.from('members').select('id, person_id, group_id, ticket_no, status, persons(id, name, nickname, phone)'), targetId)
        .in('person_id', personIds)
        .is('deleted_at', null)
      
      const relevantGroupIds = Array.from(new Set((mData as any[])?.map(m => m.group_id) || []))
      const mIds = (mData as any[])?.map(m => m.id) || []

      const [gData, aData, paymentsData] = await Promise.all([
        withFirmScope(supabase.from('groups').select('id, name, duration, monthly_contribution, status, auction_scheme, start_date'), targetId)
            .in('id', relevantGroupIds)
            .is('deleted_at', null),
        withFirmScope(supabase.from('auctions').select('id, group_id, month, auction_discount, dividend, winner_id, status'), targetId)
            .in('group_id', relevantGroupIds)
            .eq('status', 'confirmed')
            .is('deleted_at', null)
            .order('month'),
        withFirmScope(supabase.from('payments').select('id, member_id, group_id, person_id, amount, month, payment_date, created_at'), targetId)
            .in('member_id', mIds)
            .is('deleted_at', null)
      ])
      
      setMembers(mData || [])
      setGroups(gData.data || [])
      setPageAuctions(aData.data || [])
      setPagePayments(paymentsData.data || [])
      setPersonSummariesData(summaries || [])

      // 4. Ledger Mode - Fetch all recent payments in firm
      if (viewMode === 'ledger') {
        const { data: lData } = await withFirmScope(supabase.from('payments').select(`
          id, amount, payment_date, created_at, mode, month,
          groups(name),
          persons:person_id(name)
        `), targetId)
        .is('deleted_at', null)
        .order('created_at', { ascending: false })
        .limit(50)
        setLedgerPayments(lData || [])
      }

      if (isSuper && firms.length === 0) {
        const { data: f } = await supabase.from('firms').select('id, name').order('name')
        setFirms(f || [])
      }
    } finally {
      setLoading(false)
    }
  }, [supabase, isSuper, switchedFirmId, firm, firms.length, page, search, showToast])

  useEffect(() => {
    setPage(1)
  }, [search])

  useEffect(() => { load(true) }, [load])

  // Map RPC and calculate breakdown
  const summaries: PersonSummary[] = useMemo(() => {
    const raw = personSummariesData || []
    const mapped = raw.map((row: any) => {
      const pMembers = members.filter(m => m.person_id === row.person_id)
      if (pMembers.length === 0) return null

      const breakdown: any[] = []
      pMembers.forEach(m => {
        const g = groups.find(x => x.id === m.group_id)
        if (!g) return
        
        const gAuctions = pageAuctions.filter(a => a.group_id === g.id)
        const mPayments = pagePayments.filter(p => p.member_id === m.id)
        
        const latestMonth = gAuctions.length
        const nextDate = new Date(g.start_date || getToday())
        nextDate.setMonth(nextDate.getMonth() + latestMonth)
        const isDueNow = new Date() >= nextDate
        const currentMonth = Math.min(g.duration, isDueNow ? latestMonth + 1 : latestMonth)
        
        const missed: number[] = []
        for (let month = 1; month <= currentMonth; month++) {
           const isAcc = g.auction_scheme === 'ACCUMULATION'
           const prevMonthAuc = gAuctions.find(a => a.group_id === g.id && a.month === month - 1)
           const due = isAcc ? Number(g.monthly_contribution) : Number(g.monthly_contribution) - (prevMonthAuc ? Number(prevMonthAuc.dividend || 0) : 0)
           const paid = mPayments.filter(p => p.month === month).reduce((s, p) => s + Number(p.amount), 0)
           if (due - paid > 0.1) missed.push(month)
        }
        
        if (missed.length > 0) {
          breakdown.push({ groupName: g.name, months: missed })
        }
      })

      return {
        person: pMembers[0].persons!,
        memberships: pMembers.map(m => ({
          member: m,
          group: groups.find(g => g.id === m.group_id)!
        })),
        pendingBreakdown: breakdown,
        overallTotalBalance: Number(row.overall_balance || 0),
        isOverdue: !!row.is_overdue,
        lastPaymentDate: row.last_payment_date
      }
    }).filter(Boolean) as PersonSummary[]

    if (viewMode === 'pending') {
       return mapped.filter(s => s.overallTotalBalance > 0.1).sort((a,b) => b.overallTotalBalance - a.overallTotalBalance)
    }
    return mapped
  }, [personSummariesData, members, groups, pageAuctions, pagePayments, viewMode])

  if (loading) return <Loading />

  return (
    <div className="space-y-6 pb-24">
      <div className="flex flex-col lg:flex-row items-baseline justify-between gap-4">
        <div>
           <h1 className="text-3xl font-black text-[var(--text)] tracking-tight">Collection & Dues</h1>
           <p className="text-xs font-medium opacity-40 uppercase tracking-widest mt-1">Audit, Receipts & Transaction History</p>
        </div>
        
        <div className="flex p-1 bg-[var(--surface2)] rounded-xl border" style={{ borderColor: 'var(--border)' }}>
          <button 
            onClick={() => setViewMode('pending')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              viewMode === 'pending' ? "bg-[var(--surface)] text-[var(--danger)] shadow-sm border border-[var(--border)]" : "opacity-40 hover:opacity-100"
            )}
          >
            <Filter size={14}/> Upcoming & Pending
          </button>
          <button 
            onClick={() => setViewMode('all')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              viewMode === 'all' ? "bg-[var(--surface)] text-[var(--accent)] shadow-sm border border-[var(--border)]" : "opacity-40 hover:opacity-100"
            )}
          >
            {t('view_full_registry')}
          </button>
          <button 
            onClick={() => setViewMode('ledger')}
            className={cn(
              "px-4 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center gap-2",
              viewMode === 'ledger' ? "bg-[var(--surface)] text-indigo-500 shadow-sm border border-[var(--border)]" : "opacity-40 hover:opacity-100"
            )}
          >
            <History size={14}/> {t('view_recent_receipts')}
          </button>
        </div>
      </div>

      <div className="relative group">
         <input 
            className="w-full bg-[var(--surface)] border-2 rounded-2xl p-4 pl-12 font-bold text-sm focus:border-[var(--accent)] transition-all outline-none"
            style={{ borderColor: 'var(--border)' }}
            placeholder={t('search_registry_placeholder')}
            value={search}
            onChange={e => setSearch(e.target.value)}
         />
         <Search className="absolute left-4 top-1/2 -translate-y-1/2 opacity-30" size={20} />
      </div>

      <div className="md:hidden space-y-3">
        {viewMode === 'ledger' ? (
          ledgerPayments.length === 0 ? <Empty text={t('no_transactions')} /> : ledgerPayments.map(p => (
            <div key={p.id} className="p-5 rounded-[2rem] border bg-[var(--surface)] shadow-sm border-[var(--border)]">
              <div className="flex justify-between items-start mb-4">
                <div>
                   <div className="text-[10px] font-black uppercase tracking-widest opacity-40 mb-1">{fmtDate(p.payment_date || p.created_at)}</div>
                   <div className="font-black text-lg text-[var(--text)]">{p.persons?.name}</div>
                   <div className="text-[10px] font-bold text-indigo-500 uppercase tracking-tight">{p.groups?.name}</div>
                </div>
                <div className="text-right">
                   <div className="text-xl font-black text-emerald-500 font-brand">+{fmt(p.amount)}</div>
                   <Badge variant="gray" className="mt-1">{p.mode}</Badge>
                </div>
              </div>
            </div>
          ))
        ) : (
          summaries.length === 0 ? <Empty text={t('nothing_to_show')} /> : summaries.map(s => (
            <div key={s.person.id} className="p-5 rounded-[2rem] border bg-[var(--surface)] shadow-sm border-[var(--border)]">
              <div className="flex justify-between items-start mb-4">
                <div>
                  <div className="font-black text-lg hover:text-indigo-500 cursor-pointer" onClick={() => router.push(`/members/${s.person.id}`)}>{s.person.name}</div>
                  <div className="text-[10px] opacity-40 uppercase tracking-widest font-bold mb-2">{s.person.phone || '—'}</div>
                  
                  <div className="space-y-1">
                    {s.pendingBreakdown.length === 0 ? (
                      <div className="text-[9px] opacity-40 italic">{t('no_dues_pending')}</div>
                    ) : s.pendingBreakdown.map((b, idx) => (
                      <div key={idx} className="flex items-center gap-2">
                        <span className="text-[10px] font-bold opacity-60 uppercase truncate max-w-[120px]">{b.groupName}</span>
                        <div className="flex gap-1">
                          {b.months.map(m => <Badge key={m} variant="gray" className="text-[8px] py-0 px-1 border-0 bg-[var(--surface2)] opacity-80">M{m}</Badge>)}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
                <div className="text-right">
                  <div className={cn("text-xl font-black font-brand", s.overallTotalBalance > 0.01 ? (s.isOverdue ? "text-[var(--danger)]" : "text-indigo-500") : "text-emerald-500")}>
                    {fmt(s.overallTotalBalance)}
                  </div>
                </div>
              </div>
              <div className="flex gap-2">
                <Btn size="md" variant="secondary" className="flex-1 py-4" icon={History} onClick={() => setHistoryModal(s)}>{t('audit')}</Btn>
                <Btn size="md" variant="primary" className="flex-1 py-4 shadow-lg shadow-indigo-500/20" icon={CreditCard} onClick={() => router.push(`/payments?person_id=${s.person.id}`)}>{t('collect')}</Btn>
              </div>
            </div>
          ))
        )}
      </div>

      <div className="hidden md:block">
        <TableCard title={
          viewMode === 'ledger' ? t('recent_receipts_audit') : 
          viewMode === 'pending' ? t('view_actionable') : t('full_registry_tracking')
        }>
          {viewMode === 'ledger' ? (
            <Table>
              <thead>
                <Tr>
                  <Th>{t('received_on')}</Th>
                  <Th>{t('payer_group')}</Th>
                  <Th right>{t('amount_collected')}</Th>
                  <Th>{t('payment_mode')}</Th>
                </Tr>
              </thead>
              <tbody>
                {ledgerPayments.length === 0 ? <Tr><Td colSpan={4}><Empty text="No receipts found." /></Td></Tr> : ledgerPayments.map(p => (
                  <Tr key={p.id}>
                    <Td className="whitespace-nowrap font-medium opacity-60">{fmtDate(p.payment_date || p.created_at)}</Td>
                    <Td>
                      <div className="font-black text-[var(--text)]">{p.persons?.name}</div>
                      <div className="text-[10px] uppercase tracking-widest font-bold text-indigo-500/60 mt-0.5">{p.groups?.name} <span className="opacity-20 mx-1">/</span> Month {p.month}</div>
                    </Td>
                    <Td right className="text-xl font-black text-emerald-500 font-brand">+{fmt(p.amount)}</Td>
                    <Td><Badge variant="gray">{p.mode}</Badge></Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          ) : (
            <Table>
              <thead><Tr><Th>{t('person')}</Th><Th>{t('pending_breakdown')}</Th><Th right>{t('total_balance')}</Th><Th right>{t('action')}</Th></Tr></thead>
              <tbody>
                {summaries.length === 0 ? <Tr><Td colSpan={4}><Empty text="Nothing to show." /></Td></Tr> : summaries.map(s => (
                  <Tr key={s.person.id}>
                    <Td>
                      <div className="font-black text-base cursor-pointer hover:text-indigo-500 transition-colors" onClick={() => router.push(`/members/${s.person.id}`)}>{s.person.name}</div>
                      <div className="text-[10px] opacity-40 font-bold uppercase tracking-widest">{s.person.phone}</div>
                    </Td>
                    <Td>
                      <div className="space-y-1">
                        {s.pendingBreakdown.length === 0 ? (
                          <Badge variant="success" className="text-[9px]">{t('account_clear')}</Badge>
                        ) : s.pendingBreakdown.map((b, idx) => (
                          <div key={idx} className="flex items-center gap-2">
                            <span className="text-[10px] font-bold opacity-40 uppercase truncate max-w-[150px]">{b.groupName}</span>
                            <div className="flex flex-wrap gap-1">
                              {b.months.map(m => <Badge key={m} variant="gray" className="text-[8px] py-0 px-1 border-0 bg-[var(--surface2)]">M{m}</Badge>)}
                            </div>
                          </div>
                        ))}
                      </div>
                    </Td>
                    <Td right className={cn("font-black text-xl font-brand", s.overallTotalBalance > 0.01 ? (s.isOverdue ? "text-[var(--danger)]" : "text-indigo-500") : "text-emerald-500")}>
                      {fmt(s.overallTotalBalance)}
                    </Td>
                    <Td right>
                       <div className="flex items-center justify-end gap-2">
                          <Btn size="sm" variant="secondary" icon={History} onClick={() => setHistoryModal(s)} />
                          <Btn size="sm" variant="primary" icon={CreditCard} onClick={() => router.push(`/payments?person_id=${s.person.id}`)}>Collect</Btn>
                       </div>
                    </Td>
                  </Tr>
                ))}
              </tbody>
            </Table>
          )}
        </TableCard>
      </div>

      {historyModal && (
        <Modal open={!!historyModal} onClose={() => setHistoryModal(null)} title={`Ledger - ${historyModal.person.name}`} size="lg">
           <MemberLedger personId={historyModal.person.id} firmId={isSuper ? switchedFirmId || '' : firm?.id || ''} />
        </Modal>
      )}

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={hideToast} />}
    </div>
  )
}
