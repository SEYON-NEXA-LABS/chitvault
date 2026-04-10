'use client'

import { useMemo } from 'react'
import { fmt, fmtDate, fmtMonth, cn } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge } from '@/components/ui'
import Link from 'next/link'
import type { Group, Member, Auction, Payment } from '@/types'
import { getMemberFinancialStatus } from '@/lib/utils/chitLogic'

// 1. Winners
export function ReportWinners({ auctions, groups, members, filter, onFilterChange }: { auctions: Auction[], groups: Group[], members: Member[], filter: string, onFilterChange: (v: any) => void }) {
  const wonAucs = auctions.filter(a => {
    if (a.winner_id == null) return false
    if (filter === 'pending') return !a.is_payout_settled
    if (filter === 'settled') return a.is_payout_settled
    return true
  }).sort((a,b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  
  return (
    <div className="space-y-4">
      <TableCard title="Auction Winners">
        <Table>
          <thead><tr><Th>Date</Th><Th>Winner</Th><Th>Group</Th><Th right>Payout</Th><Th>Status</Th></tr></thead>
          <tbody>
            {wonAucs.map(a => {
              const m = members.find(x => x.id === a.winner_id)
              const g = groups.find(x => x.id === a.group_id)
              return (
                <Tr key={a.id}>
                  <Td>{fmtDate(a.created_at)}</Td>
                  <Td>
                    <Link href={`/members/${m?.id}`} className="font-semibold hover:text-[var(--accent)] hover:underline transition-colors">
                      👑 {m?.persons?.name || 'Unknown'}
                    </Link>
                  </Td>
                  <Td>
                    <Link href={`/groups/${g?.id}`} className="hover:text-[var(--accent)] hover:underline transition-colors">
                      {g?.name}
                    </Link>
                  </Td>
                  <Td right className="font-mono font-bold text-success-600">{fmt(a.net_payout || a.auction_discount)}</Td>
                  <Td>{a.is_payout_settled ? <Badge variant="success">✓ Settled</Badge> : <Badge variant="danger">Pending</Badge>}</Td>
                </Tr>
              )
            })}
          </tbody>
        </Table>
      </TableCard>
    </div>
  )
}

// 2. Winner Intelligence
export function ReportWinnerIntelligence({ auctions, groups, members, payments }: { auctions: Auction[], groups: Group[], members: Member[], payments: Payment[] }) {
  const confirmed = auctions.filter(a => a.status === 'confirmed' && a.winner_id != null)
  const insights = useMemo(() => {
    const personAgg = new Map<number, any>()
    confirmed.forEach(a => {
      const g = groups.find(gx => gx.id === a.group_id)
      const m = members.find(mx => mx.id === a.winner_id)
      if (!g || !m) return
      const isEarly = a.month <= (g.duration / 4)
      const pId = m.person_id
      if (!personAgg.has(pId)) {
        personAgg.set(pId, { person: m.persons, wins: [], totalDiscount: 0, earlyBirdCount: 0, health: 'success' })
      }
      const node = personAgg.get(pId)
      node.wins.push({ auction: a, group: g, isEarly })
      node.totalDiscount += Number(a.auction_discount)
      if (isEarly) node.earlyBirdCount++
      const status = getMemberFinancialStatus(m, g, confirmed.filter(ax => ax.group_id === g.id), payments.filter(px => px.member_id === m.id))
      if (status.balance > 0.01) node.health = 'danger'
    })
    return Array.from(personAgg.values()).sort((a,b) => b.totalDiscount - a.totalDiscount)
  }, [confirmed, groups, members, payments])

  return (
    <div className="space-y-6">
      <StatCard label="High-Risk Borrowers (Arrears)" value={insights.filter(p => p.health === 'danger').length} color="danger" />
      <TableCard title="Winner Intelligence Registry">
        <Table>
          <thead><tr><Th>Individual</Th><Th className="text-center">Early Wins</Th><Th right>Total Bids</Th><Th right>Health</Th></tr></thead>
          <tbody>
            {insights.slice(0, 15).map(pData => (
              <Tr key={pData.person.id}>
                <Td>
                  <Link href={`/members/${insights.find(idx => idx.person.id === pData.person.id)?.wins[0]?.auction.winner_id}`} className="font-bold hover:text-[var(--accent)] hover:underline transition-colors">
                    {pData.person.name}
                  </Link>
                </Td>
                <Td className="text-center">{pData.earlyBirdCount > 0 ? <Badge variant="danger">{pData.earlyBirdCount}</Badge> : '—'}</Td>
                <Td right className="font-mono font-black">{fmt(pData.totalDiscount)}</Td>
                <Td right><Badge variant={pData.health === 'success' ? 'success' : 'danger'}>{pData.health === 'success' ? 'Healthy' : 'Arrears'}</Badge></Td>
              </Tr>
            ))}
          </tbody>
        </Table>
      </TableCard>
    </div>
  )
}
