import type { Group, Member, Auction, Payment } from '@/types'

// ── Types ─────────────────────────────────────────────────────

export type MonthStatus = 'success' | 'danger' | 'info' | 'gray'

export type StreakEntry = {
  month: number
  status: MonthStatus
  due: number
  paid: number
  isAdvance: boolean
}

export type FinancialStatus = {
  totalDue: number
  totalPaid: number
  balance: number
  missedCount: number
  overallStatus: 'paid' | 'overdue' | 'current'
  streak: StreakEntry[]
  dividends: number
  surplusShare: number
}

// ── Constants ─────────────────────────────────────────────────

/**
 * Floating-point tolerance for "fully paid" checks.
 * Payments within 1 paisa of the due amount are treated as settled.
 */
const PAID_TOLERANCE = 0.01

// ── Helpers ───────────────────────────────────────────────────

/** Safely coerce any DB value to a number. */
function toNum(v: unknown): number {
  return Number(v ?? 0)
}

/** Build a map of month → total paid for a member in a group. */
function buildPaidByMonth(payments: Payment[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const p of payments) {
    const month = p.month
    map.set(month, (map.get(month) ?? 0) + toNum(p.amount))
  }
  return map
}

/**
 * Build a map of auction month → dividend amount.
 * Only includes confirmed auctions.
 */
function buildDividendByMonth(auctions: Auction[]): Map<number, number> {
  const map = new Map<number, number>()
  for (const a of auctions) {
    if (a.status === 'confirmed') {
      map.set(a.month, toNum(a.dividend))
    }
  }
  return map
}

// ── Core export ───────────────────────────────────────────────

/**
 * Compute a member's full financial status for a given group.
 *
 * Caller contract:
 *   - `auctions` may contain auctions from multiple groups; this
 *     function filters to the relevant group internally.
 *   - `payments` may contain payments from multiple groups; same.
 *
 * Scheme behaviour:
 *   - DIVIDEND:      each month's due = monthlyContribution − previous month's dividend
 *   - ACCUMULATION:  each month's due = monthlyContribution (flat); surplus distributed at end
 */
export function getMemberFinancialStatus(
  member: Member,
  group: Group,
  auctions: Auction[],
  payments: Payment[]
): FinancialStatus {
  const isAcc = group.auction_scheme?.toUpperCase() === 'ACCUMULATION'
  const duration = group.duration
  const monthlyContr = toNum(group.monthly_contribution)

  // ── Scope inputs to this group & member ──────────────────────
  const groupAucs = auctions
    .filter(a => toNum(a.group_id) === toNum(group.id) && a.status === 'confirmed')
    .sort((a, b) => a.month - b.month)

  const memberPays = payments.filter(
    p => toNum(p.member_id) === toNum(member.id) && toNum(p.group_id) === toNum(group.id)
  )

  // ── Pre-computed lookup maps (O(1) per month in the loop) ────
  const paidByMonth = buildPaidByMonth(memberPays)
  const dividendByMonth = buildDividendByMonth(groupAucs)

  // ── Derive timeline boundaries ────────────────────────────────
  const latestMonth = groupAucs.length > 0 ? Math.max(...groupAucs.map(a => a.month)) : 0
  // Next month becomes due as soon as the previous auction is held,
  // but it only turns "overdue" (danger) after its own auction runs.
  const currentDueMonth = Math.min(duration, latestMonth + 1)

  // Total ever paid (including advances for future months)
  const totalPaidEver = memberPays.reduce((sum, p) => sum + toNum(p.amount), 0)

  // ── Per-month loop ────────────────────────────────────────────
  let totalDue = 0
  let missedCount = 0
  let totalDividends = 0
  const streak: StreakEntry[] = []

  for (let m = 1; m <= duration; m++) {
    // Dividend scheme: month M's due is reduced by month M-1's dividend
    const dividend = (!isAcc && m > 1) ? (dividendByMonth.get(m - 1) ?? 0) : 0
    const amountDue = monthlyContr - dividend
    const amountPaid = paidByMonth.get(m) ?? 0

    const hasAuctionHappened = m <= latestMonth
    const isCurrentMonth = m === currentDueMonth
    const isFullyPaid = amountPaid >= amountDue - PAID_TOLERANCE

    // Determine display status for this month's streak cell
    let status: MonthStatus = 'gray'
    if (isFullyPaid) {
      status = 'success'
    } else if (hasAuctionHappened) {
      status = 'danger'
      missedCount++
    } else if (isCurrentMonth) {
      status = 'info'
    }
    // future months remain 'gray' (default)

    // Accumulate dividends only for months where the auction has run
    if (hasAuctionHappened) {
      totalDividends += dividend
    }

    // Both schemes include the current month in the outstanding balance
    // to support pre-payment tracking and partial collections.
    if (m <= currentDueMonth) {
      totalDue += amountDue
    }

    streak.push({
      month: m,
      status,
      due: amountDue,
      paid: amountPaid,
      isAdvance: amountPaid > 0 && !hasAuctionHappened,
    })
  }

  // ── Final aggregates ──────────────────────────────────────────
  const balance = Math.max(0, totalDue - totalPaidEver)
  const surplusShare = isAcc
    ? toNum(group.accumulated_surplus) / (group.num_members || 1)
    : 0

  let overallStatus: FinancialStatus['overallStatus'] = 'paid'
  if (missedCount > 0) overallStatus = 'overdue'
  else if (balance > PAID_TOLERANCE) overallStatus = 'current'

  return {
    totalDue,
    totalPaid: totalPaidEver,
    balance,
    missedCount,
    overallStatus,
    streak,
    dividends: totalDividends,
    surplusShare,
  }
}
