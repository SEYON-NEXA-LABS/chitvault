'use client'

import { useState, useEffect } from 'react'
import { fmt, fmtDate, fmtMonth, getToday } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge, Loading, GroupBadge } from '@/components/ui'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { 
  Wallet, CheckCircle2, AlertCircle, Layers, ArrowUpRight, Calendar, ListFilter, ChevronRight,
  FolderKanban
} from 'lucide-react'
import { getGroupTheme, GROUP_PALETTE, type GroupTheme } from '@/lib/utils/groupTheme'
import type { Group, Member, Auction, Payment } from '@/types'

// 1. Defaulters
export function ReportDefaulters({ members, groups, auctions }: { members: Member[], groups: Group[], auctions: Auction[] }) {
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
                  <Link href={`/members/${m.person_id}`} className="hover:underline transition-colors">
                    {m.persons?.name || 'Member'} 
                  </Link>
                  {auctions.some(a => a.winner_id === m.id) && <Badge variant="accent" className="ml-2">Winner</Badge>}
                  <Badge variant="danger" className="ml-1">Defaulter</Badge>
                </Td>
                <Td>
                  <Link href={`/groups/${g?.id}`} className="hover:underline transition-colors font-medium">
                    {g?.name}
                  </Link>
                  <span className="opacity-40 ml-1 text-xs">(#{m.ticket_no})</span>
                </Td>
                <Td>{m.persons?.phone || '—'}</Td>
                <Td className="text-xs">{m.notes || '—'}</Td>
              </Tr>
            )
          })}
          {defaulters.length === 0 && <Tr><Td colSpan={4} className="text-center py-5">No defaulters. Great!</Td></Tr>}
        </tbody>
      </Table>
    </TableCard>
  )
}

// 2. Member History (Clubbed across groups by person)
export function ReportMemberHistory({ 
  personId,
  memberId, 
  members, 
  groups, 
  payments: initialPayments = [], 
  auctions,
  firmName
}: { 
  personId?: number | string
  memberId?: number | string 
  members: Member[]
  groups: Group[]
  payments?: Payment[]
  auctions: Auction[]
  firmName?: string
}) {
  const [selectedGroupFilter, setSelectedGroupFilter] = useState<string>('all')
  const [memberPayments, setMemberPayments] = useState<Payment[]>(initialPayments)
  const [loadingPayments, setLoadingPayments] = useState<boolean>(false)
  const [ledgerViewMode, setLedgerViewMode] = useState<'monthly' | 'group' | 'detailed'>('monthly')

  // Resolve target memberships for this person
  // If personId is provided, gather all memberships with that person_id.
  // If only memberId is provided, find the member and then their person_id to club all memberships.
  const resolvedPersonId = personId 
    ? Number(personId) 
    : (memberId ? members.find(m => m.id === Number(memberId))?.person_id : undefined)

  const personMembers = members.filter(m => 
    resolvedPersonId ? m.person_id === resolvedPersonId : (memberId ? m.id === Number(memberId) : false)
  )

  const primaryPerson = personMembers[0]?.persons
  const enrolledMemberIds = Array.from(new Set(personMembers.map(m => m.id)))
  const enrolledGroupIds = new Set(personMembers.map(m => m.group_id))

  // Fetch complete payment records for all enrolled memberships of this person
  useEffect(() => {
    if (enrolledMemberIds.length === 0) return

    let isMounted = true
    async function fetchFullPayments() {
      setLoadingPayments(true)
      try {
        const supabase = createClient()
        const { data, error } = await supabase
          .from('payments')
          .select('id, member_id, group_id, month, amount, mode, payment_date, created_at')
          .in('member_id', enrolledMemberIds)
          .order('created_at', { ascending: false })

        if (!error && data && isMounted) {
          setMemberPayments(data as Payment[])
        }
      } catch (err) {
        console.error('Failed to fetch full member payments:', err)
      } finally {
        if (isMounted) setLoadingPayments(false)
      }
    }

    fetchFullPayments()
    return () => { isMounted = false }
  }, [enrolledMemberIds.join(',')])

  // Calculate stats per group for this person
  const groupBreakdowns = personMembers.map((mem, idx) => {
    const grp = groups.find(g => g.id === mem.group_id)
    const grpAuctions = auctions.filter(a => a.group_id === grp?.id && a.status === 'confirmed')
    const grpPayments = memberPayments.filter(p => p.member_id === mem.id && (p.group_id ? p.group_id === grp?.id : true))
    
    const paid = grpPayments.reduce((s, p) => s + Number(p.amount || 0), 0)
    const isAcc = grp?.auction_scheme === 'ACCUMULATION'
    const latestMonth = grpAuctions.length

    const nextDate = new Date(grp?.start_date || getToday())
    nextDate.setMonth(nextDate.getMonth() + latestMonth)
    const isDueNow = new Date() >= nextDate
    const currentMonth = Math.min(grp?.duration || 0, isDueNow ? latestMonth + 1 : latestMonth)

    let due = 0
    for (let m = 1; m <= currentMonth; m++) {
      const prevMonthAuc = grpAuctions.find(a => a.month === m - 1)
      const div = (isAcc || !prevMonthAuc) ? 0 : Number(prevMonthAuc.dividend || 0)
      due += (Number(grp?.monthly_contribution || 0) - div)
    }

    const bal = due - paid
    const theme = getGroupTheme(idx, grp?.id, grp?.name)

    // Distinct chit installment months with payment records
    const paidMonths = Array.from(new Set(grpPayments.map(p => Number(p.month)).filter(m => m > 0))).sort((a, b) => a - b)
    
    // Determine which months are pending (if balance is greater than 0)
    const pendingMonths: number[] = []
    if (bal > 0.01) {
      let cumulativePaid = paid
      for (let m = 1; m <= currentMonth; m++) {
        const prevMonthAuc = grpAuctions.find(a => a.month === m - 1)
        const div = (isAcc || !prevMonthAuc) ? 0 : Number(prevMonthAuc.dividend || 0)
        const installmentDue = (Number(grp?.monthly_contribution || 0) - div)
        if (cumulativePaid >= installmentDue - 0.01) {
          cumulativePaid -= installmentDue
        } else {
          pendingMonths.push(m)
        }
      }
    }

    return {
      membership: mem,
      group: grp,
      due,
      paid,
      balance: bal,
      paymentsCount: grpPayments.length,
      ticketNo: mem.ticket_no,
      status: mem.status,
      theme,
      paidMonths,
      pendingMonths,
      currentMonth
    }
  })

  // Aggregated totals across all groups
  const overallDue = groupBreakdowns.reduce((sum, g) => sum + g.due, 0)
  const overallPaid = groupBreakdowns.reduce((sum, g) => sum + g.paid, 0)
  const overallBalance = overallDue - overallPaid

  // All payments belonging to this person
  const allPayments = memberPayments
    .filter(p => enrolledMemberIds.includes(p.member_id) || (p.group_id && enrolledGroupIds.has(p.group_id) && personMembers.some(m => m.id === p.member_id)))
    .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())

  // Filtered payments for table view
  const displayPayments = selectedGroupFilter === 'all' 
    ? allPayments 
    : allPayments.filter(p => String(p.group_id) === selectedGroupFilter)

  // Club payments by Calendar Month (Year-Month)
  const monthlyClubbedMap = new Map<string, {
    key: string
    displayMonth: string
    totalAmount: number
    paymentCount: number
    latestDate: string
    modes: Set<string>
    breakdown: Array<{
      groupName: string
      ticketNo: string | number
      amount: number
      mode: string
      forMonth: number
      date: string
      theme: typeof GROUP_PALETTE[0]
    }>
  }>()

  displayPayments.forEach(p => {
    const rawDate = p.payment_date || p.created_at
    const d = new Date(rawDate)
    const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear()
    const monthIdx = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth()
    const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const displayMonth = `${monthNames[monthIdx]} ${year}`

    const grp = groups.find(x => x.id === p.group_id)
    const mem = personMembers.find(m => m.id === p.member_id)
    const grpIdx = personMembers.findIndex(m => m.group_id === p.group_id)
    const theme = getGroupTheme(grpIdx >= 0 ? grpIdx : 0, grp?.id)

    if (!monthlyClubbedMap.has(key)) {
      monthlyClubbedMap.set(key, {
        key,
        displayMonth,
        totalAmount: 0,
        paymentCount: 0,
        latestDate: rawDate,
        modes: new Set<string>(),
        breakdown: []
      })
    }

    const entry = monthlyClubbedMap.get(key)!
    entry.totalAmount += Number(p.amount || 0)
    entry.paymentCount += 1
    if (p.mode) entry.modes.add(p.mode)
    entry.breakdown.push({
      groupName: grp?.name || 'Chit Group',
      ticketNo: mem?.ticket_no || '—',
      amount: Number(p.amount || 0),
      mode: p.mode || 'cash',
      forMonth: p.month,
      date: rawDate,
      theme
    })
  })

  const monthlyClubbedList = Array.from(monthlyClubbedMap.values())
    .sort((a, b) => b.key.localeCompare(a.key))

  return (
    <div className="space-y-6">
      {/* Printable Header - Visible exclusively when printed */}
      <div className="only-print border-b-2 border-slate-900 pb-4 mb-4">
        <div className="flex justify-between items-start">
          <div>
            <h1 className="text-xl font-black uppercase tracking-tight text-slate-900">{firmName || 'CHITVAULT'}</h1>
            <h2 className="text-sm font-bold uppercase tracking-wider text-slate-700 mt-0.5">Member Statement of Accounts</h2>
          </div>
          <div className="text-right text-xs text-slate-600 font-medium">
            <p>Generated: <span className="font-semibold text-slate-900">{fmtDate(getToday())}</span></p>
            <p className="text-[11px] text-slate-500">Clubbed Group Summary</p>
          </div>
        </div>
        <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-2 gap-4 text-xs">
          <div>
            <span className="text-slate-500 font-semibold block text-[10px] uppercase tracking-wider">Member Name</span>
            <span className="text-slate-900 font-bold text-sm">{primaryPerson?.name || 'Valued Member'}</span>
            {primaryPerson?.phone && <span className="text-slate-600 ml-2 font-medium">({primaryPerson.phone})</span>}
          </div>
          <div className="text-right">
            <span className="text-slate-500 font-semibold block text-[10px] uppercase tracking-wider">Enrolled Groups</span>
            <span className="text-slate-900 font-bold">{groupBreakdowns.length} Chit Group{groupBreakdowns.length !== 1 ? 's' : ''}</span>
          </div>
        </div>

        {/* Print-Only Compact Summary Row */}
        <div className="mt-3 pt-3 border-t border-slate-200 grid grid-cols-3 gap-2 text-center">
          <div className="p-2 border border-slate-300 rounded bg-slate-50">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Total Due</span>
            <span className="text-sm font-black text-slate-900">{fmt(overallDue)}</span>
          </div>
          <div className="p-2 border border-slate-300 rounded bg-slate-50">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Total Collected</span>
            <span className="text-sm font-black text-emerald-700">{fmt(overallPaid)}</span>
          </div>
          <div className="p-2 border border-slate-300 rounded bg-slate-50">
            <span className="text-[10px] uppercase tracking-wider text-slate-500 font-semibold block">Net Outstanding</span>
            <span className={`text-sm font-black ${overallBalance > 0.01 ? 'text-rose-700' : 'text-emerald-700'}`}>{fmt(overallBalance)}</span>
          </div>
        </div>
      </div>

      {/* Screen Overview Cards (Hidden on print, which uses the dedicated compact financial summary) */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 no-print">
        <StatCard 
          label="Total Subscriptions Due" 
          value={fmt(overallDue)} 
          sub={`Across ${groupBreakdowns.length} enrolled group${groupBreakdowns.length !== 1 ? 's' : ''}`}
          color="info" 
          icon={Wallet}
        />
        <StatCard 
          label="Total Collected / Paid" 
          value={fmt(overallPaid)} 
          sub={`${overallDue > 0 ? Math.min(100, Math.round((overallPaid / overallDue) * 100)) : 100}% of dues cleared`}
          color="success" 
          icon={CheckCircle2}
        />
        <StatCard 
          label="Combined Net Balance" 
          value={fmt(overallBalance)} 
          sub={overallBalance > 0.01 ? 'Payment pending' : 'All subscriptions up-to-date'}
          color={overallBalance > 0.01 ? 'danger' : 'success'} 
          icon={AlertCircle}
        />
      </div>

      {/* Group-by-Group Breakdown Cards */}
      <div className="space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-xs font-bold uppercase tracking-wider text-[var(--text2)] flex items-center gap-1.5">
              <Layers size={14} className="text-[var(--accent)]" />
              Enrolled Chit Groups ({groupBreakdowns.length})
            </h3>
            <p className="text-[11px] text-[var(--text3)]">
              Financial breakdown and payment status per subscribed ticket
            </p>
          </div>
          {groupBreakdowns.length > 1 && (
            <div className="flex items-center gap-1.5 no-print flex-wrap">
              <span className="text-xs opacity-60 font-medium mr-1">Filter:</span>
              <button
                type="button"
                onClick={() => setSelectedGroupFilter('all')}
                className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all ${
                  selectedGroupFilter === 'all'
                    ? 'bg-[var(--accent)] text-white shadow-sm'
                    : 'bg-[var(--surface2)] text-[var(--text2)] hover:bg-[var(--surface3)]'
                }`}
              >
                All Combined
              </button>
              {groupBreakdowns.map(gb => {
                const Icon = gb.theme.icon
                const isActive = selectedGroupFilter === String(gb.group?.id)
                return (
                  <button
                    key={gb.group?.id}
                    type="button"
                    onClick={() => setSelectedGroupFilter(String(gb.group?.id))}
                    className={`text-xs px-2.5 py-1 rounded-lg font-medium transition-all flex items-center gap-1.5 ${
                      isActive
                        ? 'text-white shadow-sm'
                        : 'bg-[var(--surface2)] text-[var(--text2)] hover:bg-[var(--surface3)]'
                    }`}
                    style={isActive ? { background: gb.theme.color } : undefined}
                  >
                    <Icon size={12} style={{ color: isActive ? '#ffffff' : gb.theme.color }} />
                    <span>{gb.group?.name}</span>
                    <span className="text-[10px] opacity-75 font-mono">#{gb.ticketNo}</span>
                  </button>
                )
              })}
            </div>
          )}
        </div>

        {/* Print-Only Clean Group Financial Breakdown Table */}
        <div className="only-print mt-4 border border-slate-300 rounded-lg overflow-hidden">
          <div className="bg-slate-100 px-3 py-1.5 border-b border-slate-300 font-bold text-xs uppercase tracking-wider text-slate-800">
            Enrolled Groups Summary ({groupBreakdowns.length})
          </div>
          <table className="w-full text-xs border-collapse">
            <thead>
              <tr className="bg-slate-50 border-b border-slate-200 text-slate-700">
                <th className="px-3 py-1.5 text-left font-bold">Group Name</th>
                <th className="px-3 py-1.5 text-left font-bold">Ticket</th>
                <th className="px-3 py-1.5 text-left font-bold">Covered Months</th>
                <th className="px-3 py-1.5 text-right font-bold">Monthly</th>
                <th className="px-3 py-1.5 text-right font-bold">Billed Due</th>
                <th className="px-3 py-1.5 text-right font-bold">Collected</th>
                <th className="px-3 py-1.5 text-right font-bold">Balance</th>
                <th className="px-3 py-1.5 text-center font-bold">Status</th>
              </tr>
            </thead>
            <tbody>
              {groupBreakdowns.map((gb, i) => {
                const Icon = gb.theme.icon
                return (
                  <tr key={gb.membership.id || i} className="border-b border-slate-200">
                    <td className="px-3 py-1.5 font-bold text-slate-900">
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="w-5 h-5 rounded flex items-center justify-center shrink-0 border"
                          style={{ background: gb.theme.bg, borderColor: gb.theme.border, color: gb.theme.color }}
                        >
                          <Icon size={12} />
                        </span>
                        <span>{gb.group?.name || 'Group'}</span>
                      </div>
                    </td>
                    <td className="px-3 py-1.5 font-mono text-slate-700">#{gb.ticketNo}</td>
                    <td className="px-3 py-1.5 text-slate-700 font-mono text-[11px]">
                      {gb.paidMonths.length > 0 
                        ? (gb.paidMonths.length > 4 ? `M${gb.paidMonths[0]}–M${gb.paidMonths[gb.paidMonths.length - 1]}` : gb.paidMonths.map(m => `M${m}`).join(','))
                        : '—'}
                      {gb.pendingMonths.length > 0 && (
                        <span className="text-red-700 ml-1 font-bold">
                          [Due: {gb.pendingMonths.length > 3 ? `M${gb.pendingMonths[0]}–M${gb.pendingMonths[gb.pendingMonths.length - 1]}` : gb.pendingMonths.map(m => `M${m}`).join(',')}]
                        </span>
                      )}
                    </td>
                    <td className="px-3 py-1.5 text-right text-slate-700">{fmt(gb.group?.monthly_contribution || 0)}</td>
                    <td className="px-3 py-1.5 text-right font-medium text-slate-800">{fmt(gb.due)}</td>
                    <td className="px-3 py-1.5 text-right font-semibold text-emerald-700">{fmt(gb.paid)}</td>
                    <td className={`px-3 py-1.5 text-right font-black ${gb.balance > 0.01 ? 'text-red-700' : 'text-emerald-700'}`}>
                      {fmt(gb.balance)}
                    </td>
                    <td className="px-3 py-1.5 text-center">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase ${gb.balance > 0.01 ? 'bg-red-100 text-red-800' : 'bg-emerald-100 text-emerald-800'}`}>
                        {gb.balance > 0.01 ? 'Pending' : 'Cleared'}
                      </span>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>

        {/* Screen-Only Interactive Group Cards */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 no-print">
          {groupBreakdowns.map((gb, i) => {
            const Icon = gb.theme.icon
            const isSelected = selectedGroupFilter === String(gb.group?.id)
            const progress = gb.due > 0 ? Math.min(100, Math.round((gb.paid / gb.due) * 100)) : 100

            return (
              <div 
                key={gb.membership.id || i} 
                onClick={() => setSelectedGroupFilter(isSelected ? 'all' : String(gb.group?.id))}
                className={`p-3.5 rounded-xl border transition-all cursor-pointer relative group ${
                  isSelected 
                    ? 'border-[var(--accent)] bg-[var(--surface)] ring-2 ring-[var(--accent)]/20 shadow-md' 
                    : 'border-[var(--border)] bg-[var(--surface)] hover:border-[var(--accent)]/50 hover:shadow-sm'
                }`}
              >
                {/* Header: Group Name, Ticket No & Clearance Badge */}
                <div className="flex justify-between items-start gap-2 mb-2">
                  <div className="min-w-0 flex items-start gap-2.5">
                    {/* Visual Group Symbol Avatar */}
                    <div 
                      className="w-8 h-8 rounded-lg flex items-center justify-center shrink-0 border mt-0.5 shadow-sm"
                      style={{ 
                        background: gb.theme.bg, 
                        borderColor: gb.theme.border, 
                        color: gb.theme.color 
                      }}
                    >
                      <Icon size={16} strokeWidth={2.2} />
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-bold text-sm text-[var(--text)] truncate">
                          {gb.group?.name || 'Group'}
                        </span>
                        <span className="text-[11px] px-1.5 py-0.2 rounded font-mono font-semibold bg-[var(--surface2)] border border-[var(--border)] text-[var(--text2)]">
                          #{gb.ticketNo}
                        </span>
                      </div>
                      <div className="text-[11px] text-[var(--text3)] mt-0.5">
                        Monthly: <span className="font-medium text-[var(--text2)]">{fmt(gb.group?.monthly_contribution || 0)}</span> • {gb.paymentsCount} payments
                      </div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap text-[10px]">
                        {gb.paidMonths.length > 0 && (
                          <span className="font-mono font-bold text-emerald-700 bg-emerald-50 px-1 py-0.2 rounded border border-emerald-200">
                            Paid: {gb.paidMonths.length > 3 ? `M${gb.paidMonths[0]}–M${gb.paidMonths[gb.paidMonths.length - 1]} (${gb.paidMonths.length}m)` : gb.paidMonths.map(m => `M${m}`).join(', ')}
                          </span>
                        )}
                        {gb.pendingMonths.length > 0 && (
                          <span className="font-mono font-bold text-rose-700 bg-rose-50 px-1 py-0.2 rounded border border-rose-200">
                            Due: {gb.pendingMonths.length > 3 ? `M${gb.pendingMonths[0]}–M${gb.pendingMonths[gb.pendingMonths.length - 1]} (${gb.pendingMonths.length}m)` : gb.pendingMonths.map(m => `M${m}`).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <Badge variant={gb.balance > 0.01 ? 'danger' : 'success'} className="shrink-0 text-[10px]">
                    {gb.balance > 0.01 ? 'Due' : 'Cleared'}
                  </Badge>
                </div>

                {/* Progress Mini Bar */}
                <div className="w-full bg-[var(--surface2)] rounded-full h-1.5 mb-2.5 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-500"
                    style={{ 
                      width: `${progress}%`,
                      background: gb.balance > 0.01 ? gb.theme.color : '#10b981'
                    }}
                  />
                </div>

                {/* Due / Paid / Balance Grid */}
                <div className="grid grid-cols-3 gap-2 pt-2 border-t border-[var(--border)] text-xs">
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text3)] block font-medium">Billed Due</span>
                    <span className="font-bold text-[var(--text)]">{fmt(gb.due)}</span>
                  </div>
                  <div>
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text3)] block font-medium">Collected</span>
                    <span className="font-bold text-emerald-600">{fmt(gb.paid)}</span>
                  </div>
                  <div className="text-right">
                    <span className="text-[10px] uppercase tracking-wider text-[var(--text3)] block font-medium">Balance</span>
                    <span className={`font-bold ${gb.balance > 0.01 ? 'text-[var(--danger)]' : 'text-emerald-600'}`}>
                      {fmt(gb.balance)}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* Payment Ledger (Clubbed by Month, Group Clubbed, or All Transactions) */}
      <TableCard 
        title={
          <div className="flex items-center gap-2">
            <span>
              {ledgerViewMode === 'monthly' && 'Monthly Payment Summary'}
              {ledgerViewMode === 'group' && 'Group Clubbed Summary'}
              {ledgerViewMode === 'detailed' && 'Detailed Payment History'}
              {selectedGroupFilter !== 'all' ? ` (${groups.find(g => String(g.id) === selectedGroupFilter)?.name})` : ' (All Enrolled Groups)'}
            </span>
            {loadingPayments && <span className="text-xs font-normal opacity-60">(Updating...)</span>}
          </div>
        }
        actions={
          <div className="flex items-center gap-1 bg-[var(--surface2)] p-0.5 rounded-lg border border-[var(--border)] no-print">
            <button
              type="button"
              onClick={() => setLedgerViewMode('monthly')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                ledgerViewMode === 'monthly'
                  ? 'bg-[var(--surface)] text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              <Calendar size={13} />
              Monthly Clubbed
            </button>
            <button
              type="button"
              onClick={() => setLedgerViewMode('group')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                ledgerViewMode === 'group'
                  ? 'bg-[var(--surface)] text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              <FolderKanban size={13} />
              Group Clubbed
            </button>
            <button
              type="button"
              onClick={() => setLedgerViewMode('detailed')}
              className={`px-2.5 py-1 text-xs font-bold rounded-md transition-all flex items-center gap-1 ${
                ledgerViewMode === 'detailed'
                  ? 'bg-[var(--surface)] text-[var(--accent)] shadow-sm'
                  : 'text-[var(--text3)] hover:text-[var(--text)]'
              }`}
            >
              <ListFilter size={13} />
              All Transactions ({displayPayments.length})
            </button>
          </div>
        }
      >
        {ledgerViewMode === 'monthly' ? (
          /* Monthly Clubbed Table */
          <Table>
            <thead>
              <tr>
                <Th>Month</Th>
                <Th>Enrolled Groups Paid</Th>
                <Th>Transactions</Th>
                <Th>Payment Modes</Th>
                <Th right>Total Monthly Paid</Th>
              </tr>
            </thead>
            <tbody>
              {monthlyClubbedList.map(item => (
                <Tr key={item.key} className="break-inside-avoid">
                  <Td className="whitespace-nowrap font-bold text-[var(--text)]">
                    <span className="text-sm">{item.displayMonth}</span>
                    <span className="block text-[10px] text-[var(--text3)] font-normal">
                      Latest: {fmtDate(item.latestDate)}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1.5 py-1">
                      {item.breakdown.map((b, idx) => {
                        return (
                          <GroupBadge
                            key={idx}
                            groupName={b.groupName}
                            ticketNo={b.ticketNo}
                            amount={fmt(b.amount)}
                            theme={b.theme}
                            size="sm"
                          />
                        )
                      })}
                    </div>
                  </Td>
                  <Td>
                    <span className="text-xs font-medium text-[var(--text2)]">
                      {item.paymentCount} {item.paymentCount === 1 ? 'receipt' : 'receipts'}
                    </span>
                  </Td>
                  <Td>
                    <div className="flex flex-wrap gap-1">
                      {Array.from(item.modes).map(m => (
                        <Badge key={m} variant="info" className="text-[10px] uppercase">
                          {m}
                        </Badge>
                      ))}
                    </div>
                  </Td>
                  <Td right className="font-black text-sm text-emerald-600">
                    {fmt(item.totalAmount)}
                  </Td>
                </Tr>
              ))}
              {monthlyClubbedList.length === 0 && (
                <Tr>
                  <Td colSpan={5} className="text-center py-6 opacity-60">
                    No payments found for this selection.
                  </Td>
                </Tr>
              )}
            </tbody>
          </Table>
        ) : ledgerViewMode === 'group' ? (
          /* Group Clubbed Table */
          <Table>
            <thead>
              <tr>
                <Th>Group</Th>
                <Th>Ticket No</Th>
                <Th>Month Coverage</Th>
                <Th>Total Due</Th>
                <Th>Total Collected</Th>
                <Th>Balance</Th>
                <Th>Receipts</Th>
                <Th right>Clearance</Th>
              </tr>
            </thead>
            <tbody>
              {groupBreakdowns.map((gb, i) => {
                const Icon = gb.theme.icon
                const progress = gb.due > 0 ? Math.min(100, Math.round((gb.paid / gb.due) * 100)) : 100

                return (
                  <Tr key={gb.membership.id || i} className="break-inside-avoid">
                    <Td className="whitespace-nowrap font-bold text-[var(--text)]">
                      <div className="flex items-center gap-2">
                        <span 
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 border"
                          style={{ background: gb.theme.bg, borderColor: gb.theme.border, color: gb.theme.color }}
                        >
                          <Icon size={14} strokeWidth={2.2} />
                        </span>
                        <div>
                          <span className="font-bold text-sm block">{gb.group?.name || 'Group'}</span>
                          <span className="text-[11px] text-[var(--text3)] font-normal">
                            Monthly: {fmt(gb.group?.monthly_contribution || 0)}
                          </span>
                        </div>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-xs px-2 py-0.5 rounded font-mono font-semibold bg-[var(--surface2)] border border-[var(--border)] text-[var(--text2)]">
                        #{gb.ticketNo}
                      </span>
                    </Td>
                    <Td>
                      <div className="flex flex-col gap-1 max-w-[240px]">
                        {gb.paidMonths.length > 0 && (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] font-bold text-emerald-700 uppercase tracking-wider">Paid:</span>
                            <span className="text-xs font-mono font-bold text-emerald-700 bg-emerald-50 px-1.5 py-0.2 rounded border border-emerald-200">
                              {gb.paidMonths.length > 5 
                                ? `M${gb.paidMonths[0]}–M${gb.paidMonths[gb.paidMonths.length - 1]} (${gb.paidMonths.length} mos)` 
                                : gb.paidMonths.map(m => `M${m}`).join(', ')}
                            </span>
                          </div>
                        )}
                        {gb.pendingMonths.length > 0 ? (
                          <div className="flex items-center gap-1 flex-wrap">
                            <span className="text-[10px] font-bold text-rose-700 uppercase tracking-wider">Due:</span>
                            <span className="text-xs font-mono font-bold text-rose-700 bg-rose-50 px-1.5 py-0.2 rounded border border-rose-200">
                              {gb.pendingMonths.length > 4 
                                ? `M${gb.pendingMonths[0]}–M${gb.pendingMonths[gb.pendingMonths.length - 1]} (${gb.pendingMonths.length} mos)` 
                                : gb.pendingMonths.map(m => `M${m}`).join(', ')}
                            </span>
                          </div>
                        ) : (
                          <span className="text-[10px] font-bold text-emerald-700">✓ Up to date (M{gb.currentMonth})</span>
                        )}
                      </div>
                    </Td>
                    <Td className="font-bold">{fmt(gb.due)}</Td>
                    <Td className="font-bold text-emerald-600">{fmt(gb.paid)}</Td>
                    <Td className={`font-black ${gb.balance > 0.01 ? 'text-[var(--danger)]' : 'text-emerald-600'}`}>
                      {fmt(gb.balance)}
                    </Td>
                    <Td className="text-xs text-[var(--text2)]">
                      {gb.paymentsCount} payments
                    </Td>
                    <Td right>
                      <div className="flex flex-col items-end gap-1">
                        <Badge variant={gb.balance > 0.01 ? 'danger' : 'success'} className="text-[10px]">
                          {gb.balance > 0.01 ? `${progress}% Paid` : 'Cleared'}
                        </Badge>
                        <div className="w-20 bg-[var(--surface2)] rounded-full h-1 overflow-hidden">
                          <div 
                            className="h-full rounded-full"
                            style={{ 
                              width: `${progress}%`,
                              background: gb.balance > 0.01 ? 'var(--danger)' : '#10b981'
                            }}
                          />
                        </div>
                      </div>
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        ) : (
          /* Detailed Per-Transaction Table */
          <Table>
            <thead>
              <tr>
                <Th>Date</Th>
                <Th>Group</Th>
                <Th>Ticket</Th>
                <Th>For Month</Th>
                <Th>Mode</Th>
                <Th right>Amount Paid</Th>
              </tr>
            </thead>
            <tbody>
              {displayPayments.map(p => {
                const g = groups.find(x => x.id === p.group_id)
                const m = personMembers.find(mem => mem.id === p.member_id)
                const grpIdx = personMembers.findIndex(mem => mem.group_id === p.group_id)
                const theme = getGroupTheme(grpIdx >= 0 ? grpIdx : 0, g?.id)
                const Icon = theme.icon

                return (
                  <Tr key={p.id} className="break-inside-avoid">
                    <Td className="whitespace-nowrap font-medium">{fmtDate(p.created_at)}</Td>
                    <Td>
                      <div className="flex items-center gap-1.5">
                        <span 
                          className="w-5 h-5 rounded flex items-center justify-center shrink-0 border"
                          style={{ background: theme.bg, borderColor: theme.border, color: theme.color }}
                        >
                          <Icon size={12} />
                        </span>
                        <Link href={`/groups/${g?.id}`} className="hover:text-[var(--accent)] hover:underline transition-colors font-semibold">
                          {g?.name}
                        </Link>
                      </div>
                    </Td>
                    <Td>
                      <span className="text-xs px-1.5 py-0.5 rounded bg-[var(--surface2)] font-mono">
                        #{m?.ticket_no || '—'}
                      </span>
                    </Td>
                    <Td>{fmtMonth(p.month, g?.start_date)}</Td>
                    <Td><Badge variant="info">{p.mode}</Badge></Td>
                    <Td right className="font-semibold text-emerald-600">{fmt(p.amount)}</Td>
                  </Tr>
                )
              })}
              {displayPayments.length === 0 && (
                <Tr><Td colSpan={6} className="text-center py-6 opacity-60">No payments found for this selection.</Td></Tr>
              )}
            </tbody>
          </Table>
        )}
      </TableCard>

      {/* Print Footer Note */}
      <div className="only-print mt-8 pt-4 border-t border-slate-200 text-xs flex justify-between items-center text-slate-500">
        <div>This is a computer-generated statement of chit subscriptions and payments.</div>
        <div className="font-semibold">Authorized Signature: ___________________</div>
      </div>
    </div>
  )
}
