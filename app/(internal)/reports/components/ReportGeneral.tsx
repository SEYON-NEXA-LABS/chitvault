'use client'

import { fmt } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge } from '@/components/ui'
import type { Group, Auction, Payment } from '@/types'

// 1. Cash Flow
export function ReportCashFlow({ payments, auctions }: { payments: Payment[], auctions: Auction[] }) {
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount), 0)
  const totalPaidOut = auctions.reduce((s, a) => s + Number(a.net_payout || a.payout_amount || 0), 0)
  const netFlow = totalCollected - totalPaidOut
  return (
    <>
      <div className="grid grid-cols-3 gap-4 mb-4">
        <StatCard label="Total Inflow" value={fmt(totalCollected)} color="success" />
        <StatCard label="Total Outflow" value={fmt(totalPaidOut)} color="danger" />
        <StatCard label="Net Cash Flow" value={fmt(netFlow)} color={netFlow >= 0 ? 'success' : 'danger'} />
      </div>
      <div className="p-4 rounded-xl border mb-5 text-sm opacity-60">
        Cash flow represents liquid collections vs payouts.
      </div>
    </>
  )
}

// 2. Member Benefits
export function ReportMemberBenefits({ groups, auctions, term }: { groups: Group[], auctions: Auction[], term: any }) {
  const accGroups = groups.filter(g => g.auction_scheme === 'ACCUMULATION')
  const divGroups = groups.filter(g => g.auction_scheme === 'DIVIDEND_SHARE')
  const totalWealth = auctions.filter(a => a.status === 'confirmed').reduce((s, a) => s + Number(a.dividend || a.auction_discount || 0), 0)

  return (
    <div className="space-y-6">
      <StatCard label="Total Member Benefits Realized" value={fmt(totalWealth)} color="success" />
      {accGroups.length > 0 && <TableCard title="Accumulation Analysis">
        <Table>
          <thead><tr><Th>Group</Th><Th right>Total Surplus</Th><Th right>ROI %</Th></tr></thead>
          <tbody>
            {accGroups.map(g => {
              const aucs = auctions.filter(a => a.group_id === g.id && a.status === 'confirmed')
              const roi = (g.accumulated_surplus / (aucs.length * g.num_members * g.monthly_contribution || 1) * 100)
              return (
                <Tr key={g.id}><Td>{g.name}</Td><Td right>{fmt(g.accumulated_surplus)}</Td><Td right>{roi.toFixed(2)}%</Td></Tr>
              )
            })}
          </tbody>
        </Table>
      </TableCard>}
      {divGroups.length > 0 && <TableCard title="Dividend Performance">
        <Table>
          <thead><tr><Th>Group</Th><Th right>Total Dividends</Th><Th right>Yield %</Th></tr></thead>
          <tbody>
            {divGroups.map(g => {
              const aucs = auctions.filter(a => a.group_id === g.id && a.status === 'confirmed')
              const totalDiv = aucs.reduce((s, a) => s + Number(a.dividend || 0), 0)
              const roi = (totalDiv / (aucs.length * g.num_members * g.monthly_contribution || 1) * 100)
              return (
                <Tr key={g.id}><Td>{g.name}</Td><Td right>{fmt(totalDiv)}</Td><Td right>{roi.toFixed(2)}%</Td></Tr>
              )
            })}
          </tbody>
        </Table>
      </TableCard>}
    </div>
  )
}
