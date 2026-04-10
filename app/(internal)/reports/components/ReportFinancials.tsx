'use client'

import { useMemo } from 'react'
import { fmt, fmtDate, fmtMonth, getToday } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge } from '@/components/ui'
import Link from 'next/link'
import type { Group, Member, Auction, Payment, ForemanCommission } from '@/types'

// 1. PNL
export function ReportPNL({ groups, commissions, t, term }: { groups: Group[], commissions: ForemanCommission[], t: any, term: any }) {
  const totalIncome = commissions.reduce((s, c) => s + Number(c.commission_amt), 0)
  const potentialTotal = groups.reduce((sum, g) => {
    const realized = commissions.filter(c => c.group_id === g.id).reduce((s, c) => s + Number(c.commission_amt), 0)
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

      <TableCard title={term.isAccOnly ? 'Firm Revenue Statement' : t('report_pnl_title')} subtitle="Detailed breakdown of commissions earned.">
        <Table>
          <thead><tr><Th>{t('group_name')}</Th><Th>Rate</Th><Th right>Realized Income</Th><Th right>Cycles</Th></tr></thead>
          <tbody>
            {groups.map(g => {
              const groupComms = commissions.filter(c => c.group_id === g.id)
              const inc = groupComms.reduce((s, c) => s + Number(c.commission_amt), 0)
              return (
                <Tr key={g.id}>
                  <Td>
                    <Link href={`/groups/${g.id}`} className="font-bold hover:text-[var(--accent)] hover:underline transition-colors">
                      {g.name}
                    </Link>
                  </Td>
                  <Td className="text-xs opacity-60">
                    {g.commission_type === 'percent_of_chit' ? `${g.commission_value}% of Chit` : `Fixed ₹${g.commission_value}`}
                  </Td>
                  <Td right className="font-black text-[var(--success)]">{fmt(inc)}</Td>
                  <Td right><Badge variant="gray">{groupComms.length} / {g.duration}</Badge></Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </TableCard>
    </>
  )
}

// 2. Today Collection
export function ReportTodayCollection({ payments, members, groups, stats }: { payments: Payment[], members: Member[], groups: Group[], stats?: any }) {
  const today = getToday()
  const todayPayments = payments.filter(p => p.payment_date === today)
  
  // Use server-side stats if provided, otherwise fallback to array reduction
  const grandTotal = stats?.collectedToday ?? todayPayments.reduce((s, p) => s + Number(p.amount), 0)

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <StatCard label="Today's Total" value={fmt(grandTotal)} color="info" sub="Total received today" />
        <StatCard label="Cash Total" value={fmt(todayPayments.filter(p => p.mode === 'Cash').reduce((s, p) => s + Number(p.amount), 0))} color="accent" />
        <StatCard label="UPI Total" value={fmt(todayPayments.filter(p => p.mode === 'UPI').reduce((s, p) => s + Number(p.amount), 0))} color="success" />
        <StatCard label="Bank Total" value={fmt(todayPayments.filter(p => p.mode === 'Bank Transfer').reduce((s, p) => s + Number(p.amount), 0))} color="info" />
      </div>
      <TableCard title="Today's Collections" subtitle={`Showing ${todayPayments.length} transactions`}>
        <Table>
          <thead><tr><Th>Time</Th><Th>Member</Th><Th>Group</Th><Th right>Amount</Th></tr></thead>
          <tbody>
            {todayPayments.map(p => {
              const m = members.find(x => x.id === p.member_id)
              const g = groups.find(x => x.id === p.group_id)
              return (
                <Tr key={p.id}>
                  <Td className="text-xs opacity-50">{new Date(p.created_at).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}</Td>
                  <Td>
                    <Link href={`/members/${m?.id}`} className="font-semibold hover:text-[var(--accent)] hover:underline transition-colors">
                      {m?.persons?.name || 'Unknown'}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/groups/${g?.id}`} className="text-xs hover:text-[var(--accent)] hover:underline transition-colors">
                      {g?.name || '—'}
                    </Link>
                  </Td>
                  <Td right className="font-mono font-bold text-[var(--success)]">{fmt(p.amount)}</Td>
                </Tr>
              )
            })}
            {todayPayments.length === 0 && <Tr><Td colSpan={4} className="text-center py-5">No collections yet.</Td></Tr>}
          </tbody>
        </Table>
      </TableCard>
    </div>
  )
}
