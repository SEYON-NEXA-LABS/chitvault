import { getToday } from './index'
import type { Group, Member, Auction, Payment } from '@/types'

export type FinancialStatus = {
  totalDue: number
  totalPaid: number
  balance: number
  missedCount: number
  overallStatus: 'paid' | 'overdue' | 'current'
  streak: {
    month: number
    status: 'success' | 'danger' | 'info' | 'gray'
    due: number
    paid: number
  }[]
  dividends: number
  surplusShare: number
}

/**
 * Standardized calculation for member financial status across all chit schemes.
 */
export function getMemberFinancialStatus(
  member: Member,
  group: Group,
  auctions: Auction[],
  payments: Payment[]
): FinancialStatus {
  const isAcc = group.auction_scheme?.toUpperCase() === 'ACCUMULATION'

  const duration = group.duration
  const monthlyContr = Number(group.monthly_contribution)

  // Filter relevant auctions and payments
  const groupAucs = auctions.filter(a => {
    return Number(a.group_id) === Number(group.id) && a.status === 'confirmed'
  }).sort((a, b) => a.month - b.month)

  const memberPays = payments.filter(p => Number(p.member_id) === Number(member.id) && Number(p.group_id) === Number(group.id))

  const latestMonth = groupAucs.length > 0 ? Math.max(...groupAucs.map(a => Number(a.month))) : 0
  // Rule: Next month is due as soon as the previous one is finished (auction held)
  // But it only becomes "Overdue" (Red) after its own auction is held.
  const currentDueMonth = Math.min(duration, latestMonth + 1)

  let totalDue = 0
  let missedCount = 0
  let totalDividends = 0
  const streak: FinancialStatus['streak'] = []

  // Calculate actual total paid across all months (including prepayments)
  const totalPaidEver = memberPays.reduce((s, p) => s + Number(p.amount), 0)

  for (let m = 1; m <= duration; m++) {
    // Calculate what was due for this month
    // In Dividend scheme, Month M due depends on Month M-1 auction dividend
    let dividend = 0
    if (!isAcc && m > 1) {
      const prevAuc = groupAucs.find(a => a.month === m - 1)
      dividend = prevAuc ? Number(prevAuc.dividend || 0) : 0
    }

    const amountDue = monthlyContr - dividend
    const amountPaid = memberPays.filter(p => p.month === m).reduce((s, p) => s + Number(p.amount), 0)

    const hasAuctionHappened = m <= latestMonth
    const isCurrentMonth = m === currentDueMonth
    const isFuture = m > currentDueMonth

    const isFullyPaid = amountPaid >= (amountDue - 0.01)

    let status: FinancialStatus['streak'][0]['status'] = 'gray'
    if (isFullyPaid) {
      status = 'success'
    } else if (hasAuctionHappened) {
      status = 'danger'
      missedCount++
    } else if (isCurrentMonth) {
      status = 'info'
    } else if (isFuture) {
      status = 'gray'
    }

    if (hasAuctionHappened) {
      totalDividends += dividend
    }

    // NEW LOGIC: Determine if this month should contribute to the "Outstanding Balance"
    // Accumulation: Only past months (with auctions) are considered "Due" for balance purposes.
    // Dividend: Current month is also considered "Due" before the auction.
    const contributesToBalance = isAcc ? hasAuctionHappened : (m <= currentDueMonth)

    if (contributesToBalance) {
      totalDue += amountDue
    }

    streak.push({
      month: m,
      status,
      due: amountDue,
      paid: amountPaid
    })
  }

  const balance = Math.max(0, totalDue - totalPaidEver)
  const surplusShare = isAcc ? (Number(group.accumulated_surplus || 0) / (group.num_members || 1)) : 0

  let overallStatus: FinancialStatus['overallStatus'] = 'paid'
  if (missedCount > 0) overallStatus = 'overdue'
  else if (balance > 0.01) overallStatus = 'current'

  return {
    totalDue,
    totalPaid: totalPaidEver,
    balance,
    missedCount,
    overallStatus,
    streak,
    dividends: totalDividends,
    surplusShare
  }
}
