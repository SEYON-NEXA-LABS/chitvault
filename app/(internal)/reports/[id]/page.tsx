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
import { ChevronLeft, Printer, FileSpreadsheet, Info, Search, ChevronDown, Check, User, X } from 'lucide-react'
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
  const [memberSearch, setMemberSearch] = useState('')
  const [memberDropdownOpen, setMemberDropdownOpen] = useState(false)
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
        queries.push(withFirmScope(supabase.from('groups').select('id, name, duration, num_members, monthly_contribution, chit_value, start_date, status, auction_scheme, commission_type, commission_value, accumulated_surplus'), targetId).order('name'))

        const range = [(page - 1) * pageSize, page * pageSize - 1]

        // 2. Members: Paginated (except for member_history which needs all firm members to club across groups)
        if (['group_enrollment', 'group_ledger', 'member_history', 'defaulters', 'winners', 'upcoming_pay'].includes(id)) {
          let q = withFirmScope(supabase.from('members').select('id, person_id, group_id, status, ticket_no, persons(name, phone)', { count: 'exact' }), targetId)
          if (id === 'defaulters') q = q.eq('status', 'defaulter')
          if (id === 'member_history') {
            // Unpaginated so all members and their multi-group memberships can be clubbed and selected
            queries.push(q)
          } else {
            queries.push(q.range(range[0], range[1]))
          }
        } else {
          queries.push(Promise.resolve({ data: [] }))
        }

        // 3. Auctions
        if (['pnl', 'cashflow', 'dividend', 'auction_insights', 'winners', 'upcoming_pay', 'group_ledger', 'member_history', 'group_enrollment', 'auction_sched', 'defaulters'].includes(id)) {
          let selectStr = 'id, group_id, month, winner_id, auction_discount, dividend, net_payout, payout_amount, is_payout_settled, payout_date, status, created_at'
          if (id === 'winners' || id === 'auction_insights') {
            selectStr += ', winners:winner_id(id, ticket_no, person_id, persons:person_id(id, name, phone))'
          }
          let q = withFirmScope(supabase.from('auctions').select(selectStr, { count: 'exact' }), targetId).order('month', { ascending: false })
          if (id === 'winners') q = q.not('winner_id', 'is', null)
          // Analytical aggregate reports (dividend, cashflow, pnl) need complete auction dataset
          if (['dividend', 'cashflow', 'pnl'].includes(id)) {
            queries.push(q)
          } else {
            queries.push(q.range(range[0], range[1]))
          }
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
        
        // Pick count from the primary table for this specific report
        let mainCount = 0
        if (id === 'winners' || id === 'auction_insights' || id === 'auction_sched' || id === 'dividend') {
          mainCount = results[2]?.count ?? 0 // auctions count
        } else if (['group_enrollment', 'defaulters'].includes(id)) {
          mainCount = results[1]?.count ?? 0 // members count
        } else if (['today_collection', 'cashflow', 'reconciliation'].includes(id)) {
          mainCount = results[3]?.count ?? 0 // payments count
        } else if (id === 'pnl') {
          mainCount = results[4]?.count ?? 0 // commissions count
        } else if (id === 'activity') {
          mainCount = results[6]?.count ?? 0 // activity logs count
        } else {
          mainCount = results[1]?.count ?? results[2]?.count ?? results[3]?.count ?? 0
        }
        setTotalRecords(mainCount)

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
      case 'cashflow': return <ReportCashFlow payments={data.payments} auctions={data.auctions} groups={data.groups} />
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
      case 'member_history': {
        // Group memberships by person so each person is listed once with all their enrolled groups
        const personMap = new Map<number, { person: any; groups: string[]; firstMemberId: number }>()
        data.members.forEach((m: any) => {
          const pId = m.person_id || m.id
          const grpName = data.groups.find((g: any) => g.id === m.group_id)?.name || 'Group'
          if (!personMap.has(pId)) {
            personMap.set(pId, {
              person: m.persons,
              groups: [grpName],
              firstMemberId: m.id
            })
          } else {
            const existing = personMap.get(pId)!
            if (!existing.groups.includes(grpName)) {
              existing.groups.push(grpName)
            }
          }
        })
        const uniquePersons = Array.from(personMap.entries()).sort((a, b) => {
          const nameA = (a[1].person?.name || '').trim().toLowerCase()
          const nameB = (b[1].person?.name || '').trim().toLowerCase()
          return nameA.localeCompare(nameB)
        })

        // Current selected person
        const currentSelected = uniquePersons.find(([_, info]) => String(info.firstMemberId) === String(selectedMemberId))?.[1]

        // Filtered list based on search term
        const query = memberSearch.trim().toLowerCase()
        const filteredPersons = uniquePersons.filter(([_, info]) => {
          if (!query) return true
          const name = (info.person?.name || '').toLowerCase()
          const phone = (info.person?.phone || '').toLowerCase()
          const groupsStr = info.groups.join(' ').toLowerCase()
          return name.includes(query) || phone.includes(query) || groupsStr.includes(query)
        })

        return (
          <div className="space-y-4">
            {/* Searchable Member Picker with Single Unified Input */}
            <div className="max-w-xl no-print relative">
              <label className="block text-xs font-bold uppercase tracking-wider text-[var(--text2)] mb-1.5 flex items-center justify-between">
                <span className="flex items-center gap-1.5">
                  <User size={13} className="text-[var(--accent)]" />
                  Select Member Statement
                </span>
                <span className="text-[11px] font-normal text-[var(--text3)] lowercase">
                  ({uniquePersons.length} members • A-Z)
                </span>
              </label>

              {/* Single Search & Selection Input */}
              <div className="relative">
                <div className="relative flex items-center">
                  <div className="absolute left-3.5 pointer-events-none text-[var(--text3)]">
                    <Search size={15} />
                  </div>
                  <input
                    type="text"
                    value={memberDropdownOpen ? memberSearch : (currentSelected ? `${currentSelected.person?.name || 'Member'} (${currentSelected.groups.length} ${currentSelected.groups.length === 1 ? 'group' : 'groups'})` : '')}
                    onFocus={() => {
                      setMemberDropdownOpen(true)
                      setMemberSearch('')
                    }}
                    onChange={e => {
                      setMemberSearch(e.target.value)
                      if (!memberDropdownOpen) setMemberDropdownOpen(true)
                    }}
                    placeholder="Search by member name, phone or chit group..."
                    className={`w-full pl-10 pr-20 py-2.5 text-sm rounded-xl border bg-[var(--surface)] text-[var(--text)] transition-all ${
                      memberDropdownOpen
                        ? 'border-[var(--accent)] ring-2 ring-[var(--accent)]/20 shadow-sm'
                        : 'border-[var(--border)] hover:border-slate-400'
                    }`}
                  />
                  <div className="absolute right-2.5 flex items-center gap-1">
                    {(selectedMemberId || memberSearch) && (
                      <button 
                        type="button"
                        onClick={() => {
                          setSelectedMemberId('')
                          setMemberSearch('')
                          setMemberDropdownOpen(false)
                        }}
                        className="p-1 rounded-full hover:bg-[var(--surface2)] text-[var(--text3)] hover:text-[var(--text)] transition-colors"
                        title="Clear selection"
                      >
                        <X size={14} />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setMemberDropdownOpen(prev => !prev)}
                      className="p-1 text-[var(--text3)] hover:text-[var(--text)] transition-colors"
                    >
                      <ChevronDown size={16} className={`transition-transform duration-200 ${memberDropdownOpen ? 'rotate-180' : ''}`} />
                    </button>
                  </div>
                </div>

                {/* Dropdown Options List */}
                {memberDropdownOpen && (
                  <>
                    <div 
                      className="fixed inset-0 z-40" 
                      onClick={() => setMemberDropdownOpen(false)}
                    />
                    <div 
                      className="absolute z-50 left-0 right-0 mt-1.5 bg-[var(--surface)] border border-[var(--border)] rounded-2xl shadow-xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-150 max-h-72 overflow-y-auto divide-y divide-[var(--border)]/50"
                    >
                      {filteredPersons.map(([pId, info]) => {
                        const isMatch = String(info.firstMemberId) === String(selectedMemberId)
                        return (
                          <div
                            key={pId}
                            onClick={() => {
                              setSelectedMemberId(String(info.firstMemberId))
                              setMemberDropdownOpen(false)
                              setMemberSearch('')
                            }}
                            className={`p-2.5 px-3.5 flex items-center justify-between cursor-pointer transition-colors ${
                              isMatch ? 'bg-[var(--accent)]/10 text-[var(--accent)]' : 'hover:bg-[var(--surface2)]'
                            }`}
                          >
                            <div className="min-w-0 flex-1 pr-2">
                              <div className="flex items-center gap-2">
                                <span className="font-bold text-sm text-[var(--text)] truncate">
                                  {info.person?.name || 'Member'}
                                </span>
                                {info.person?.phone && (
                                  <span className="text-[11px] text-[var(--text3)] font-mono">
                                    {info.person.phone}
                                  </span>
                                )}
                              </div>
                              <div className="text-[11px] text-[var(--text3)] flex items-center gap-1.5 mt-0.5 flex-wrap">
                                <span className="px-1.5 py-0.2 rounded bg-[var(--surface2)] border border-[var(--border)] font-semibold text-[10px] text-[var(--text2)]">
                                  {info.groups.length} {info.groups.length === 1 ? 'Group' : 'Groups'}
                                </span>
                                <span className="truncate text-slate-500">
                                  {info.groups.join(', ')}
                                </span>
                              </div>
                            </div>
                            {isMatch && (
                              <Check size={16} className="text-[var(--accent)] shrink-0 ml-2" />
                            )}
                          </div>
                        )
                      })}

                      {filteredPersons.length === 0 && (
                        <div className="p-6 text-center text-xs text-[var(--text3)]">
                          No members matching "{memberSearch}"
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            </div>

            {selectedMemberId && (
              <ReportMemberHistory 
                memberId={Number(selectedMemberId)} 
                members={data.members} 
                groups={data.groups} 
                payments={data.payments} 
                auctions={data.auctions} 
                firmName={firm?.name}
              />
            )}
          </div>
        )
      }
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
                      table = 'foreman_commissions'; exportCols = 'id, group_id, month, commission_amt, status, created_at, groups:group_id(name)'
                    } else if (['today_collection', 'cashflow', 'reconciliation'].includes(id)) {
                      table = 'payments'; exportCols = 'id, member_id, group_id, month, amount, mode, payment_date, created_at, members:member_id(ticket_no, persons:person_id(name)), groups:group_id(name)'
                    } else if (['group_enrollment', 'defaulters', 'member_history'].includes(id)) {
                      table = 'members'; exportCols = 'id, ticket_no, group_id, status, persons:person_id(name, phone, address), groups:group_id(name)'
                    } else if (id === 'winners') {
                      table = 'auctions'; exportCols = 'id, group_id, month, winner_id, auction_discount, dividend, net_payout, payout_amount, is_payout_settled, payout_date, status, created_at, winners:winner_id(ticket_no, persons:person_id(name)), groups:group_id(name)'
                    } else {
                      // Default to auctions for general insights
                      table = 'auctions'; exportCols = 'id, group_id, month, winner_id, auction_discount, dividend, net_payout, status, created_at, groups:group_id(name), winners:winner_id(persons:person_id(name))'
                    }

                    const q = withFirmScope(supabase.from(table).select(exportCols), targetId)
                    const { data: fullData } = await q
                    if (fullData) {
                      // Manual renaming for better headers, while downloadCSV handles the object flattening
                      const mapped = fullData.map((row: any) => {
                        const flat: any = { ...row }
                        if (row.groups) { flat.Group = row.groups.name; delete flat.groups }
                        if (row.members) {
                          flat.Member = row.members.persons?.name
                          flat.Ticket = row.members.ticket_no
                          delete flat.members
                        }
                        if (row.persons) {
                          flat.Name = row.persons.name
                          flat.Phone = row.persons.phone
                          flat.Address = row.persons.address
                          delete flat.persons
                        }
                        if (row.winners) {
                          flat.Winner = row.winners.persons?.name
                          flat.Ticket = row.winners.ticket_no
                          delete flat.winners
                        }
                        if (row.metadata && typeof row.metadata === 'object') {
                          flat.Metadata = JSON.stringify(row.metadata)
                          delete flat.metadata
                        }
                        return flat
                      })
                      downloadCSV(mapped, `chitvault-report-${id}-${getToday()}.csv`)
                    }
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

        {/* Only show global pagination on raw transactional lists that need pagination controls */}
        {['today_collection', 'winners', 'defaulters', 'group_enrollment', 'reconciliation', 'activity', 'upcoming_pay'].includes(id) && totalRecords > pageSize && (
          <Pagination 
            current={page} 
            total={totalRecords} 
            pageSize={pageSize} 
            onPageChange={setPage} 
            onPageSizeChange={(s) => { setPageSize(s); setPage(1) }} 
          />
        )}
      </div>
    </div>
  )
}
