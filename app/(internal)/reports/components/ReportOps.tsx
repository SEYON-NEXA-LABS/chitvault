'use client'

import { fmt, fmtDate, fmtMonth, getToday, cn } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge } from '@/components/ui'
import Link from 'next/link'
import type { Group, Member, Auction, Payment } from '@/types'

/**
 * ReportUpcomingPay: Re-named to 'Upcoming & Pending Payments'
 * This focuses on members who have missed installments or have upcoming dues.
 */
export function ReportUpcomingPay({ groups, members, auctions, payments }: any) {
  const balances = members.map((member: Member) => {
    const group = groups.find((g: Group) => g.id === member.group_id)
    if (!group || group.status === 'archived' || !['active', 'defaulter', 'foreman'].includes(member.status)) return null
    
    // Confirmed auctions determine the "current" month
    const groupAuctions = auctions.filter((a: Auction) => a.group_id === member.group_id && a.status === 'confirmed')
    const latestMonth = groupAuctions.length
    
    // Estimate next auction month
    const nextDate = new Date(group.start_date || getToday())
    nextDate.setMonth(nextDate.getMonth() + latestMonth)
    const isDueNow = new Date() >= nextDate
    const currentMonth = Math.min(group.duration, isDueNow ? latestMonth + 1 : latestMonth)
    
    const memberPayments = payments.filter((p: Payment) => p.member_id === member.id)
    let mTotalDue = 0
    const mPending: any[] = []

    for (let month = 1; month <= currentMonth; month++) {
      const prevMonthAuc = groupAuctions.find((a: Auction) => a.month === month - 1)
      const due = Number(group.monthly_contribution) - (prevMonthAuc ? Number(prevMonthAuc.dividend || 0) : 0)
      const paid = memberPayments.filter((p: Payment) => p.month === month).reduce((s: number, p: Payment) => s + Number(p.amount), 0)
      mTotalDue += due
      if (due - paid > 0.1) mPending.push({ month, amount: due - paid })
    }

    const mTotalPaid = memberPayments.reduce((s: number, p: Payment) => s + Number(p.amount), 0)
    if (mTotalDue - mTotalPaid > 0.1) {
      return { member, group, mOutstanding: mTotalDue - mTotalPaid, mPending }
    }
    return null
  }).filter(Boolean)

  const personMap = new Map<number, any>()
  balances.forEach((item: any) => {
    const pId = item.member.person_id
    if (!personMap.has(pId)) personMap.set(pId, { person: item.member.persons, total: 0, items: [] })
    const pData = personMap.get(pId)
    pData.total += item.mOutstanding
    pData.items.push(item)
  })

  const report = Array.from(personMap.values()).sort((a,b) => b.total - a.total)

  return (
    <TableCard 
      title="Upcoming & Pending Payments" 
      subtitle={`${fmt(report.reduce((s,p)=>s+p.total,0))} total outstanding across all members`}
    >
      <Table>
        <thead><tr><Th>Person</Th><Th>Group Breakdown</Th><Th right>Outstanding</Th></tr></thead>
        <tbody>
          {report.map((pData: any) => (
            <Tr key={pData.person.id}>
              <Td>
                <div className="font-bold text-[var(--accent)]">{pData.person.name}</div>
                <div className="text-[10px] opacity-50">{pData.person.phone}</div>
              </Td>
              <Td>
                {pData.items.map((it: any) => (
                  <div key={it.member.id} className="text-[10px] flex justify-between bg-[var(--surface2)] p-1 rounded mb-1 border" style={{ borderColor: 'var(--border)' }}>
                    <span>{it.group.name} | {it.mPending.map((p:any)=>`M${p.month}`).join(', ')}</span>
                    <span className="font-bold opacity-70">{fmt(it.mOutstanding)}</span>
                  </div>
                ))}
              </Td>
              <Td right className="text-lg font-black text-[var(--danger)]">{fmt(pData.total)}</Td>
            </Tr>
          ))}
          {report.length === 0 && (
            <Tr><Td colSpan={3} className="text-center py-10 opacity-40 font-bold italic">No pending payments! All accounts clear.</Td></Tr>
          )}
        </tbody>
      </Table>
    </TableCard>
  )
}

/**
 * ReportAuctionSched: Visual timeline of upcoming auctions
 */
export function ReportAuctionSched({ groups, auctions }: { groups: Group[], auctions: Auction[] }) {
  const active = groups.filter(g => g.status === 'active')
  return (
    <TableCard title="Upcoming Auction Schedule">
      <Table>
        <thead><tr><Th>Group</Th><Th>Duration</Th><Th>Completed</Th><Th>Next Auction</Th><Th>Status</Th></tr></thead>
        <tbody>
          {active.map(g => {
            const completed = auctions.filter(a => a.group_id === g.id && a.status === 'confirmed').length
            return (
              <Tr key={g.id}>
                <Td>
                  <Link href={`/groups/${g.id}`} className="font-semibold hover:text-[var(--accent)] hover:underline transition-colors uppercase">
                    {g.name}
                  </Link>
                </Td>
                <Td className="font-mono text-xs">{g.duration} Months</Td>
                <Td className="font-bold">{completed}</Td>
                <Td>{completed < g.duration ? <strong className="text-[var(--accent)]">{fmtMonth(completed + 1, g.start_date)}</strong> : '—'}</Td>
                <Td>{completed >= g.duration ? <Badge variant="success">Finished</Badge> : <Badge variant="info">Ongoing</Badge>}</Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </TableCard>
  )
}

/**
 * ReportEnrollment: Group demographic breakdown
 */
export function ReportEnrollment({ groups, members, auctions, targetGroupId }: any) {
  const group = groups.find((g: Group) => g.id === targetGroupId)
  const gMembers = members.filter((m: Member) => m.group_id === targetGroupId).sort((a: any, b: any) => a.ticket_no - b.ticket_no)
  const clubbedMap = new Map<number, any>()
  
  gMembers.forEach((m: Member) => {
    const pId = m.person_id
    if (!clubbedMap.has(pId)) clubbedMap.set(pId, { person: m.persons, tickets: [], hasWinner: false })
    const entry = clubbedMap.get(pId)
    const win = auctions.find((a: Auction) => a.group_id === targetGroupId && a.winner_id === m.id)
    entry.tickets.push({ no: m.ticket_no, id: m.id, won: !!win, month: win?.month })
    if (win) entry.hasWinner = true
  })

  const clubbed = Array.from(clubbedMap.values())

  return (
    <TableCard title={`Enrollment: ${group?.name}`} subtitle={`${gMembers.length} tickets across ${clubbed.length} members`}>
      <Table>
        <thead><tr><Th>Name</Th><Th>Phone</Th><Th>Tickets</Th><Th>Won Month</Th><Th right>Count</Th></tr></thead>
        <tbody>
          {clubbed.map((item, idx) => (
            <Tr key={idx}>
              <Td>
                <div className="font-semibold">{item.person?.name}</div>
                {item.hasWinner && <Badge variant="accent" className="text-[9px] px-1 py-0">Winner</Badge>}
              </Td>
              <Td className="font-mono text-xs opacity-50">{item.person?.phone || '—'}</Td>
              <Td className="text-xs font-mono">
                {item.tickets.map((t:any) => <span key={t.no} className={cn("mr-2 px-1 rounded border", t.won ? "bg-[var(--accent)] text-white border-[var(--accent)]" : "bg-[var(--surface2)] border-[var(--border)]")}>#{t.no}</span>)}
              </Td>
              <Td className="text-xs font-bold text-[var(--accent)]">{item.tickets.filter((t:any)=>t.month).map((t:any)=>t.month).join(', ') || '—'}</Td>
              <Td right><Badge variant="gray">{item.tickets.length}</Badge></Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableCard>
  )
}
