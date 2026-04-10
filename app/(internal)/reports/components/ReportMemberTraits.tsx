'use client'

import { useState } from 'react'
import { fmt, fmtDate, fmtMonth, getToday } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge } from '@/components/ui'
import Link from 'next/link'
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
                  <Link href={`/members/${m.id}`} className="hover:underline transition-colors">
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

// 2. Member History
export function ReportMemberHistory({ memberId, members, groups, payments, auctions }: { memberId: number, members: Member[], groups: Group[], payments: Payment[], auctions: Auction[] }) {
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
                   <Td>
                     <Link href={`/groups/${g?.id}`} className="hover:text-[var(--accent)] hover:underline transition-colors">
                       {g?.name}
                     </Link>
                   </Td>
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
