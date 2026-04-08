'use client'

import { useEffect, useState, useMemo, Suspense } from 'react'
import { useSearchParams } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'
import { useFirm } from '@/lib/firm/context'
import { fmt, fmtDate, fmtMonth, getToday, cn } from '@/lib/utils'
import { downloadCSV } from '@/lib/utils/csv'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge, Loading, Btn, Card, Field } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { useI18n } from '@/lib/i18n/context'
import { Printer, ChevronLeft, Calendar, DollarSign, Users, FileText, CheckCircle, AlertTriangle, TrendingUp, History, Clock, FileSpreadsheet } from 'lucide-react'
import { withFirmScope } from '@/lib/supabase/firmQuery'
import { useTerminology } from '@/lib/hooks/useTerminology'
import type { Group, Member, Auction, Payment, ForemanCommission, Firm } from '@/types'


export default function ReportsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <ReportsPageContent />
    </Suspense>
  )
}

function ReportsPageContent() {
  const supabase = createClient()
  const { firm, role, switchedFirmId } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  
  const REPORTS = useMemo(() => [
    { id: 'today_collection', category: t('cat_financial'), title: t('report_today_title'), desc: t('report_today_desc'), icon: History },
    { id: 'pnl', category: t('cat_financial'), title: 'Firm Income (P&L)', desc: 'Summary of company commissions and revenue', icon: DollarSign },
    { id: 'cashflow', category: t('cat_financial'), title: t('report_cashflow_title'), desc: t('report_cashflow_desc'), icon: TrendingUp },
    { id: 'dividend', category: t('cat_financial'), title: term.isAccOnly ? 'Surplus Accumulation' : term.isDivOnly ? t('report_dividend_title') : 'Member Benefit Analysis', desc: t('report_dividend_desc'), icon: TrendingUp },
    
    { id: 'upcoming_pay', category: t('cat_operational'), title: t('report_upcoming_title'), desc: t('report_upcoming_desc'), icon: Calendar },
    { id: 'group_enrollment', category: t('cat_operational'), title: t('report_enrollment_title'), desc: t('report_enrollment_desc'), icon: Users },
    { id: 'auction_sched', category: t('cat_operational'), title: t('report_auction_sched_title'), desc: t('report_auction_sched_desc'), icon: Calendar },
    { id: 'group_ledger', category: t('cat_operational'), title: t('report_group_ledger_title'), desc: t('report_group_ledger_desc'), icon: FileText },
    
    { id: 'member_history', category: t('cat_member'), title: t('report_member_history_title'), desc: t('report_member_history_desc'), icon: Users },
    { id: 'defaulters', category: t('cat_member'), title: t('report_defaulters_title'), desc: t('report_defaulters_desc'), icon: AlertTriangle },
    { id: 'winners', category: t('cat_member'), title: t('report_winners_title'), desc: t('report_winners_desc'), icon: CheckCircle },
    
    { id: 'reconciliation', category: t('cat_audit'), title: t('report_reconciliation_title'), desc: t('report_reconciliation_desc'), icon: FileText },
    { id: 'activity', category: t('cat_audit'), title: t('report_activity_title'), desc: t('report_activity_desc'), icon: History },
  ], [t])
  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
  const [denominations, setDenominations] = useState<any[]>([])
  const [activityLogs, setActivityLogs] = useState<any[]>([])
  const [profiles,     setProfiles]    = useState<any[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [activeReport, setActiveReport] = useState<string | null>(null)
  
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')

  const [firms,    setFirms]    = useState<Firm[]>([])
  const [winnerFilter, setWinnerFilter] = useState<'all'|'pending'|'settled'>('all')
  const isSuper = role === 'superadmin'
  const targetId = isSuper ? switchedFirmId : firm?.id

  const [timeFilter, setTimeFilter] = useState<string>('all')

  const { filteredAuctions, filteredPayments, filteredCommissions, filteredLogs } = useMemo(() => {
    const confirmedAuctions = auctions.filter(a => a.status === 'confirmed')
    const confirmedComms = commissions.filter(c => c.status === 'confirmed')

    if (timeFilter === 'all') {
      return { 
        filteredAuctions: confirmedAuctions, 
        filteredPayments: payments, 
        filteredCommissions: confirmedComms, 
        filteredLogs: activityLogs 
      }
    }

    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() 
    
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1
    
    let startD = new Date(fyStartYear, 3, 1) // Apr 1
    let endD = new Date(fyStartYear + 1, 3, 0) // Mar 31

    if (timeFilter === 'q1') { startD = new Date(fyStartYear, 3, 1); endD = new Date(fyStartYear, 6, 0) } 
    else if (timeFilter === 'q2') { startD = new Date(fyStartYear, 6, 1); endD = new Date(fyStartYear, 9, 0) } 
    else if (timeFilter === 'q3') { startD = new Date(fyStartYear, 9, 1); endD = new Date(fyStartYear, 12, 0) } 
    else if (timeFilter === 'q4') { startD = new Date(fyStartYear + 1, 0, 1); endD = new Date(fyStartYear + 1, 3, 0) } 
    else if (timeFilter === 'month') { startD = new Date(currentYear, currentMonth, 1); endD = new Date(currentYear, currentMonth + 1, 0) }
    
    const toLocalStr = (d: Date) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
    const s = toLocalStr(startD)
    
    endD.setDate(endD.getDate() + 1)
    const e = toLocalStr(endD)

    const isBetween = (d: string | null) => d ? ((d.substring(0, 10) >= s) && (d.substring(0, 10) < e)) : false

    return {
      filteredAuctions: confirmedAuctions.filter(a => isBetween(a.auction_date || a.created_at)),
      filteredPayments: payments.filter(p => isBetween(p.payment_date || p.created_at)),
      filteredCommissions: confirmedComms.filter(c => isBetween(c.created_at)),
      filteredLogs: activityLogs.filter(l => isBetween(l.created_at))
    }
  }, [auctions, commissions, payments, activityLogs, timeFilter])

  const searchParams = useSearchParams()

  useEffect(() => {
    const type = searchParams.get('type')
    const mid = searchParams.get('member_id')
    if (type) setActiveReport(type)
    if (mid) setSelectedMemberId(mid || '')
  }, [searchParams])

  useEffect(() => {
    async function load() {
      try {
        if (groups.length === 0) setLoading(true)
        setError(null)
        
        const res = await Promise.all([
          withFirmScope(supabase.from('groups').select('*'), targetId).order('name'),
          withFirmScope(supabase.from('members').select('*, persons(*)'), targetId),
          withFirmScope(supabase.from('auctions').select('*'), targetId).order('month', { ascending: false }),
          withFirmScope(supabase.from('payments').select('*'), targetId).order('payment_date', { ascending: false }),
          withFirmScope(supabase.from('foreman_commissions').select('*'), targetId).order('month'),
          withFirmScope(supabase.from('denominations').select('*'), targetId).order('entry_date', { ascending: false }),
          withFirmScope(supabase.from('activity_logs').select('*'), targetId).order('created_at', { ascending: false }),
          withFirmScope(supabase.from('profiles').select('id, full_name'), targetId),
        ])

        res.forEach((r, i) => { if (r.error) throw new Error(`Query ${i} failed: ${r.error.message}`) })

        setGroups(res[0].data as Group[] || [])
        setMembers((res[1].data as Member[] || []).sort((a, b) => (a.persons?.name || '').localeCompare(b.persons?.name || '')))
        setAuctions(res[2].data as Auction[] || [])
        setPayments(res[3].data as Payment[] || [])
        setCommissions(res[4].data as ForemanCommission[] || [])
        setDenominations(res[5].data || [])
        setActivityLogs(res[6].data || [])
        setProfiles(res[7].data || [])

        if (isSuper && firms.length === 0) {
          const { data: f } = await supabase.from('firms').select('*').order('name')
          setFirms(f || [])
        }
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase, isSuper, switchedFirmId, firm, firms.length, searchParams])

  const handleExportCSV = () => {
    if (!activeReport) return
    let csvData: any[] = []
    const reportTitle = REPORTS.find(r => r.id === activeReport)?.title || 'report'

    switch(activeReport) {
      case 'today_collection':
        const todayStr = getToday()
        csvData = payments.filter(p => p.payment_date === todayStr).map(p => {
          const m = members.find(x => x.id === p.member_id)
          const g = groups.find(x => x.id === p.group_id)
          return {
            Time: new Date(p.created_at).toLocaleTimeString(),
            Member: m?.persons?.name,
            Group: g?.name,
            Mode: p.mode,
            Amount: p.amount
          }
        })
        break
      case 'pnl':
        csvData = [
          { Category: 'Income', Description: 'Foreman Commissions', Amount: filteredCommissions.reduce((sum, c) => sum + Number(c.commission_amt), 0) },
          { Category: 'Expense', Description: 'Operational Costs (Est)', Amount: 0 },
          { Category: 'Net Profit', Description: 'Total Surplus', Amount: filteredCommissions.reduce((sum, c) => sum + Number(c.commission_amt), 0) }
        ]
        break
      case 'winners':
        csvData = filteredAuctions.filter(a => a.winner_id != null).map(a => {
          const m = members.find(x => x.id === a.winner_id)
          const g = groups.find(x => x.id === a.group_id)
          return {
            'Auction Date': fmtDate(a.auction_date || a.created_at),
            'Group': g?.name,
            'Month': fmtMonth(a.month, g?.start_date),
            'Winner': m?.persons?.name,
            'Auction Discount': a.auction_discount,
            'Dividend': a.dividend,
            'Net Payout': a.net_payout || a.auction_discount,
            'Settled': a.is_payout_settled ? 'Yes' : 'No',
            'Settled Date': a.is_payout_settled ? fmtDate(a.payout_date) : 'N/A'
          }
        })
        break
      case 'defaulters':
        csvData = members.filter(m => {
          const g = groups.find(x => x.id === m.group_id)
          if (!g) return false
          const paid = filteredPayments.filter(p => p.member_id === m.id).reduce((sum, p) => sum + Number(p.amount), 0)
          const expected = (g.monthly_contribution * Math.min(g.duration, 5)) 
          return paid < expected
        }).map(m => {
          const g = groups.find(x => x.id === m.group_id)
          return {
            Member: m.persons?.name,
            Phone: m.persons?.phone,
            Group: g?.name,
            'Ticket No': m.ticket_no,
            Status: m.status
          }
        })
        break
      case 'group_enrollment':
        if (!selectedGroupId) { alert('Please select a group first'); return }
        const grp = groups.find(g => g.id === Number(selectedGroupId))
        const grpMems = members.filter(m => m.group_id === Number(selectedGroupId))
        const clubMapCsv = new Map<number, any>()
        grpMems.forEach(m => {
          const auc = filteredAuctions.find(a => a.group_id === m.group_id && a.winner_id === m.id)
          if (!clubMapCsv.has(m.person_id)) {
            clubMapCsv.set(m.person_id, { 
              name: m.persons?.name, 
              nickname: m.persons?.nickname || '', 
              phone: m.persons?.phone || '', 
              winning: auc ? [m.ticket_no] : [],
              wonMonths: auc ? [fmtMonth(auc.month, grp?.start_date)] : [],
              pending: !auc ? [m.ticket_no] : []
            })
          } else {
            const node = clubMapCsv.get(m.person_id)
            if (auc) {
              node.winning.push(m.ticket_no)
              node.wonMonths.push(fmtMonth(auc.month, grp?.start_date))
            } else {
              node.pending.push(m.ticket_no)
            }
          }
        })

        csvData = Array.from(clubMapCsv.values()).map(p => ({
          Member: p.name,
          Nickname: p.nickname,
          Phone: p.phone,
          'Total Tickets': p.winning.length + p.pending.length,
          'Winning Tickets': p.winning.sort((a:number,b:number)=>a-b).map((t:number)=>`#${t}`).join(', ') || 'None',
          'Won Months': p.wonMonths.join(', ') || '—',
          'Pending Tickets': p.pending.sort((a:number,b:number)=>a-b).map((t:number)=>`#${t}`).join(', ') || 'None'
        }))
        break
      case 'activity':
        csvData = activityLogs.map(l => ({
          Time: new Date(l.created_at).toLocaleString(),
          User: profiles.find(p => p.id === l.user_id)?.full_name || 'System',
          Action: l.action,
          Entity: l.entity_type,
          Details: JSON.stringify(l.metadata)
        }))
        break
    }

    if (csvData.length > 0) {
      downloadCSV(csvData, reportTitle.toLowerCase().replace(/\s+/g, '_'))
    } else {
      alert('This report is currently not exportable or has no data.')
    }
  }

  if (loading) return <Loading />
  if (error) return <div className="p-4 rounded-lg bg-danger-100 text-danger-700">Error: {error}</div>

  const renderActiveReport = () => {
    switch (activeReport) {
      case 'today_collection': return <ReportTodayCollection payments={payments} members={members} groups={groups} />
      case 'reconciliation': return <ReportReconciliation payments={payments} denominations={denominations} />
      case 'activity': return <ReportActivityLog logs={filteredLogs} profiles={profiles} />
      case 'pnl': return <ReportPNL groups={groups} commissions={filteredCommissions} />
      case 'cashflow': return <ReportCashFlow payments={filteredPayments} auctions={filteredAuctions} />
      case 'dividend': return <ReportMemberBenefits groups={groups} auctions={filteredAuctions} />
      case 'upcoming_pay': return <ReportUpcomingPay groups={groups} members={members} auctions={filteredAuctions} payments={filteredPayments} />
      case 'auction_sched': return <ReportAuctionSched groups={groups} auctions={filteredAuctions} />
      case 'group_ledger': return (
        <div>
           <Field label="Select Group" className="mb-4 max-w-sm">
            <select className={inputClass} style={inputStyle} value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
              <option value="">-- Choose Group --</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          {selectedGroupId && <ReportGroupLedger groups={groups} groupId={Number(selectedGroupId)} members={members} auctions={filteredAuctions} payments={filteredPayments} />}
        </div>
      )
      case 'member_history': return (
        <div>
           <Field label="Select Member" className="mb-4 max-w-sm">
            <select className={inputClass} style={inputStyle} value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)}>
              <option value="">-- Choose Member --</option>
              {members.filter(m => m.status !== 'exited').map(m => <option key={m.id} value={m.id}>{m.persons?.name} ({groups.find(g=>g.id===m.group_id)?.name})</option>)}
            </select>
          </Field>
          {selectedMemberId && <ReportMemberHistory memberId={Number(selectedMemberId)} members={members} groups={groups} payments={filteredPayments} auctions={filteredAuctions} />}
        </div>
      )
      case 'defaulters': return <ReportDefaulters members={members} groups={groups} auctions={filteredAuctions} />
      case 'winners': return <ReportWinners auctions={filteredAuctions} groups={groups} members={members} filter={winnerFilter} onFilterChange={setWinnerFilter} />
      case 'group_enrollment': return (
        <div>
           <Field label="Select Group" className="mb-4 max-w-sm no-print">
            <select className={inputClass} style={inputStyle} value={selectedGroupId} onChange={(e) => setSelectedGroupId(e.target.value)}>
              <option value="">-- Choose Group --</option>
              {groups.map(g => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
          {selectedGroupId && <ReportGroupEnrollment groupId={Number(selectedGroupId)} members={members} groups={groups} auctions={filteredAuctions} />}
        </div>
      )
      default: return (
        <div className="p-12 text-center bg-[var(--surface2)] rounded-[32px] border border-dashed border-[var(--border)]">
          <AlertTriangle size={48} className="mx-auto mb-4 opacity-20" />
          <h2 className="text-xl font-bold mb-2">Report Not Found</h2>
          <p className="text-sm opacity-50 mb-6">The report you are looking for does not exist or has been archived.</p>
          <Btn onClick={() => setActiveReport(null)}>Return to Hub</Btn>
        </div>
      )
    }
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          @page { margin: 1cm; size: portrait; }
          body > #__next > div > main > div > :not(.printable) { display: none; }
          .printable { width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .card-title { font-size: 1.2rem !important; }
          table { width: 100% !important; border-collapse: collapse !important; }
          th, td { padding: 4px 8px !important; font-size: 11px !important; border-bottom: 1px solid #333 !important; }
          .badge { border: 1px solid #000 !important; }
        }
      `}</style>

      {/* Hub View */}
      {!activeReport && (
        <div className="printable">
          <div className="flex justify-between items-center mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <h1 className="text-2xl font-bold">{t('reports_hub')}</h1>
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>{t('date_filter')}:</label>
              <select className={inputClass} style={{ ...inputStyle, width: 'auto', padding: '6px 12px' }} value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                <option value="all">{t('all_time')}</option>
                <option value="fy">{t('financial_year') || 'Financial Year'}</option>
                <option value="q1">Q1 (Apr - Jun)</option>
                <option value="q2">Q2 (Jul - Sep)</option>
                <option value="q3">Q3 (Oct - Dec)</option>
                <option value="q4">Q4 (Jan - Mar)</option>
                <option value="month">Current Month</option>
              </select>
            </div>
          </div>
          {Array.from(new Set(REPORTS.map(r => r.category))).map(category => (
            <div key={category} className="mb-8">
              <h2 className="text-lg font-semibold mb-3 px-1 border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                {category} {t('reports_suffix')}
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {REPORTS.filter(r => r.category === category).map(report => {
                  const Icon = report.icon
                  return (
                    <div key={report.id} onClick={() => setActiveReport(report.id)}
                      className="p-5 rounded-2xl border cursor-pointer hover:shadow-md transition-all group"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg" style={{ background: 'var(--accent-dim)', color: 'var(--accent)' }}>
                          <Icon size={18} />
                        </div>
                        <h3 className="font-semibold" style={{ color: 'var(--text)' }}>{report.title}</h3>
                      </div>
                      <p className="text-sm" style={{ color: 'var(--text2)' }}>{report.desc}</p>
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Active Report View */}
      {activeReport && (
        <div className="printable space-y-5">
          <div className="flex items-center justify-between no-print mb-4 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <div className="flex flex-col">
               <button onClick={() => { setActiveReport(null); setSelectedGroupId(''); setSelectedMemberId('') }} className="flex items-center gap-1 text-sm font-medium mb-1 hover:underline" style={{ color: 'var(--text3)' }}>
                 <ChevronLeft size={14} /> Back to Reports
               </button>
               <h1 className="text-2xl font-bold flex items-center gap-2">
                 {REPORTS.find(r => r.id === activeReport)?.title}
               </h1>
            </div>
            
            <div className="flex items-center gap-4">
                <div className="flex items-center gap-2">
                  <label className="text-[10px] font-bold uppercase tracking-wider opacity-50">{t('date_filter')}:</label>
                  <select 
                    className={inputClass} 
                    style={{ ...inputStyle, width: 'auto', padding: '4px 10px', fontSize: '12px' }} 
                    value={timeFilter} 
                    onChange={(e) => setTimeFilter(e.target.value)}
                  >
                    <option value="all">{t('all_time')}</option>
                    <option value="fy">{t('financial_year') || 'Financial Year'}</option>
                    <option value="q1">Q1 (Apr - Jun)</option>
                    <option value="q2">Q2 (Jul - Sep)</option>
                    <option value="q3">Q3 (Oct - Dec)</option>
                    <option value="q4">Q4 (Jan - Mar)</option>
                    <option value="month">Current Month</option>
                  </select>
                </div>

                <div className="flex items-center gap-2 border-l pl-4" style={{ borderColor: 'var(--border)' }}>
                   <Btn variant="secondary" onClick={handleExportCSV} icon={FileSpreadsheet} title="Export to CSV">CSV</Btn>
                   <Btn variant="secondary" onClick={() => window.print()} icon={Printer} title="Print Report">Print</Btn>
                </div>
            </div>
          </div>
          {renderActiveReport()}
        </div>
      )}
    </div>
  )
}

// ── Individual Report Components ──────────────────────────────────────────────────────────

function ReportPNL({ groups, commissions }: { groups: Group[], commissions: ForemanCommission[] }) {
  const { firm } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  
  const totalIncome = commissions.reduce((s, c) => s + Number(c.commission_amt), 0)
  
  // Calculate potential revenue: sum up what SHOULD have been collected so far vs total projectable
  const potentialTotal = groups.reduce((sum, g) => {
    // Current realized:
    const realized = commissions.filter(c => c.group_id === g.id).reduce((s, c) => s + Number(c.commission_amt), 0)
    // Projected remaining (simplified: based on remaining duration and the same commission rate)
    const confirmedCount = commissions.filter(c => c.group_id === g.id).length
    const remaining = Math.max(0, g.duration - confirmedCount)
    const avgComm = confirmedCount > 0 ? (realized / confirmedCount) : (g.commission_type === 'percent_of_chit' ? (g.chit_value * g.commission_value / 100) : g.commission_value)
    return sum + realized + (remaining * avgComm)
  }, 0)

  const efficiency = potentialTotal > 0 ? (totalIncome / potentialTotal * 100) : 100

  return (
    <>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
        <StatCard label="Realized Firm Income" value={fmt(totalIncome)} color="success" />
        <StatCard label="Full Cycle Projection" value={fmt(potentialTotal)} color="info" />
        <StatCard label="Realization Rate" value={Math.round(efficiency) + '%'} color="accent" />
      </div>

      <TableCard 
        title={term.isAccOnly ? 'Firm Revenue Statement' : t('report_pnl_title')}
        subtitle="Detailed breakdown of commissions earned across all active and completed cycles.">
        <Table>
          <thead>
            <tr>
              <Th>{t('group_name')}</Th>
              <Th className="hidden md:table-cell">Config / Rate</Th>
              <Th right>Realized Income</Th>
              <Th right className="hidden lg:table-cell">Monthly Avg</Th>
              <Th right className="hidden sm:table-cell">Status</Th>
            </tr>
          </thead>
          <tbody>
            {groups.map(g => {
              const groupComms = commissions.filter(c => c.group_id === g.id)
              const inc = groupComms.reduce((s, c) => s + Number(c.commission_amt), 0)
              const avg = groupComms.length > 0 ? inc / groupComms.length : 0
              return (
                <Tr key={g.id}>
                  <Td>
                    <div className="font-bold text-[var(--text)]">{g.name}</div>
                    <div className="text-[10px] opacity-40 uppercase tracking-widest font-black">{g.auction_scheme}</div>
                  </Td>
                  <Td className="hidden md:table-cell">
                    <div className="text-xs font-medium opacity-60">
                      {g.commission_type === 'percent_of_chit' ? `${g.commission_value}% of Chit` : g.commission_type === 'percent_of_discount' ? `${g.commission_value}% of Bid` : `Fixed ₹${g.commission_value}`}
                    </div>
                  </Td>
                  <Td right className="font-black text-[var(--success)]">{fmt(inc)}</Td>
                  <Td right className="hidden lg:table-cell font-mono text-xs opacity-60">{fmt(avg)}</Td>
                  <Td right className="hidden sm:table-cell">
                     <Badge variant={inc > 0 ? 'info' : 'gray'}>
                        {groupComms.length} / {g.duration} Cycles
                     </Badge>
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </TableCard>
    </>
  )
}

function ReportCashFlow({ payments, auctions }: { payments: Payment[], auctions: Auction[] }) {
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0)
  const totalPaidOut = auctions.reduce((s, a) => s + Number(a.net_payout || a.payout_amount || 0), 0)
  const netFlow = totalCollected - totalPaidOut

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard label="Total Inflow (Collections)" value={fmt(totalCollected)} color="success" />
        <StatCard label="Total Outflow (Net Payouts)" value={fmt(totalPaidOut)} color="danger" />
        <StatCard label="Net Cash Flow" value={fmt(netFlow)} color={netFlow >= 0 ? 'success' : 'danger'} />
      </div>
      <div className="p-4 rounded-xl border mb-5 text-sm" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
        Cash flow represents the liquid money collected from members versus the actual net payouts handed to winners. 
      </div>
    </>
  )
}

function ReportMemberBenefits({ groups, auctions }: { groups: Group[], auctions: Auction[] }) {
  const { firm } = useFirm()
  const { t } = useI18n()
  const term = useTerminology(firm)
  
  const accGroups = groups.filter(g => g.auction_scheme === 'ACCUMULATION')
  const divGroups = groups.filter(g => g.auction_scheme === 'DIVIDEND')

  const totalWealth = auctions.filter(a => a.status === 'confirmed').reduce((s, a) => s + Number(a.dividend || a.auction_discount || 0), 0)

  return (
    <div className="space-y-8">
      <div className="grid grid-cols-1 gap-4 mb-4">
         <StatCard 
            label="Total Wealth Created (Realized Benefits)" 
            value={fmt(totalWealth)} 
            color="success" 
            sub="Total discount surplus and dividends distributed back to members across all schemes."
         />
      </div>

      {(accGroups.length > 0) && (
        <TableCard title="Surplus Accumulation Analysis" subtitle="Total value added back to the pool for members. Best for high-savings groups.">
          <Table>
            <thead>
              <tr>
                <Th>{t('group_name')}</Th>
                <Th>Auctions</Th>
                <Th right>Total Surplus</Th>
                <Th right className="hidden md:table-cell">Avg Month</Th>
                <Th right>Effective ROI</Th>
              </tr>
            </thead>
            <tbody>
              {accGroups.map(g => {
                const aucs = auctions.filter(a => a.group_id === g.id && a.status === 'confirmed')
                const totalBenefit = aucs.reduce((s, a) => s + Number(a.auction_discount || 0), 0)
                const avg = aucs.length > 0 ? totalBenefit / aucs.length : 0
                
                // ROI approximation: Benefit vs Total Paid Into the group
                const totalMemberPayments = aucs.length * g.num_members * g.monthly_contribution
                const roi = totalMemberPayments > 0 ? (totalBenefit / totalMemberPayments * 100) : 0

                return (
                  <Tr key={g.id}>
                    <Td>
                      <div className="font-bold">{g.name}</div>
                      <div className="text-[9px] opacity-40 font-mono italic">VALUE: {fmt(g.chit_value)}</div>
                    </Td>
                    <Td><Badge variant="gray">{aucs.length} / {g.duration}</Badge></Td>
                    <Td right className="font-black text-[var(--accent)]">{fmt(totalBenefit)}</Td>
                    <Td right className="hidden md:table-cell opacity-50 text-xs font-mono">{fmt(avg)}</Td>
                    <Td right>
                       <div className="font-black text-xs text-[var(--info)]">{roi.toFixed(2)}%</div>
                       <div className="text-[8px] opacity-30 uppercase font-black">Group ROI</div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </TableCard>
      )}

      {(divGroups.length > 0) && (
        <TableCard title="Dividend Performance Analysis" subtitle="Total discounts distributed to members each month. Standard conventional model.">
          <Table>
            <thead>
              <tr>
                <Th>{t('group_name')}</Th>
                <Th>Auctions</Th>
                <Th right>Total Dividends</Th>
                <Th right className="hidden md:table-cell">Avg Dividend</Th>
                <Th right>Member ROI</Th>
              </tr>
            </thead>
            <tbody>
              {divGroups.map(g => {
                const aucs = auctions.filter(a => a.group_id === g.id && a.status === 'confirmed')
                const totalBenefit = aucs.reduce((s, a) => s + Number(a.dividend || 0), 0)
                const avg = aucs.length > 0 ? totalBenefit / aucs.length : 0

                // ROI for Dividend: Benefit vs Total Paid
                const totalPaid = aucs.length * g.num_members * g.monthly_contribution
                const roi = totalPaid > 0 ? (totalBenefit / totalPaid * 100) : 0

                return (
                  <Tr key={g.id}>
                    <Td>
                       <div className="font-bold">{g.name}</div>
                       <div className="text-[9px] opacity-40 font-mono italic">VALUE: {fmt(g.chit_value)}</div>
                    </Td>
                    <Td><Badge variant="gray">{aucs.length} / {g.duration}</Badge></Td>
                    <Td right className="font-black text-[var(--success)]">{fmt(totalBenefit)}</Td>
                    <Td right className="hidden md:table-cell opacity-50 text-xs font-mono">{fmt(avg)}</Td>
                    <Td right>
                       <div className="font-black text-xs text-[var(--info)]">{roi.toFixed(2)}%</div>
                       <div className="text-[8px] opacity-30 uppercase font-black">Yield %</div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </TableCard>
      )}
    </div>
  )
}

function ReportUpcomingPay({ groups, members, auctions, payments }: any) {
  // 1. Calculate balances for each membership (member)
  const balances = members.map((member: Member) => {
    const group = groups.find((g: Group) => g.id === member.group_id)
    if (!group || group.status === 'archived' || !['active', 'defaulter', 'foreman'].includes(member.status)) return null

    const isAcc = group.auction_scheme === 'ACCUMULATION'
    const groupAuctions = auctions.filter((a: Auction) => a.group_id === member.group_id && a.status === 'confirmed')
    const latestMonth = groupAuctions.length
    const nextDate = new Date(group.start_date || getToday())
    nextDate.setMonth(nextDate.getMonth() + latestMonth)
    const isDueNow = new Date() >= nextDate
    const currentMonth = Math.min(group.duration, isDueNow ? latestMonth + 1 : latestMonth)
    
    const memberPayments = payments.filter((p: Payment) => p.member_id === member.id)
    let mTotalDue = 0
    const mPending: any[] = []

    for (let month = 1; month <= currentMonth; month++) {
      const prevMonthAuc = groupAuctions.find((a: Auction) => a.month === month - 1)
      const div = (isAcc || !prevMonthAuc) ? 0 : Number(prevMonthAuc.dividend || 0)
      const due = Number(group.monthly_contribution) - div
      const paid = memberPayments.filter((p: Payment) => p.month === month).reduce((s: number, p: Payment) => s + Number(p.amount), 0)
      
      mTotalDue += due
      const bal = Math.max(0, due - paid)

      if (bal > 0.01) {
        mPending.push({ month, amount: bal })
      }
    }

    const mTotalPaid = memberPayments.reduce((s: number, p: Payment) => s + Number(p.amount), 0)
    const mOutstanding = Math.max(0, mTotalDue - mTotalPaid)
    const isWinner = auctions.some((a: Auction) => a.winner_id === member.id)

    if (mOutstanding > 0) return { member, group, mOutstanding, mPending, isWinner }
    return null
  }).filter(Boolean)

  // 2. Group by Person
  const personMap = new Map<number, any>()
  balances.forEach((item: any) => {
    const pId = item.member.person_id
    if (!personMap.has(pId)) {
      personMap.set(pId, { person: item.member.persons, total: 0, items: [] })
    }
    const pData = personMap.get(pId)
    pData.total += item.mOutstanding
    pData.items.push(item)
  })

  const personReport = Array.from(personMap.values()).sort((a, b) => b.total - a.total)
  const grandTotal = personReport.reduce((s, p) => s + p.total, 0)

  return (
    <TableCard title="Consolidated Pending Collections (By Person)" subtitle={fmt(grandTotal) + " total collection needed"}>
      <Table>
        <thead><tr><Th>Person / Contact</Th><Th>Group Breakdown</Th><Th right>Total Outstanding</Th></tr></thead>
        <tbody>
          {personReport.length === 0 && <Tr><Td colSpan={3} className="text-center py-5">All collections are up to date! ✅</Td></Tr>}
          {personReport.map((pData: any) => (
            <Tr key={pData.person.id}>
              <Td>
                <div className="font-bold text-lg">{pData.person.name}</div>
                <div className="text-xs opacity-50 flex items-center gap-2">
                   <span className="font-mono font-bold text-[var(--info)]">{pData.person.phone}</span>
                   {pData.person.address && <span className="truncate max-w-[150px]">· {pData.person.address}</span>}
                </div>
              </Td>
              <Td>
                <div className="space-y-2">
                  {pData.items.map((item: any) => (
                    <div key={item.member.id} className="text-[11px] flex justify-between gap-10 bg-[var(--surface2)] p-1.5 rounded-lg">
                      <span>
                        <span className="font-bold">{item.group.name}</span>
                        {item.isWinner && <span className="ml-1 text-accent" title="Winner">👑</span>}
                        <span className="mx-2 opacity-30">|</span>
                        {item.mPending.map((m: any) => (
                           <Badge key={m.month} variant="gray" className="mr-0.5 text-[8px]">{fmtMonth(m.month, item.group.start_date)}</Badge>
                        ))}
                      </span>
                      <span className="font-mono font-bold opacity-70">{fmt(item.mOutstanding)}</span>
                    </div>
                  ))}
                </div>
              </Td>
              <Td right>
                <div className="text-xl font-black text-[var(--danger)]">{fmt(pData.total)}</div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportAuctionSched({ groups, auctions }: { groups: Group[], auctions: Auction[] }) {
  const activeGroups = groups.filter(g => g.status === 'active')
  
  return (
    <TableCard title="Upcoming Auction Schedule">
      <Table>
        <thead><tr><Th>Group</Th><Th>Total Duration</Th><Th>Completed Auctions</Th><Th>Next Auction Month</Th><Th>Status</Th></tr></thead>
        <tbody>
          {activeGroups.map(g => {
            const aucs = auctions.filter(a => a.group_id === g.id)
            const completed = aucs.length
            const isCompleted = completed >= g.duration
            return (
              <Tr key={g.id}>
                <Td className="font-semibold">{g.name}</Td>
                <Td>{g.duration} Months</Td>
                <Td>{completed}</Td>
                <Td>
                  {!isCompleted ? <span className="font-bold">{fmtMonth(completed + 1, g.start_date)}</span> : '—'}
                </Td>
                <Td>
                  {isCompleted ? <Badge variant="success">Finished</Badge> : <Badge variant="info">Ongoing</Badge>}
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportGroupLedger({ groups, groupId, members, auctions, payments }: { groups: Group[], groupId: number, members: Member[], auctions: Auction[], payments: Payment[] }) {
  const { firm } = useFirm()
  const term = useTerminology(firm)
  const grpAuctions = auctions.filter(a => a.group_id === groupId).sort((a,b) => a.month - b.month)
  const grpPayments = payments.filter(p => p.group_id === groupId)
  const g = groups.find(x => x.id === groupId)
  const isAcc = g?.auction_scheme === 'ACCUMULATION'
  
  return (
    <TableCard title="Group Ledger (Summary per month)">
      <Table>
        <thead>
          <tr>
            <Th>Month</Th>
            <Th>Winner</Th>
            <Th right>Winner Payout (Bid)</Th>
            <Th right>{term.auctionBenefitLabel}</Th>
            <Th right>Total Collections</Th>
          </tr>
        </thead>
        <tbody>
          {grpAuctions.map(auc => {
            const w = members.find(m => m.id === auc.winner_id)
            const monthPayments = grpPayments.filter(p => p.month === auc.month).reduce((s,p) => s + Number(p.amount), 0)
            return (
              <Tr key={auc.month}>
                <Td><Badge variant="gray">{fmtMonth(auc.month, groups.find(gx=>gx.id===groupId)?.start_date)}</Badge></Td>
                <Td>{w ? `👑 ${w.persons?.name || 'Member'}` : '—'}</Td>
                <Td right style={{ color: 'var(--danger)' }}>{fmt(auc.auction_discount)}</Td>
                <Td right style={{ color: 'var(--accent)' }}>{fmt(auc.dividend)}</Td>
                <Td right style={{ color: 'var(--success)' }}>{fmt(monthPayments)}</Td>
              </Tr>
            )
          })}
          {grpAuctions.length === 0 && <Tr><Td colSpan={5} className="text-center py-5">No auctions recorded for this group.</Td></Tr>}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportMemberHistory({ memberId, members, groups, payments, auctions }: { memberId: number, members: Member[], groups: Group[], payments: Payment[], auctions: Auction[] }) {
  const member = members.find(m => m.id === memberId)
  const group = groups.find(g => g.id === member?.group_id)
  const memPayments = payments.filter(p => p.member_id === memberId).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  const totalPaid = memPayments.reduce((s, p) => s + Number(p.amount), 0)
  const isAcc = group?.auction_scheme === 'ACCUMULATION'
  const groupAuctions = auctions.filter(a => a.group_id === group?.id && a.status === 'confirmed')
  const latestMonth = groupAuctions.length
  const nextDate = new Date(group?.start_date || getToday())
  nextDate.setMonth(nextDate.getMonth() + latestMonth)
  const isDueNow = new Date() >= nextDate
  const currentMonth = Math.min(group?.duration || 0, isDueNow ? latestMonth + 1 : latestMonth)
  
  let totalDue = 0
  for (let m = 1; m <= currentMonth; m++) {
    const prevMonthAuc = groupAuctions.find(a => a.month === m - 1)
    const div = (isAcc || !prevMonthAuc) ? 0 : Number(prevMonthAuc.dividend || 0)
    totalDue += (Number(group?.monthly_contribution || 0) - div)
  }

  const balance = totalDue - totalPaid

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard label="Total Dues (to date)" value={fmt(totalDue)} color="info" />
        <StatCard label="Total Paid" value={fmt(totalPaid)} color="success" />
        <StatCard label="Net Outstanding" value={fmt(balance)} color={balance > 0.01 ? 'danger' : 'success'} />
      </div>

      <TableCard title="Detailed Payment Log">
        <Table>
          <thead><tr><Th>Date</Th><Th>Group</Th><Th>For Month</Th><Th>Mode</Th><Th right>Amount Paid</Th></tr></thead>
          <tbody>
            {memPayments.map(p => {
               const g = groups.find(x => x.id === p.group_id)
               return (
                 <Tr key={p.id}>
                   <Td>{fmtDate(p.created_at)}</Td>
                   <Td>{g?.name}</Td>
                   <Td>{fmtMonth(p.month, g?.start_date)}</Td>
                   <Td><Badge variant="info">{p.mode}</Badge></Td>
                   <Td right className="font-semibold" style={{ color: 'var(--success)' }}>{fmt(p.amount)}</Td>
                 </Tr>
               )
            })}
            {memPayments.length === 0 && <Tr><Td colSpan={5} className="text-center py-5">No payments found for this member.</Td></Tr>}
          </tbody>
        </Table>
      </TableCard>
    </div>
  )
}

function ReportDefaulters({ members, groups, auctions }: { members: Member[], groups: Group[], auctions: Auction[] }) {
  const defaulters = members.filter(m => m.status === 'defaulter')
  
  return (
    <TableCard title="Defaulter Analysis">
      <Table>
        <thead><tr><Th>Member</Th><Th>Group</Th><Th>Phone</Th><Th>Notes</Th></tr></thead>
        <tbody>
          {defaulters.map(m => {
            const g = groups.find(x => x.id === m.group_id)
            return (
              <Tr key={m.id}>
                <Td className="font-semibold" style={{ color: 'var(--danger)' }}>
                  {m.persons?.name || 'Member'} 
                  {auctions.some(a => a.winner_id === m.id) && <Badge variant="accent" className="ml-2">Winner</Badge>}
                  <Badge variant="danger" className="ml-1">Defaulter</Badge>
                </Td>
                <Td>{g?.name} (#{m.ticket_no})</Td>
                <Td>{m.persons?.phone || '—'}</Td>
                <Td className="text-xs max-w-[200px] truncate">{m.notes || '—'}</Td>
              </Tr>
            )
          })}
          {defaulters.length === 0 && <Tr><Td colSpan={4} className="text-center py-5">No defaulters. Great!</Td></Tr>}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportWinners({ auctions, groups, members, filter, onFilterChange }: { auctions: Auction[], groups: Group[], members: Member[], filter: string, onFilterChange: (v: any) => void }) {
  const wonAucs = auctions.filter(a => {
    if (a.winner_id == null) return false
    if (filter === 'pending') return !a.is_payout_settled
    if (filter === 'settled') return a.is_payout_settled
    return true
  }).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  return (
    <div className="space-y-4">
      <div className="flex justify-end no-print">
        <select 
          className={inputClass} 
          style={{ ...inputStyle, width: 'auto' }}
          value={filter}
          onChange={e => onFilterChange(e.target.value)}
        >
          <option value="all">All Winners</option>
          <option value="pending">Pending Payouts</option>
          <option value="settled">Settled Payouts</option>
        </select>
      </div>
      <TableCard title="Auction Winners">
        <Table>
          <thead><tr><Th>Date</Th><Th>Winner</Th><Th>Group</Th><Th>Month</Th><Th right>Payout Amount</Th><Th>Settlement</Th></tr></thead>
          <tbody>
            {wonAucs.map(a => {
              const m = members.find(x => x.id === a.winner_id)
              const g = groups.find(x => x.id === a.group_id)
              return (
                <Tr key={a.id}>
                  <Td>{fmtDate(a.created_at)}</Td>
                  <Td className="font-semibold">👑 {m?.persons?.name || 'Unknown'}</Td>
                  <Td>{g?.name}</Td>
                  <Td><Badge variant="accent">{fmtMonth(a.month, g?.start_date)}</Badge></Td>
                  <Td right className="font-mono font-bold text-success-600">{fmt(a.net_payout || a.auction_discount)}</Td>
                  <Td>
                    {a.is_payout_settled 
                      ? <div className="flex flex-col text-[10px] text-success-600 font-bold"><span>✓ Settled</span><span className="opacity-50">{fmtDate(a.payout_date)}</span></div>
                      : <Badge variant="danger">Pending</Badge>}
                  </Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </TableCard>
    </div>
  )
}

function ReportGroupEnrollment({ groupId, members, groups, auctions }: { groupId: number, members: Member[], groups: Group[], auctions: Auction[] }) {
  const group = groups.find(g => g.id === groupId)
  const gMembers = members.filter(m => m.group_id === groupId)
  
  // Clubbing Logic
  const clubMap = new Map<number, any>()
  gMembers.forEach(m => {
    const auc = auctions.find(a => a.group_id === groupId && a.winner_id === m.id)
    if (!clubMap.has(m.person_id)) {
      clubMap.set(m.person_id, { 
        person: m.persons, 
        tickets: [{ no: m.ticket_no, won: !!auc, month: auc ? fmtMonth(auc.month, group?.start_date) : null }],
        status: m.status,
        hasWinner: !!auc
      })
    } else {
      const existing = clubMap.get(m.person_id)
      existing.tickets.push({ no: m.ticket_no, won: !!auc, month: auc ? fmtMonth(auc.month, group?.start_date) : null })
      if (auc) existing.hasWinner = true
    }
  })
  
  const clubbed = Array.from(clubMap.values()).sort((a,b) => a.person?.name.localeCompare(b.person?.name))
  
  return (
    <TableCard title={`Enrollment: ${group?.name || 'Group'}`} subtitle={`${gMembers.length} tickets across ${clubbed.length} members`}>
      <Table>
        <thead><tr>
          <Th>Member Name</Th>
          <Th>Nickname</Th>
          <Th>Phone</Th>
          <Th>Ticket Numbers</Th>
          <Th>Won Month</Th>
          <Th right>Count</Th>
        </tr></thead>
        <tbody>
          {clubbed.map((item: any, idx) => (
            <Tr key={idx}>
              <Td className="font-semibold">
                {item.person?.name}
                {item.hasWinner && <Badge variant="accent" className="ml-2">Winner</Badge>}
              </Td>
              <Td className="text-[10px] opacity-50">{item.person?.nickname || '—'}</Td>
              <Td className="font-mono text-xs">{item.person?.phone || '—'}</Td>
              <Td className="text-xs font-mono">
                {item.tickets.sort((a:any,b:any)=>a.no-b.no).map((t:any) => (
                   <span key={t.no} className={cn("mr-2 px-1.5 py-0.5 rounded", t.won ? "bg-accent text-white font-bold" : "bg-[var(--surface2)] text-[var(--text3)]")}>
                     #{t.no}{t.won && ' 👑'}
                   </span>
                ))}
              </Td>
              <Td className="text-xs font-bold text-[var(--accent)]">
                {item.tickets.filter((t:any) => t.month).map((t:any) => t.month).join(', ') || '—'}
              </Td>
              <Td right>
                <Badge variant={item.tickets.length > 1 ? 'success' : 'gray'}>{item.tickets.length}</Badge>
              </Td>
            </Tr>
          ))}
          {clubbed.length === 0 && <Tr><Td colSpan={5} className="text-center py-5">No members enrolled in this group.</Td></Tr>}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportReconciliation({ payments, denominations }: { payments: Payment[], denominations: any[] }) {
  const reconData = useMemo(() => {
    const dates = Array.from(new Set([
      ...payments.map(p => p.payment_date),
      ...denominations.map(d => d.entry_date)
    ].filter(Boolean) as string[]))

    return dates
      .sort((a, b) => b.localeCompare(a))
      .map(date => {
        const ledgerTotal = payments
          .filter(p => p.payment_date === date)
          .reduce((s, p) => s + Number(p.amount), 0)
        const cashbookTotal = denominations
          .filter(d => d.entry_date === date)
          .reduce((s, d) => s + Number(d.total), 0)
        return { date, ledgerTotal, cashbookTotal, diff: ledgerTotal - cashbookTotal }
      })
  }, [payments, denominations])

  const totalLedger = reconData.reduce((s, r) => s + r.ledgerTotal, 0)
  const totalCash = reconData.reduce((s, r) => s + r.cashbookTotal, 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4">
        <StatCard label="Total Ledger (Accounting)" value={fmt(totalLedger)} color="info" />
        <StatCard label="Total Cashbook (Physical)" value={fmt(totalCash)} color="accent" />
      </div>

      <TableCard title="Daily Reconciliation" subtitle="Verification of member receipts vs physical cash">
        <Table>
          <thead><tr>
            <Th>Date</Th>
            <Th right>Ledger Total (A)</Th>
            <Th right>Cashbook Total (B)</Th>
            <Th right>Difference (A-B)</Th>
            <Th>Status</Th>
          </tr></thead>
          <tbody>
            {reconData.map(r => (
              <Tr key={r.date}>
                <Td>{fmtDate(r.date)}</Td>
                <Td right className="font-mono">{fmt(r.ledgerTotal)}</Td>
                <Td right className="font-mono">{fmt(r.cashbookTotal)}</Td>
                <Td right className={`font-mono font-bold ${Math.abs(r.diff) > 0.1 ? 'text-danger-500' : 'text-success-500'}`}>
                  {r.diff > 0 ? '+' : ''}{fmt(r.diff)}
                </Td>
                <Td>
                  {Math.abs(r.diff) < 0.1 
                    ? <Badge variant="success">Matched ✓</Badge>
                    : <Badge variant="danger">Discrepancy ✗</Badge>}
                </Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableCard>
    </div>
  )
}

function ReportActivityLog({ logs, profiles }: { logs: any[], profiles: any[] }) {
  const [page, setPage] = useState(1);
  const pageSize = 15;
  const totalPages = Math.ceil(logs.length / pageSize);
  const displayLogs = logs.slice((page - 1) * pageSize, page * pageSize);

  return (
    <TableCard 
      title="System Activity Log" 
      subtitle={`Audit trail of critical system actions (${logs.length} events)`}
      actions={
        <div className="flex items-center gap-3">
           <Btn size="sm" variant="secondary" disabled={page === 1} onClick={() => setPage(page - 1)}>Prev</Btn>
           <span className="text-[10px] font-bold uppercase tracking-widest opacity-60">Page {page} of {totalPages || 1}</span>
           <Btn size="sm" variant="secondary" disabled={page >= totalPages} onClick={() => setPage(page + 1)}>Next</Btn>
        </div>
      }
    >
      <Table>
        <thead><tr>
          <Th>Timestamp</Th>
          <Th>User</Th>
          <Th>Action</Th>
          <Th>Reference</Th>
          <Th>Details</Th>
        </tr></thead>
        <tbody>
          {displayLogs.length === 0 ? (
            <Tr><Td colSpan={5} className="text-center py-5">No activity recorded for this period.</Td></Tr>
          ) : displayLogs.map(l => (
            <Tr key={l.id}>
              <Td className="text-[10px] whitespace-nowrap">
                <div className="flex items-center gap-1 opacity-60">
                  <Clock size={10} />
                  {new Date(l.created_at).toLocaleString()}
                </div>
              </Td>
              <Td>
                <div className="font-bold text-xs">
                  {profiles.find(p => p.id === l.user_id)?.full_name || 'System / Auto'}
                </div>
              </Td>
              <Td>
                <Badge variant={l.action.includes('DELETED') ? 'danger' : 'info'} className="text-[9px]">
                  {l.action}
                </Badge>
              </Td>
              <Td className="text-[10px] opacity-40 font-mono">
                {l.entity_type} {l.entity_id ? `#${l.entity_id}` : ''}
              </Td>
              <Td className="text-[10px] py-2">
                <div className="opacity-80 max-w-[400px] break-words whitespace-pre-wrap font-mono leading-relaxed">
                  {l.metadata ? JSON.stringify(l.metadata, null, 2) : '—'}
                </div>
              </Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportTodayCollection({ payments, members, groups }: { payments: Payment[], members: Member[], groups: Group[] }) {
  const today = getToday()
  const todayPayments = payments.filter(p => p.payment_date === today)
  
  const cashTotal = todayPayments.filter(p => p.mode === 'Cash').reduce((s, p) => s + Number(p.amount), 0)
  const upiTotal  = todayPayments.filter(p => p.mode === 'UPI').reduce((s, p) => s + Number(p.amount), 0)
  const bankTotal = todayPayments.filter(p => p.mode === 'Bank Transfer').reduce((s, p) => s + Number(p.amount), 0)
  const grandTotal = todayPayments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Today's Total" value={fmt(grandTotal)} color="info" sub="Total received today" />
        <StatCard label="Cash Total" value={fmt(cashTotal)} color="accent" sub="Physical cash" />
        <StatCard label="UPI Total" value={fmt(upiTotal)} color="success" sub="UPI / Digital" />
        <StatCard label="Bank Total" value={fmt(bankTotal)} color="info" sub="Direct Transfer" />
      </div>

      <TableCard title="Today's Collections Breakdown" subtitle={`Showing ${todayPayments.length} transactions for ${fmtDate(today)}`}>
        <Table>
          <thead>
            <tr>
              <Th>Time</Th>
              <Th>Member</Th>
              <Th>Group</Th>
              <Th>Mode</Th>
              <Th right>Amount</Th>
            </tr>
          </thead>
          <tbody>
            {todayPayments.length === 0 ? (
              <Tr><Td colSpan={5} className="text-center py-10 opacity-50">No collections recorded today yet.</Td></Tr>
            ) : todayPayments.sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()).map(p => {
              const m = members.find(x => x.id === p.member_id)
              const g = groups.find(x => x.id === p.group_id)
              return (
                <Tr key={p.id}>
                  <Td className="text-xs opacity-50">{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Td>
                  <Td className="font-semibold">{m?.persons?.name || 'Unknown'}</Td>
                  <Td className="text-xs">{g?.name || '—'}</Td>
                  <Td><Badge variant={p.mode === 'Cash' ? 'accent' : 'info'}>{p.mode}</Badge></Td>
                  <Td right className="font-mono font-bold text-[var(--success)]">{fmt(p.amount)}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </TableCard>
    </div>
  )
}
