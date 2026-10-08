'use client'

import { fmt } from '@/lib/utils'
import { StatCard, TableCard, Table, Th, Td, Tr, Badge } from '@/components/ui'
import { GroupAvatar } from '@/components/ui/GroupBadge'
import Link from 'next/link'
import type { Group, Auction, Payment } from '@/types'

// 1. Cash Flow
export function ReportCashFlow({ payments = [], auctions = [], groups = [] }: { payments: Payment[], auctions: Auction[], groups?: Group[] }) {
  const totalCollected = payments.reduce((s, p) => s + Number(p.amount || 0), 0)
  const totalPaidOut = auctions.reduce((s, a) => s + Number(a.net_payout || a.payout_amount || 0), 0)
  const netFlow = totalCollected - totalPaidOut

  // Monthly breakdown map (combining monthly collections vs auction disbursements)
  const monthlyFlowMap = new Map<string, {
    key: string
    displayMonth: string
    inflow: number
    outflow: number
    inflowCount: number
    outflowCount: number
  }>()

  // 1. Process payment inflows
  payments.forEach(p => {
    const rawDate = p.payment_date || p.created_at
    const d = new Date(rawDate)
    const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear()
    const monthIdx = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth()
    const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const displayMonth = `${monthNames[monthIdx]} ${year}`

    if (!monthlyFlowMap.has(key)) {
      monthlyFlowMap.set(key, { key, displayMonth, inflow: 0, outflow: 0, inflowCount: 0, outflowCount: 0 })
    }
    const entry = monthlyFlowMap.get(key)!
    entry.inflow += Number(p.amount || 0)
    entry.inflowCount += 1
  })

  // 2. Process auction prize disbursements (outflows)
  auctions.forEach(a => {
    const rawDate = a.payout_date || a.created_at
    const d = new Date(rawDate)
    const year = isNaN(d.getTime()) ? new Date().getFullYear() : d.getFullYear()
    const monthIdx = isNaN(d.getTime()) ? new Date().getMonth() : d.getMonth()
    const key = `${year}-${String(monthIdx + 1).padStart(2, '0')}`

    const monthNames = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    const displayMonth = `${monthNames[monthIdx]} ${year}`

    if (!monthlyFlowMap.has(key)) {
      monthlyFlowMap.set(key, { key, displayMonth, inflow: 0, outflow: 0, inflowCount: 0, outflowCount: 0 })
    }
    const entry = monthlyFlowMap.get(key)!
    const payoutAmt = Number(a.net_payout || a.payout_amount || 0)
    entry.outflow += payoutAmt
    if (payoutAmt > 0) entry.outflowCount += 1
  })

  const sortedMonthlyFlow = Array.from(monthlyFlowMap.values()).sort((a, b) => b.key.localeCompare(a.key))

  return (
    <div className="space-y-6">
      {/* Overview Stat Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <StatCard label="Total Inflow (Collections)" value={fmt(totalCollected)} color="success" sub={`${payments.length} receipts processed`} />
        <StatCard label="Total Outflow (Disbursements)" value={fmt(totalPaidOut)} color="danger" sub={`${auctions.filter(a => Number(a.net_payout || a.payout_amount || 0) > 0).length} prize payouts issued`} />
        <StatCard 
          label="Net Liquid Flow" 
          value={fmt(netFlow)} 
          color={netFlow >= 0 ? 'success' : 'danger'} 
          sub={netFlow >= 0 ? 'Positive liquidity reserve' : 'Outflow exceeds collections'}
        />
      </div>

      {/* Monthly Timeline Breakdown Table */}
      <TableCard title="Monthly Cash Flow Statement" subtitle="Timeline of member subscription collections vs prize disbursements">
        <Table>
          <thead>
            <tr>
              <Th>Month</Th>
              <Th right>Cash Inflow (Collections)</Th>
              <Th right>Cash Outflow (Disbursements)</Th>
              <Th right>Net Monthly Position</Th>
              <Th right>Flow Ratio</Th>
            </tr>
          </thead>
          <tbody>
            {sortedMonthlyFlow.map(row => {
              const diff = row.inflow - row.outflow
              const ratio = row.outflow > 0 ? ((row.inflow / row.outflow) * 100).toFixed(0) : '100'
              return (
                <Tr key={row.key}>
                  <Td className="font-bold text-sm text-[var(--text)]">
                    {row.displayMonth}
                  </Td>
                  <Td right>
                    <div className="font-bold text-sm text-emerald-700 font-mono">
                      +{fmt(row.inflow)}
                    </div>
                    <div className="text-[10px] text-[var(--text3)] font-medium">
                      {row.inflowCount} {row.inflowCount === 1 ? 'collection' : 'collections'}
                    </div>
                  </Td>
                  <Td right>
                    <div className="font-bold text-sm text-rose-700 font-mono">
                      -{fmt(row.outflow)}
                    </div>
                    <div className="text-[10px] text-[var(--text3)] font-medium">
                      {row.outflowCount} {row.outflowCount === 1 ? 'payout' : 'payouts'}
                    </div>
                  </Td>
                  <Td right className="font-black text-sm font-mono">
                    <span className={diff >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
                      {diff >= 0 ? `+${fmt(diff)}` : `-${fmt(Math.abs(diff))}`}
                    </span>
                  </Td>
                  <Td right>
                    <Badge variant={diff >= 0 ? 'success' : 'danger'} className="text-[10px] font-bold">
                      {diff >= 0 ? `Surplus (${ratio}%)` : `Deficit (${ratio}%)`}
                    </Badge>
                  </Td>
                </Tr>
              )
            })}
            {sortedMonthlyFlow.length === 0 && (
              <Tr>
                <Td colSpan={5} className="py-12 text-center text-sm opacity-60">
                  No collection or payout transactions recorded for this period.
                </Td>
              </Tr>
            )}
          </tbody>
        </Table>
      </TableCard>
    </div>
  )
}

// 2. Member Benefits
export function ReportMemberBenefits({ groups = [], auctions = [], term }: { groups: Group[], auctions: Auction[], term: any }) {
  // Confirmed auctions
  const confirmedAucs = auctions.filter(a => a.status === 'confirmed')
  
  // Total member benefits: sum of all dividends distributed + accumulated surplus
  const totalDividends = confirmedAucs.reduce((s, a) => s + Number(a.dividend || 0), 0)
  const totalDiscounts = confirmedAucs.reduce((s, a) => s + Number(a.auction_discount || 0), 0)
  const totalSurplus = groups.reduce((s, g) => s + Number(g.accumulated_surplus || 0), 0)
  const totalBenefitPool = totalDividends > 0 ? totalDividends : (totalDiscounts > 0 ? totalDiscounts : totalSurplus)

  const accGroups = groups.filter(g => g.auction_scheme === 'ACCUMULATION')
  // Group all other dividend/benefit sharing schemes together
  const divGroups = groups.filter(g => g.auction_scheme !== 'ACCUMULATION')

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <StatCard 
          label="Total Member Benefits Distributed" 
          value={fmt(totalDividends)} 
          color="success" 
        />
        <StatCard 
          label="Total Auction Discounts" 
          value={fmt(totalDiscounts)} 
          color="accent" 
        />
        <StatCard 
          label="Accumulated Group Surplus" 
          value={fmt(totalSurplus)} 
          color="info" 
        />
      </div>

      {divGroups.length > 0 && (
        <TableCard 
          title="Dividend & Direct Savings Breakdown" 
          subtitle="Direct savings distributed to members through auction discount sharing."
        >
          <Table>
            <thead>
              <tr>
                <Th>Group</Th>
                <Th right>Auctions Held</Th>
                <Th right>Total Dividends</Th>
                <Th right>Avg per Member</Th>
                <Th right>Effective Yield %</Th>
              </tr>
            </thead>
            <tbody>
              {divGroups.map(g => {
                const aucs = confirmedAucs.filter(a => a.group_id === g.id)
                const groupDivs = aucs.reduce((s, a) => s + Number(a.dividend || 0), 0)
                const numMembers = Number(g.num_members) || 1
                const monthlyContr = Number(g.monthly_contribution) || 0
                const totalContributions = aucs.length * numMembers * monthlyContr
                
                // Safe yield percentage: avoid division by zero or NaN
                const yieldPct = totalContributions > 0 ? (groupDivs / totalContributions) * 100 : 0
                const avgPerMember = numMembers > 0 ? groupDivs / numMembers : 0

                return (
                  <Tr key={g.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <GroupAvatar groupId={g.id} groupName={g.name} size={24} iconSize={12} />
                        <Link href={`/groups/${g.id}`} className="font-bold hover:text-[var(--accent)] hover:underline transition-colors">
                          {g.name}
                        </Link>
                      </div>
                    </Td>
                    <Td right>
                      <Badge variant="gray">{aucs.length} / {g.duration}</Badge>
                    </Td>
                    <Td right className="font-black text-[var(--text-sm)] num-pos">
                      {fmt(groupDivs)}
                    </Td>
                    <Td right className="font-mono text-xs">
                      {fmt(avgPerMember)}
                    </Td>
                    <Td right className="font-mono font-bold text-xs num-pos">
                      {yieldPct > 0 ? `${yieldPct.toFixed(2)}%` : '0.00%'}
                    </Td>
                  </Tr>
                )
              })}
            </tbody>
          </Table>
        </TableCard>
      )}

      {accGroups.length > 0 && (
        <TableCard 
          title="Accumulation & Surplus Analysis" 
          subtitle="Fixed installment groups where auction discounts are pooled into surplus."
        >
          <Table>
            <thead>
              <tr>
                <Th>Group</Th>
                <Th right>Auctions Held</Th>
                <Th right>Accumulated Surplus</Th>
                <Th right>Per Member Share</Th>
                <Th right>Surplus ROI %</Th>
              </tr>
            </thead>
            <tbody>
              {accGroups.map(g => {
                const aucs = confirmedAucs.filter(a => a.group_id === g.id)
                const surplus = Number(g.accumulated_surplus) || 0
                const numMembers = Number(g.num_members) || 1
                const monthlyContr = Number(g.monthly_contribution) || 0
                const totalContributions = aucs.length * numMembers * monthlyContr
                const roi = totalContributions > 0 ? (surplus / totalContributions) * 100 : 0
                const perMemberShare = numMembers > 0 ? surplus / numMembers : 0

                return (
                  <Tr key={g.id}>
                    <Td>
                      <div className="flex items-center gap-2">
                        <GroupAvatar groupId={g.id} groupName={g.name} size={24} iconSize={12} />
                        <Link href={`/groups/${g.id}`} className="font-bold hover:text-[var(--accent)] hover:underline transition-colors">
                          {g.name}
                        </Link>
                      </div>
                    </Td>
                    <Td right>
                      <Badge variant="gray">{aucs.length} / {g.duration}</Badge>
                    </Td>
                    <Td right className="font-black text-[var(--text-sm)] num-pos">
                      {fmt(surplus)}
                    </Td>
                    <Td right className="font-mono text-xs">
                      {fmt(perMemberShare)}
                    </Td>
                    <Td right className="font-mono font-bold text-xs num-pos">
                      {roi > 0 ? `${roi.toFixed(2)}%` : '0.00%'}
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
