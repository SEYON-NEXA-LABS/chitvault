'use client'

import { useEffect, useState, useMemo } from 'react'
import { createClient } from '@/lib/supabase/client'
import { fmt, fmtDate } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge, Loading, Btn, Card, Field } from '@/components/ui'
import { inputClass, inputStyle } from '@/components/ui'
import { Printer, ChevronLeft, Calendar, DollarSign, Users, FileText, CheckCircle, AlertTriangle, TrendingUp } from 'lucide-react'
import type { Group, Member, Auction, Payment, ForemanCommission } from '@/types'

const REPORTS = [
  { id: 'pnl', category: 'Financial', title: 'Profit & Loss (P&L)', desc: 'Summary of income versus expenses', icon: DollarSign },
  { id: 'cashflow', category: 'Financial', title: 'Cash Flow Analysis', desc: 'Movement of money in and out', icon: TrendingUp },
  { id: 'dividend', category: 'Financial', title: 'Dividend Performance', desc: 'Average dividend trends by group', icon: DollarSign },
  
  { id: 'upcoming_pay', category: 'Operational', title: 'Upcoming & Pending Payments', desc: 'Pending collections for auction cycles', icon: Calendar },
  { id: 'auction_sched', category: 'Operational', title: 'Auction Schedule', desc: 'Upcoming auctions for all active groups', icon: Calendar },
  { id: 'group_ledger', category: 'Operational', title: 'Group Ledger', desc: 'Detailed transaction history for a single group', icon: FileText },
  
  { id: 'member_history', category: 'Member-focused', title: 'Member Payment History', desc: 'Complete payment history for a specific member', icon: Users },
  { id: 'defaulters', category: 'Member-focused', title: 'Defaulter Analysis', desc: 'High-risk members with defaults', icon: AlertTriangle },
  { id: 'winners', category: 'Member-focused', title: 'Auction Winners', desc: 'Comprehensive list of won auctions', icon: CheckCircle },
]

export default function ReportsPage() {
  const supabase = createClient()
  const [groups,   setGroups]   = useState<Group[]>([])
  const [members,  setMembers]  = useState<Member[]>([])
  const [auctions, setAuctions] = useState<Auction[]>([])
  const [payments, setPayments] = useState<Payment[]>([])
  const [commissions, setCommissions] = useState<ForemanCommission[]>([])
  const [loading,  setLoading]  = useState(true)
  const [error,    setError]    = useState<string | null>(null)

  const [activeReport, setActiveReport] = useState<string | null>(null)
  
  // Selections for specific reports
  // Selections for specific reports
  const [selectedGroupId, setSelectedGroupId] = useState<string>('')
  const [selectedMemberId, setSelectedMemberId] = useState<string>('')

  // Global Time Filter
  const [timeFilter, setTimeFilter] = useState<string>('all')

  const { filteredAuctions, filteredPayments, filteredCommissions } = useMemo(() => {
    if (timeFilter === 'all') return { filteredAuctions: auctions, filteredPayments: payments, filteredCommissions: commissions }

    const today = new Date()
    const currentYear = today.getFullYear()
    const currentMonth = today.getMonth() // 0-11
    
    // Financial year (Apr 1 to Mar 31)
    const fyStartYear = currentMonth >= 3 ? currentYear : currentYear - 1
    
    let startD = new Date(fyStartYear, 3, 1) // Apr 1
    let endD = new Date(fyStartYear + 1, 3, 0) // Mar 31

    if (timeFilter === 'q1') { startD = new Date(fyStartYear, 3, 1); endD = new Date(fyStartYear, 6, 0) } // Apr-Jun
    else if (timeFilter === 'q2') { startD = new Date(fyStartYear, 6, 1); endD = new Date(fyStartYear, 9, 0) } // Jul-Sep
    else if (timeFilter === 'q3') { startD = new Date(fyStartYear, 9, 1); endD = new Date(fyStartYear, 12, 0) } // Oct-Dec
    else if (timeFilter === 'q4') { startD = new Date(fyStartYear + 1, 0, 1); endD = new Date(fyStartYear + 1, 3, 0) } // Jan-Mar
    else if (timeFilter === 'month') { startD = new Date(currentYear, currentMonth, 1); endD = new Date(currentYear, currentMonth + 1, 0) }
    
    const toLocalStr = (d: Date) => d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0')
    const s = toLocalStr(startD)
    
    // to include end day entirely:
    endD.setDate(endD.getDate() + 1)
    const e = toLocalStr(endD)

    const isBetween = (d: string | null) => d ? ((d.substring(0, 10) >= s) && (d.substring(0, 10) < e)) : false

    return {
      filteredAuctions: auctions.filter(a => isBetween(a.auction_date || a.created_at)),
      filteredPayments: payments.filter(p => isBetween(p.payment_date || p.created_at)),
      filteredCommissions: commissions.filter(c => isBetween(c.created_at))
    }
  }, [auctions, payments, commissions, timeFilter])

  useEffect(() => {
    async function load() {
      try {
        setLoading(true)
        setError(null)
        const [g, m, a, p, c] = await Promise.all([
          supabase.from('groups').select('*').order('name'),
          supabase.from('members').select('*').order('name'),
          supabase.from('auctions').select('*').order('month', { ascending: false }),
          supabase.from('payments').select('*').order('created_at', { ascending: false }),
          supabase.from('foreman_commissions').select('*')
        ])

        if (g.error) throw new Error(`Failed to load groups: ${g.error.message}`)
        if (m.error) throw new Error(`Failed to load members: ${m.error.message}`)
        if (a.error) throw new Error(`Failed to load auctions: ${a.error.message}`)
        if (p.error) throw new Error(`Failed to load payments: ${p.error.message}`)

        setGroups(g.data as Group[] || [])
        setMembers(m.data as Member[] || [])
        setAuctions(a.data as Auction[] || [])
        setPayments(p.data as Payment[] || [])
        setCommissions(c.data as ForemanCommission[] || [])
      } catch (e: any) {
        setError(e.message)
      } finally {
        setLoading(false)
      }
    }
    load()
  }, [supabase])

  if (loading) return <Loading />
  if (error) return <div className="p-4 rounded-lg bg-red-100 text-red-700">Error: {error}</div>

  const renderActiveReport = () => {
    switch (activeReport) {
      case 'pnl': return <ReportPNL groups={groups} commissions={filteredCommissions} auctions={filteredAuctions} />
      case 'cashflow': return <ReportCashFlow payments={filteredPayments} auctions={filteredAuctions} />
      case 'dividend': return <ReportDividend groups={groups} auctions={filteredAuctions} />
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
          {selectedGroupId && <ReportGroupLedger groupId={Number(selectedGroupId)} members={members} auctions={filteredAuctions} payments={filteredPayments} />}
        </div>
      )
      case 'member_history': return (
        <div>
           <Field label="Select Member" className="mb-4 max-w-sm">
            <select className={inputClass} style={inputStyle} value={selectedMemberId} onChange={(e) => setSelectedMemberId(e.target.value)}>
              <option value="">-- Choose Member --</option>
              {members.filter(m => m.status !== 'exited').map(m => <option key={m.id} value={m.id}>{m.name} ({groups.find(g=>g.id===m.group_id)?.name})</option>)}
            </select>
          </Field>
          {selectedMemberId && <ReportMemberHistory memberId={Number(selectedMemberId)} groups={groups} payments={filteredPayments} auctions={filteredAuctions} />}
        </div>
      )
      case 'defaulters': return <ReportDefaulters members={members} groups={groups} />
      case 'winners': return <ReportWinners auctions={filteredAuctions} groups={groups} members={members} />
      default: return null
    }
  }

  return (
    <div className="space-y-6">
      <style jsx global>{`
        @media print {
          body > #__next > div > main > div > :not(.printable) { display: none; }
          .no-print { display: none !important; }
          @page { margin: 1cm; size: landscape; }
        }
      `}</style>

      {/* Hub View */}
      {!activeReport && (
        <div className="printable">
          <div className="flex justify-between items-center mb-6 border-b pb-4" style={{ borderColor: 'var(--border)' }}>
            <h1 className="text-2xl font-bold">Reports Hub</h1>
            <div className="flex items-center gap-3">
              <label className="text-sm font-semibold uppercase tracking-wide" style={{ color: 'var(--text2)' }}>Date Filter:</label>
              <select className={inputClass} style={{ ...inputStyle, width: 'auto', padding: '6px 12px' }} value={timeFilter} onChange={(e) => setTimeFilter(e.target.value)}>
                <option value="all">All Time</option>
                <option value="fy">Current Financial Year</option>
                <option value="q1">Q1 (Apr - Jun)</option>
                <option value="q2">Q2 (Jul - Sep)</option>
                <option value="q3">Q3 (Oct - Dec)</option>
                <option value="q4">Q4 (Jan - Mar)</option>
                <option value="month">Current Month</option>
              </select>
            </div>
          </div>
          {['Financial', 'Operational', 'Member-focused'].map(category => (
            <div key={category} className="mb-8">
              <h2 className="text-lg font-semibold mb-3 px-1 border-b pb-2" style={{ borderColor: 'var(--border)', color: 'var(--text)' }}>
                {category} Reports
              </h2>
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                {REPORTS.filter(r => r.category === category).map(report => {
                  const Icon = report.icon
                  return (
                    <div key={report.id} onClick={() => setActiveReport(report.id)}
                      className="p-5 rounded-2xl border cursor-pointer hover:shadow-md transition-all group"
                      style={{ background: 'var(--surface)', borderColor: 'var(--border)' }}>
                      <div className="flex items-center gap-3 mb-2">
                        <div className="p-2 rounded-lg" style={{ background: 'var(--gold-dim)', color: 'var(--gold)' }}>
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
                 {timeFilter !== 'all' && (
                   <span className="text-xs ml-2 px-2 py-1 rounded-lg bg-blue-100 text-blue-800 uppercase font-semibold">
                     {timeFilter === 'fy' ? 'Financial Year' : timeFilter.toUpperCase()} FILTER APPLIED
                   </span>
                 )}
               </h1>
            </div>
            <Btn variant="secondary" onClick={() => window.print()}><Printer size={15}/> Print Report</Btn>
          </div>
          {renderActiveReport()}
        </div>
      )}
    </div>
  )
}

// ── Individual Report Components ──────────────────────────────────────────────────────────

function ReportPNL({ groups, commissions, auctions }: { groups: Group[], commissions: ForemanCommission[], auctions: Auction[] }) {
  const totalIncome = commissions.reduce((s, c) => s + Number(c.commission_amt), 0)
  const totalDividends = auctions.reduce((s, a) => s + Number(a.dividend), 0) // Tracked as member benefits/expenses
  
  return (
    <>
      <div className="grid grid-cols-2 gap-4 mb-4">
        <StatCard label="Total Commission (Firm Income)" value={fmt(totalIncome)} color="green" />
        <StatCard label="Dividends Distributed (Member Benefits)" value={fmt(totalDividends)} color="blue" />
      </div>
      <TableCard title="Profit & Loss by Group">
        <Table>
          <thead><tr><Th>Group</Th><Th right>Commissions Earned</Th><Th right>Dividends Distributed</Th></tr></thead>
          <tbody>
            {groups.map(g => {
              const inc = commissions.filter(c => c.group_id === g.id).reduce((s, c) => s + Number(c.commission_amt), 0)
              const div = auctions.filter(a => a.group_id === g.id).reduce((s, a) => s + Number(a.dividend), 0)
              return (
                <Tr key={g.id}>
                  <Td className="font-semibold">{g.name}</Td>
                  <Td right style={{ color: 'var(--green)' }}>{fmt(inc)}</Td>
                  <Td right style={{ color: 'var(--text2)' }}>{fmt(div)}</Td>
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
  const paidPayments = payments.filter(p => p.status === 'paid')
  const totalCollected = paidPayments.reduce((s, p) => s + Number(p.amount), 0)
  const totalPaidOut = auctions.reduce((s, a) => s + Number(a.bid_amount), 0)
  const netFlow = totalCollected - totalPaidOut

  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard label="Total Inflow (Collections)" value={fmt(totalCollected)} color="green" />
        <StatCard label="Total Outflow (Winner Payouts)" value={fmt(totalPaidOut)} color="red" />
        <StatCard label="Net Cash Flow" value={fmt(netFlow)} color={netFlow >= 0 ? 'green' : 'red'} />
      </div>
      <div className="p-4 rounded-xl border mb-5 text-sm" style={{ background: 'var(--surface2)', color: 'var(--text2)' }}>
        Cash flow represents the liquid money collected from members versus the money paid out to auction winners. 
        A negative cash flow may indicate pending collections that need urgent attention.
      </div>
    </>
  )
}

function ReportDividend({ groups, auctions }: { groups: Group[], auctions: Auction[] }) {
  return (
    <TableCard title="Dividend Performance by Group">
      <Table>
        <thead><tr><Th>Group</Th><Th>Auctions Held</Th><Th right>Total Dividend Paid</Th><Th right>Average Dividend</Th></tr></thead>
        <tbody>
          {groups.map(g => {
            const aucs = auctions.filter(a => a.group_id === g.id)
            const sum = aucs.reduce((s, a) => s + Number(a.dividend), 0)
            const avg = aucs.length > 0 ? sum / aucs.length : 0
            return (
              <Tr key={g.id}>
                <Td className="font-semibold">{g.name}</Td>
                <Td>{aucs.length} / {g.duration}</Td>
                <Td right>{fmt(sum)}</Td>
                <Td right style={{ color: 'var(--gold)' }}>{fmt(avg)}</Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportUpcomingPay({ groups, members, auctions, payments }: any) {
  // Reuse the outstanding logic but formatted as Upcoming/Pending
  const outstandingReport = members.map((member: Member) => {
    const group = groups.find((g: Group) => g.id === member.group_id)
    if (!group || group.status === 'archived' || !['active', 'defaulter'].includes(member.status)) return null

    const groupAuctions = auctions.filter((a: Auction) => a.group_id === member.group_id)
    if (groupAuctions.length === 0) return null

    const memberPayments = payments.filter((p: Payment) => p.member_id === member.id)
    let totalOutstanding = 0
    const pendingMonths: number[] = []

    for (const auction of groupAuctions) {
      const month = auction.month
      const paymentsForMonth = memberPayments.filter((p: Payment) => p.month === month).reduce((sum: number, p: Payment) => sum + Number(p.amount), 0)
      const dueForMonth = Number(group.monthly_contribution) - Number(auction.dividend)
      const outstandingForMonth = dueForMonth - paymentsForMonth

      if (outstandingForMonth > 0.01) {
        totalOutstanding += outstandingForMonth
        pendingMonths.push(month)
      }
    }

    if (totalOutstanding > 0) {
      return { member, group, pendingMonths, totalOutstanding }
    }
    return null
  }).filter(Boolean).sort((a: any, b: any) => b.totalOutstanding - a.totalOutstanding)
  
  const totalDue = outstandingReport.reduce((s: number, i: any) => s + i.totalOutstanding, 0)

  return (
    <TableCard title="Upcoming & Pending Payments" subtitle={fmt(totalDue) + " total outstanding"}>
      <Table>
        <thead><tr><Th>Member</Th><Th>Group</Th><Th>Pending Months</Th><Th right>Amount Due</Th></tr></thead>
        <tbody>
          {outstandingReport.length === 0 && <Tr><Td colSpan={4} className="text-center py-5">All current payments are clear.</Td></Tr>}
          {outstandingReport.map((item: any) => (
            <Tr key={item.member.id}>
              <Td>
                <div className="font-semibold">{item.member.name}</div>
                <div className="text-xs text-gray-500">{item.member.phone || 'No phone'}</div>
              </Td>
              <Td>{item.group.name}</Td>
              <Td>{item.pendingMonths.map((m: number) => <Badge key={m} variant="red" className="mr-1">M{m}</Badge>)}</Td>
              <Td right style={{ color: 'var(--red)' }} className="font-semibold">{fmt(item.totalOutstanding)}</Td>
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
                  {!isCompleted ? <span className="font-bold">Month {completed + 1}</span> : '—'}
                </Td>
                <Td>
                  {isCompleted ? <Badge variant="green">Finished</Badge> : <Badge variant="blue">Ongoing</Badge>}
                </Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportGroupLedger({ groupId, members, auctions, payments }: { groupId: number, members: Member[], auctions: Auction[], payments: Payment[] }) {
  const grpAuctions = auctions.filter(a => a.group_id === groupId).sort((a,b) => a.month - b.month)
  const grpPayments = payments.filter(p => p.group_id === groupId && p.status === 'paid')
  
  return (
    <TableCard title="Group Ledger (Summary per month)">
      <Table>
        <thead><tr><Th>Month</Th><Th>Winner</Th><Th right>Winner Payout (Bid)</Th><Th right>Dividend</Th><Th right>Total Collections</Th></tr></thead>
        <tbody>
          {grpAuctions.map(auc => {
            const w = members.find(m => m.id === auc.winner_id)
            const monthPayments = grpPayments.filter(p => p.month === auc.month).reduce((s,p) => s + Number(p.amount), 0)
            return (
              <Tr key={auc.month}>
                <Td><Badge variant="gray">Month {auc.month}</Badge></Td>
                <Td>{w ? `👑 ${w.name}` : '—'}</Td>
                <Td right style={{ color: 'var(--red)' }}>{fmt(auc.bid_amount)}</Td>
                <Td right style={{ color: 'var(--gold)' }}>{fmt(auc.dividend)}</Td>
                <Td right style={{ color: 'var(--green)' }}>{fmt(monthPayments)}</Td>
              </Tr>
            )
          })}
          {grpAuctions.length === 0 && <Tr><Td colSpan={5} className="text-center py-5">No auctions recorded for this group.</Td></Tr>}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportMemberHistory({ memberId, groups, payments, auctions }: { memberId: number, groups: Group[], payments: Payment[], auctions: Auction[] }) {
  const memPayments = payments.filter(p => p.member_id === memberId).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  return (
    <TableCard title="Member Payment History">
      <Table>
        <thead><tr><Th>Date</Th><Th>Group</Th><Th>For Month</Th><Th>Mode</Th><Th right>Amount Paid</Th></tr></thead>
        <tbody>
          {memPayments.map(p => {
             const g = groups.find(x => x.id === p.group_id)
             return (
               <Tr key={p.id}>
                 <Td>{fmtDate(p.created_at)}</Td>
                 <Td>{g?.name}</Td>
                 <Td>M{p.month}</Td>
                 <Td><Badge variant="blue">{p.mode}</Badge></Td>
                 <Td right className="font-semibold" style={{ color: 'var(--green)' }}>{fmt(p.amount)}</Td>
               </Tr>
             )
          })}
          {memPayments.length === 0 && <Tr><Td colSpan={5} className="text-center py-5">No payments found for this member.</Td></Tr>}
        </tbody>
      </Table>
    </TableCard>
  )
}

function ReportDefaulters({ members, groups }: { members: Member[], groups: Group[] }) {
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
                <Td className="font-semibold" style={{ color: 'var(--red)' }}>
                  {m.name} <Badge variant="red" className="ml-1">Defaulter</Badge>
                </Td>
                <Td>{g?.name} (#{m.ticket_no})</Td>
                <Td>{m.phone || '—'}</Td>
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

function ReportWinners({ auctions, groups, members }: { auctions: Auction[], groups: Group[], members: Member[] }) {
  const wonAucs = auctions.filter(a => a.winner_id != null).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  return (
    <TableCard title="Auction Winners">
      <Table>
        <thead><tr><Th>Date</Th><Th>Winner</Th><Th>Group</Th><Th>Month</Th><Th right>Bid Amount (Payout)</Th></tr></thead>
        <tbody>
          {wonAucs.map(a => {
            const m = members.find(x => x.id === a.winner_id)
            const g = groups.find(x => x.id === a.group_id)
            return (
              <Tr key={a.id}>
                <Td>{fmtDate(a.created_at)}</Td>
                <Td className="font-semibold">👑 {m?.name || 'Unknown'}</Td>
                <Td>{g?.name}</Td>
                <Td><Badge variant="gold">M{a.month}</Badge></Td>
                <Td right style={{ color: 'var(--red)' }}>{fmt(a.bid_amount)}</Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </TableCard>
  )
}
