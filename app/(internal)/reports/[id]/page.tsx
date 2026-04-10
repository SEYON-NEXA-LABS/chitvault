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
import { ReportUpcomingPay, ReportAuctionSched, ReportGroupEnrollment } from '../components/ReportOps'
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
  const [winnerFilter, setWinnerFilter] = useState<'all'|'pending'|'settled'>('all')

  const reports = useMemo(() => GET_REPORTS(t, term), [t, term])
  const activeReport = reports.find(r => r.id === id)

  useEffect(() => {
    if (!targetId || !id) return
    
    async function fetchReportData() {
      setLoading(true)
      try {
        const queries: any[] = []
        
        // 1. Groups: Always needed for context/filters, but keep columns tight
        queries.push(withFirmScope(supabase.from('groups').select('id, name, duration, monthly_contribution, chit_value, start_date, status, auction_scheme'), targetId).order('name'))

        // 2. Members: ONLY for reports that need a member picker or full list
        if (['group_enrollment', 'group_ledger', 'member_history', 'defaulters', 'winners', 'upcoming_pay'].includes(id)) {
          queries.push(withFirmScope(supabase.from('members').select('id, person_id, group_id, status, ticket_no, persons(name, phone)'), targetId))
        } else {
          queries.push(Promise.resolve({ data: [] }))
        }

        const range = [(page - 1) * pageSize, page * pageSize - 1]

        // 3. Auctions: Paginated unless it's a summary like PNL/Cashflow
        if (['pnl', 'cashflow', 'dividend', 'auction_insights', 'winners', 'upcoming_pay', 'group_ledger', 'member_history', 'group_enrollment', 'auction_sched', 'defaulters'].includes(id)) {
          let q = withFirmScope(supabase.from('auctions').select('id, group_id, month, winner_id, auction_discount, dividend, net_payout, payout_amount, is_payout_settled, payout_date, status', { count: 'exact' }), targetId).order('month')
          if (!['pnl', 'cashflow', 'auction_insights'].includes(id)) q = q.range(range[0], range[1])
          queries.push(q)
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 4. Payments: Paginated, only for relevant reports
        if (['today_collection', 'cashflow', 'upcoming_pay', 'group_ledger', 'member_history', 'reconciliation', 'auction_insights'].includes(id)) {
          let q = withFirmScope(supabase.from('payments').select('id, member_id, group_id, amount, mode, payment_date, created_at', { count: 'exact' }), targetId).order('payment_date', { ascending: false })
          if (!['cashflow', 'auction_insights'].includes(id)) q = q.range(range[0], range[1])
          queries.push(q)
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 5. Commissions (PNL Only)
        if (id === 'pnl') {
          queries.push(withFirmScope(supabase.from('foreman_commissions').select('id, group_id, month, commission_amt, status, created_at', { count: 'exact' }), targetId))
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 6. Denominations (Recon Only)
        if (id === 'reconciliation') {
          queries.push(withFirmScope(supabase.from('denominations').select('id, entry_date, total, notes, created_at', { count: 'exact' }), targetId).order('entry_date', { ascending: false }).range(range[0], range[1]))
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 7. Activity Logs (Audit Only)
        if (id === 'activity') {
          queries.push(withFirmScope(supabase.from('activity_logs').select('id, user_id, action, entity_type, entity_id, metadata, created_at', { count: 'exact' }), targetId).order('created_at', { ascending: false }).range(range[0], range[1]))
        } else { queries.push(Promise.resolve({ data: [] })) }

        // 8. Stats & Profiles
        if (id === 'today_collection') {
           queries.push(supabase.rpc('get_firm_ledger_stats', { p_firm_id: targetId }))
        } else { queries.push(Promise.resolve({ data: null })) }

        queries.push(withFirmScope(supabase.from('profiles').select('id, full_name'), targetId))

        const results = await Promise.all(queries)
        
        // Pagination logic
        const mainRes = results[2].count != null ? results[2] : 
                       results[3].count != null ? results[3] : 
                       results[4].count != null ? results[4] : 
                       results[6].count != null ? results[6] : 
                       results[5]
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
  }, [id, targetId, supabase, page, pageSize])

  const renderReport = () => {
    switch (id) {
      case 'today_collection': return <ReportTodayCollection payments={data.payments} members={data.members} groups={data.groups} stats={data.stats} />
      case 'pnl': return <ReportPNL groups={data.groups} commissions={data.commissions} t={t} term={term} />
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
          {selectedGroupId && <ReportGroupEnrollment groupId={Number(selectedGroupId)} members={data.members} groups={data.groups} auctions={data.auctions} />}
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
                const sheets = Math.ceil(totalRecords / 25)
                const isLarge = totalRecords > 500
                const warning = isLarge ? "\n\n⚠️ WARNING: This is a large dataset. Fetching this will consume significant database bandwidth." : ""
                
                if (confirm(`Full CSV Export will fetch all ${totalRecords.toLocaleString()} records.${warning}\n\nEstimated Print: ~${sheets} A4 sheets.\n\nProceed with full data fetch?`)) {
                  setLoading(true)
                  try {
                    // Dynamic full fetch for CSV
                    const q = withFirmScope(supabase.from(id === 'activity' ? 'activity_logs' : id === 'reconciliation' ? 'denominations' : id === 'pnl' ? 'foreman_commissions' : (['today_collection', 'cashflow'].includes(id) ? 'payments' : 'auctions')).select('*'), targetId)
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
              onClick={() => {
                const sheets = Math.ceil(totalRecords / 25)
                const isLarge = totalRecords > 500
                const warning = isLarge ? "\n\n⚠️ NOTE: Printing very large reports (500+ rows) may cause browser lag." : ""
                
                if (confirm(`Print Preview for all ${totalRecords.toLocaleString()} records?${warning}\n\nEstimated: ~${sheets} A4 sheets.\n\nContinue?`)) {
                  window.print()
                }
              }} 
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
