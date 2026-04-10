'use client'

import { fmt, fmtDate, fmtMonth, getToday, cn } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge } from '@/components/ui'
import Link from 'next/link'
import type { Group, Member, Auction, Payment } from '@/types'

// 1. Upcoming Pay
export function ReportUpcomingPay({ groups, members, auctions, payments }: any) {
  const balances = members.map((member: Member) => {
    const group = groups.find((g: Group) => g.id === member.group_id)
    if (!group || group.status === 'archived' || !['active', 'defaulter', 'foreman'].includes(member.status)) return null
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
      const due = Number(group.monthly_contribution) - (prevMonthAuc ? Number(prevMonthAuc.dividend || 0) : 0)
      const paid = memberPayments.filter((p: Payment) => p.month === month).reduce((s: number, p: Payment) => s + Number(p.amount), 0)
      mTotalDue += due
      if (due - paid > 0.01) mPending.push({ month, amount: due - paid })
    }
    const mTotalPaid = memberPayments.reduce((s: number, p: Payment) => s + Number(p.amount), 0)
    if (mTotalDue - mTotalPaid > 0.1) return { member, group, mOutstanding: mTotalDue - mTotalPaid, mPending }
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
    <TableCard title="Pending Collections (By Person)" subtitle={fmt(report.reduce((s,p)=>s+p.total,0)) + " total outstanding"}>
      <Table>
        <thead><tr><Th>Person</Th><Th>Group Breakdown</Th><Th right>Outstanding</Th></tr></thead>
        <tbody>
          {report.map((pData: any) => (
            <Tr key={pData.person.id}>
              <Td>
                <Link href={`/members/${pData.items[0]?.member.id}`} className="font-bold hover:text-[var(--accent)] hover:underline transition-colors line-clamp-1">
                  {pData.person.name}
                </Link>
                <div className="text-[10px] opacity-50">{pData.person.phone}</div>
              </Td>
              <Td>
                {pData.items.map((it: any) => (
                  <div key={it.member.id} className="text-[10px] flex justify-between bg-[var(--surface2)] p-1 rounded mb-1">
                    <span>{it.group.name} | {it.mPending.map((p:any)=>fmtMonth(p.month, it.group.start_date)).join(', ')}</span>
                    <span className="font-bold opacity-70">{fmt(it.mOutstanding)}</span>
                  </div>
                ))}
              </Td>
              <Td right className="text-lg font-black text-[var(--danger)]">{fmt(pData.total)}</Td>
            </Tr>
          ))}
        </tbody>
      </Table>
    </TableCard>
  )
}

// 2. Auction Schedule
export function ReportAuctionSched({ groups, auctions }: { groups: Group[], auctions: Auction[] }) {
  const active = groups.filter(g => g.status === 'active')
  return (
    <TableCard title="Upcoming Auction Schedule">
      <Table>
        <thead><tr><Th>Group</Th><Th>Duration</Th><Th>Completed</Th><Th>Next Auction</Th><Th>Status</Th></tr></thead>
        <tbody>
          {active.map(g => {
            const completed = auctions.filter(a => a.group_id === g.id).length
            return (
              <Tr key={g.id}>
                <Td>
                  <Link href={`/groups/${g.id}`} className="font-semibold hover:text-[var(--accent)] hover:underline transition-colors">
                    {g.name}
                  </Link>
                </Td>
                <Td>{g.duration} Months</Td>
                <Td>{completed}</Td>
                <Td>{completed < g.duration ? <strong>{fmtMonth(completed + 1, g.start_date)}</strong> : '—'}</Td>
                <Td>{completed >= g.duration ? <Badge variant="success">Finished</Badge> : <Badge variant="info">Ongoing</Badge>}</Td>
              </Tr>
            )
          })}
        </tbody>
      </Table>
    </TableCard>
  )
}

// 3. Group Enrollment
export function ReportGroupEnrollment({ groupId, members, groups, auctions }: { groupId: number, members: Member[], groups: Group[], auctions: Auction[] }) {
  const group = groups.find(g => g.id === groupId)
  const gMembers = members.filter(m => m.group_id === groupId)
  const clubMap = new Map<number, any>()
  gMembers.forEach(m => {
    const auc = auctions.find(a => a.group_id === groupId && a.winner_id === m.id)
    if (!clubMap.has(m.person_id)) clubMap.set(m.person_id, { person: m.persons, tickets: [{ id: m.id, no: m.ticket_no, won: !!auc, month: auc ? fmtMonth(auc.month, group?.start_date) : null }], hasWinner: !!auc })
    else {
      const existing = clubMap.get(m.person_id)
      existing.tickets.push({ id: m.id, no: m.ticket_no, won: !!auc, month: auc ? fmtMonth(auc.month, group?.start_date) : null })
      if (auc) existing.hasWinner = true
    }
  })
  const clubbed = Array.from(clubMap.values()).sort((a,b) => a.person?.name.localeCompare(b.person?.name))

  return (
    <TableCard title={`Enrollment: ${group?.name}`} subtitle={`${gMembers.length} tickets across ${clubbed.length} members`}>
      <Table>
        <thead><tr><Th>Name</Th><Th>Phone</Th><Th>Tickets</Th><Th>Won Month</Th><Th right>Count</Th></tr></thead>
        <tbody>
          {clubbed.map((item, idx) => (
            <Tr key={idx}>
              <Td>
                <Link href={`/members/${item.tickets[0].id || gMembers.find(m => m.person_id === item.person.id)?.id}`} className="font-semibold hover:text-[var(--accent)] hover:underline transition-colors">
                  {item.person?.name}
                </Link>
                {item.hasWinner && <Badge variant="accent" className="ml-2">Winner</Badge>}
              </Td>
              <Td className="font-mono text-xs">{item.person?.phone || '—'}</Td>
              <Td className="text-xs font-mono">
                {item.tickets.map((t:any) => <span key={t.no} className={cn("mr-2 px-1 rounded", t.won ? "bg-accent text-white" : "bg-[var(--surface2)]")}>#{t.no}</span>)}
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
