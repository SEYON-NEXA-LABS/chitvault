'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmtMonth, getToday } from '@/lib/utils'
import { Loading, Btn, Field, inputClass, inputStyle } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
import { useTerminology } from '@/lib/hooks/useTerminology'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { ChevronLeft, Printer, FileSpreadsheet, Info } from 'lucide-react'
import { GET_REPORTS } from '../constants'
import { downloadCSV } from '@/lib/utils/csv'
import { Pagination } from '@/components/ui'

// Components
import { ReportPNL, ReportTodayCollection } from '../components/ReportFinancials'
import { ReportCashFlow, ReportMemberBenefits } from '../components/ReportGeneral'
import { ReportWinners, ReportWinnerIntelligence } from '../components/ReportWinners'
import { ReportUpcomingPay, ReportAuctionSched, ReportEnrollment } from '../components/ReportOps'
import { ReportMemberHistory, ReportDefaulters } from '../components/ReportMemberTraits'
import { ReportGroupLedger } from '../components/ReportGroupLedger'
import { ReportReconciliation, ReportActivityLog } from '../components/ReportAudits'

export default function DynamicReportPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ReportContent />
    </Suspense>
  )
}

function ReportContent() {
  const params = useParams()
  const searchParams = useSearchParams()
  const router = useRouter()
  const supabase = createClient()
  const { firm, role, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  
  const id = params?.id as string
  const isSuper = role === 'superadmin'
  const targetId = isSuper ? switchedFirmId : firm?.id

  // Shared Data
  const [data, setData] = useState<any>({
    groups: [], members: [], auctions: [], payments: [], commissions: [], denominations: [], logs: [], profiles: [], stats: null
  })
  const [loading, setLoading] = useState(true)
  const [timeFilter, setTimeFilter] = useState('all')

  // Pagination state
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(50)
  const [totalRecords, setTotalRecords] = useState(0)

  // Selection state for specific reports
  const [selectedGroupId, setSelectedGroupId] = useState(searchParams.get('group_id') || '')
  const [selectedMemberId, setSelectedMemberId] = useState(searchParams.get('member_id') || '')
  const [selectedDate, setSelectedDate] = useState(getToday())
  const [winnerFilter, setWinnerFilter] = useState<'all'|'pending'|'settled'>('all')

  const reports = useMemo(() => GET_REPORTS(t, term), [t, term])
  const activeReport = reports.find(r => r.id === id)

  useEffect(() => {
    if (!targetId || !id) return
    
    async function fetchReportData() {
      setLoading(true)
      try {
        const queries: any[] = []
        
        // 1. Groups: Always needed for context/filters
        queries.push(withFirmScope(supabase.from('groups').select('id, name, duration, monthly_contribution, chit_value, start_date, status, auction_scheme'), targetId).order('name'))

        const range = [(page - 1) * pageSize, page * pageSize - 1]

        // 2. Members: Paginated
        if (['group_enrollment', 'group_ledger', 'member_history', 'defaulters', 'winners', 'upcoming_pay'].includes(id)) {
          let q = withFirmScope(supabase.from('members').select('id, person_id, group_id, status, ticket_no, persons(name, phone)', { count: 'exact' }), targetId)
          if (id === 'defaulters') q = q.eq('status', 'defaulter')
          queries.push(q.range(range[0], range[1]))
        } else {
          queries.push(Promise.resolve({ data: [] }))
        }

        // 3. Auctions: Always Paginated
        if (['pnl', 'cashflow', 'dividend', 'auction_insights', 'winners', 'upcoming_pay', 'group_ledger', 'member_history', 'group_enrollment', 'auction_sched', 'defaulters'].includes(id)) {
          let q = withFirmScope(supabase.from('auctions').select('id, group_id, month, winner_id, auction_discount, dividend, net_payout, payout_amount, is_payout_settled, payout_date, status, created_at', { count: 'exact' }), targetId).order('month')
          if (id === 'winners') q = q.not('winner_id', 'is', null)
          queries.push(q.range(range[0], range[1]))
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 4. Payments: Always Paginated
        if (['today_collection', 'cashflow', 'upcoming_pay', 'group_ledger', 'member_history', 'reconciliation', 'auction_insights'].includes(id)) {
          let selectStr = 'id, member_id, group_id, month, amount, mode, payment_date, created_at';
          
          // For collection reports, we need the member names
          if (['today_collection', 'reconciliation'].includes(id)) {
            selectStr += ', members:member_id(person_id, persons:person_id(name))';
          }

          let payQ = withFirmScope(supabase.from('payments').select(selectStr, { count: 'exact' }), targetId)
          
          if (id === 'today_collection') {
            payQ = payQ.eq('payment_date', selectedDate)
          }

          queries.push(payQ
            .order('created_at', { ascending: false })
            .range(range[0], range[1]))
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 5. Commissions
        if (id === 'pnl') {
          queries.push(withFirmScope(supabase.from('foreman_commissions').select('id, group_id, month, commission_amt, status, created_at', { count: 'exact' }), targetId)
            .order('month')
            .range(range[0], range[1]))
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 6. Denominations
        if (id === 'reconciliation') {
          queries.push(withFirmScope(supabase.from('denominations').select('id, entry_date, total, notes, created_at', { count: 'exact' }), targetId).order('entry_date', { ascending: false }).range(range[0], range[1]))
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 7. Activity Logs
        if (id === 'activity') {
          queries.push(withFirmScope(supabase.from('activity_logs').select('id, user_id, action, entity_type, entity_id, metadata, created_at', { count: 'exact' }), targetId).order('created_at', { ascending: false }).range(range[0], range[1]))
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 8. Stats
        if (['today_collection', 'pnl', 'cashflow', 'dividend', 'auction_insights', 'reconciliation'].includes(id)) {
           queries.push(supabase.rpc('get_firm_summary_stats', { 
             p_firm_id: targetId,
             p_start_date: searchParams.get('start') || null,
             p_end_date: searchParams.get('end') || null
           }))
        } else { queries.push(Promise.resolve({ data: null })) }

        queries.push(withFirmScope(supabase.from('profiles').select('id, full_name'), targetId))

        const results = await Promise.all(queries)
        
        const mainRes = (results[1].count != null) ? results[1] : (results[2].count != null ? results[2] : (results[3].count != null ? results[3] : (results[4].count != null ? results[4] : (results[6].count != null ? results[6] : results[5]))))
        setTotalRecords(mainRes.count || 0)

        setData({
          groups: results[0].data || [],
          members: results[1].data || [],
          auctions: results[2].data || [],
          payments: results[3].data || [],
          commissions: results[4].data || [],
          denominations: results[5].data || [],
          logs: results[6].data || [],
          stats: results[7]?.data || null,
          profiles: results[8].data || []
        })
      } finally {
        setLoading(false)
      }
    }

    fetchReportData()
  }, [id, targetId, supabase, page, pageSize, searchParams, selectedDate])

  const renderReport = () => {
    switch (id) {
      case 'today_collection': return (
        <div className="space-y-4">
          <Field label="Select Date" className="max-w-sm no-print">
            <input type="date" className={inputClass} style={inputStyle} value={selectedDate} onChange={e => { setSelectedDate(e.target.value); setPage(1) }} />
          </Field>
          <ReportTodayCollection payments={data.payments} members={data.members} groups={data.groups} stats={data.stats} selectedDate={selectedDate} />
        </div>
      )
      case 'pnl': return <ReportPNL groups={data.groups} commissions={data.commissions} stats={data.stats} t={t} term={term} />
      case 'cashflow': return <ReportCashFlow payments={data.payments} auctions={data.auctions} />
      case 'dividend': return <ReportMemberBenefits groups={data.groups} auctions={data.auctions} term={term} />
      case 'winners': return <ReportWinners auctions={data.auctions} groups={data.groups} members={data.members} filter={winnerFilter} onFilterChange={setWinnerFilter} />
      case 'auction_insights': return <ReportWinnerIntelligence auctions={data.auctions} groups={data.groups} members={data.members} payments={data.payments} />
      case 'upcoming_pay': return <ReportUpcomingPay groups={data.groups} members={data.members} auctions={data.auctions} payments={data.payments} />
      case 'auction_sched': return <ReportAuctionSched groups={data.groups} auctions={data.auctions} />
      case 'defaulters': return <ReportDefaulters members={data.members} groups={data.groups} auctions={data.auctions} />
      case 'reconciliation': return <ReportReconciliation payments={data.payments} denominations={data.denominations} />
      case 'activity': return <ReportActivityLog logs={data.logs} profiles={data.profiles} />
      case 'group_enrollment': return (
        <div className="space-y-4">
          <Field label="Select Group" className="max-w-sm no-print">
            <select className={inputClass} style={inputStyle} value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
              <option value="">-- Choose Group --</option>
              {data.groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          {selectedGroupId && <ReportEnrollment targetGroupId={Number(selectedGroupId)} members={data.members} groups={data.groups} auctions={data.auctions} />}
        </div>
      )
      case 'group_ledger': return (
        <div className="space-y-4">
          <Field label="Select Group" className="max-w-sm no-print">
            <select className={inputClass} style={inputStyle} value={selectedGroupId} onChange={e => setSelectedGroupId(e.target.value)}>
              <option value="">-- Choose Group --</option>
              {data.groups.map((g: any) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          {selectedGroupId && <ReportGroupLedger groupId={Number(selectedGroupId)} members={data.members} groups={data.groups} auctions={data.auctions} payments={data.payments} term={term} />}
        </div>
      )
      case 'member_history': return (
        <div className="space-y-4">
          <Field label="Select Member" className="max-w-sm no-print">
            <select className={inputClass} style={inputStyle} value={selectedMemberId} onChange={e => setSelectedMemberId(e.target.value)}>
              <option value="">-- Choose Member --</option>
              {data.members.map((m: any) => <option key={m.id} value={m.id}>{m.persons?.name} ({data.groups.find((g:any)=>g.id===m.group_id)?.name})</option>)}
            </select>
          </Field>
          {selectedMemberId && <ReportMemberHistory memberId={Number(selectedMemberId)} members={data.members} groups={data.groups} payments={data.payments} auctions={data.auctions} />}
        </div>
      )
      default: return <div>Report not found</div>
    }
  }

  if (loading) return <Loading />

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between no-print border-b pb-4" style={{ borderColor: 'var(--border)' }}>
        <div className="flex flex-col">
          <button onClick={() => router.push('/reports')} className="flex items-center gap-1 text-xs font-medium mb-1 hover:underline opacity-50">
            <ChevronLeft size={14} /> Back to Reports
          </button>
          <h1 className="text-2xl font-bold">{activeReport?.title}</h1>
        </div>
        <div className="flex items-center gap-2">
            <Btn 
              variant="secondary" 
              size="sm" 
              onClick={async () => {
                const total = totalRecords
                if (confirm(`Full CSV Export will fetch all ${total.toLocaleString()} records.\n\nProceed?`)) {
                  setLoading(true)
                  try {
                    let exportCols = '*'
                    let table = ''
                    
                    if (id === 'activity') {
                      table = 'activity_logs'; exportCols = 'id, user_id, action, entity_type, entity_id, metadata, created_at'
                    } else if (id === 'reconciliation') {
                      table = 'denominations'; exportCols = 'id, entry_date, total, notes, created_at'
                    } else if (id === 'pnl') {
                      table = 'foreman_commissions'; exportCols = 'id, group_id, month, commission_amt, status, created_at'
                    } else if (['today_collection', 'cashflow'].includes(id)) {
                      table = 'payments'; exportCols = 'id, member_id, group_id, month, amount, mode, payment_date, created_at'
                    } else {
                      table = 'auctions'; exportCols = 'id, group_id, month, winner_id, auction_discount, dividend, net_payout, payout_amount, is_payout_settled, payout_date, status, created_at'
                    }

                    const q = withFirmScope(supabase.from(table).select(exportCols), targetId)
                    const { data: fullData } = await q
                    if (fullData) downloadCSV(fullData, `chitvault-report-${id}-${getToday()}.csv`)
                  } finally {
                    setLoading(false)
                  }
                }
              }} 
              icon={FileSpreadsheet}
            >
              Export CSV
            </Btn>
            <Btn 
              variant="secondary" 
              size="sm" 
              onClick={() => window.print()} 
              icon={Printer}
            >
              Print
            </Btn>
        </div>
      </div>
      
      <div className="printable">
        {renderReport()}

        <Pagination 
          current={page} 
          total={totalRecords} 
          pageSize={pageSize} 
          onPageChange={setPage} 
          onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} 
        />
      </div>
    </div>
  )
}
