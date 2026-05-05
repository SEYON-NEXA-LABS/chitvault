'use client'

import { fmt, fmtMonth } from '@/lib/utils'
import { TableCard, Table, Th, Td, Tr, Badge } from '@/components/ui'
import Link from 'next/link'
import type { Group, Member, Auction, Payment } from '@/types'

export function ReportGroupLedger({ groups, groupId, members, auctions, payments, term }: { groups: Group[], groupId: number, members: Member[], auctions: Auction[], payments: Payment[], term: any }) {
  const grpAuctions = auctions.filter(a => a.group_id === groupId).sort((a,b) => a.month - b.month)
  const grpPayments = payments.filter(p => p.group_id === groupId)
  const g = groups.find(x => x.id === groupId)
  
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
                <Td>
                  {w ? (
                    <Link href={`/members/${w.person_id}`} className="hover:text-[var(--accent)] hover:underline transition-colors">
                      👑 {w.persons?.name || 'Member'}
                    </Link>
                  ) : (
                    '—'
                  )}
                </Td>
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
