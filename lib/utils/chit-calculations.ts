/**
 * Chit Fund Auction Schemes & Calculations
 * 
 * Based on the core arithmetic of the Chit Funds Act, 1982.
 * This file provides pure functions for calculating payouts,
 * dividends, foreman commissions, and early closure triggers
 * across 8 different scheme types.
 */

// ── Types & Enums ─────────────────────────────────────────────────────────────

export type AuctionScheme =
  | 'DIVIDEND_SHARE'       // Scheme 1: Standard Model
  | 'ACCUMULATION'         // Scheme 2: Surplus Model
  | 'LOTTERY'              // Scheme 3: Random Draw (Guaranteed return)
  | 'FIXED_ROTATION'       // Scheme 4: Pre-Assigned Order
  | 'SEALED_TENDER'        // Scheme 5: Blind Auction
  | 'BOUNDED_AUCTION'      // Scheme 6: Bid Cap and Floor
  | 'HYBRID_SPLIT'         // Scheme 7: Part Dividend, Part Surplus
  | 'STEPPED_INSTALLMENT'; // Scheme 8: Escalating Chit

export type CommissionModel =
  | 'POT_PERCENTAGE'       // Standard: % of Pot
  | 'DISCOUNT_PERCENTAGE'  // High-competition: % of Discount
  | 'PAYOUT_PERCENTAGE'    // Accumulation: % of Winner Payout
  | 'FIXED_AMOUNT';        // Informal: Flat ₹ fee

export type SchemeConfig = {
  dividendSplitPct?: number; // For Hybrid Split: e.g., 0.6 for 60%
  surplusSplitPct?: number;  // For Hybrid Split: e.g., 0.4 for 40%
  bidFloorPct?: number;      // For Bounded Auction: e.g., 0.075 for 7.5%
  bidCapPct?: number;        // For Bounded Auction: e.g., 0.4 for 40%
  stepAmount?: number;       // For Stepped Installment
};

export type DistributionResult = {
  dividendPool: number;
  dividendPerMember: number;
  surplusAdded: number;
  commissionStrategy: 'deduct_from_dividend' | 'deduct_from_payout';
};

// ── 1. Core Arithmetic Functions ──────────────────────────────────────────────

/**
 * Calculates the total chit value (the pot).
 */
export function calculatePot(numMembers: number, installment: number): number {
  return numMembers * installment;
}

/**
 * Calculates the escalating pot for the Stepped Installment (Scheme 8).
 */
export function calculateSteppedPot(
  numMembers: number,
  baseInstallment: number,
  stepAmount: number,
  currentMonth: number
): number {
  const currentInstallment = baseInstallment + (stepAmount * (currentMonth - 1));
  return numMembers * currentInstallment;
}

// ── 2. Commission Calculations ────────────────────────────────────────────────

/**
 * Calculates the absolute foreman commission based on the chosen model.
 * The commission is capped at 5% of the chit value by the Chit Funds Act.
 */
export function calculateForemanCommission(
  pot: number,
  discount: number, // The winning bid
  commissionModel: CommissionModel,
  commissionRate: number, // Expected as a decimal, e.g., 0.05
  fixedAmount: number = 0
): number {
  let rawCommission = 0;
  
  switch (commissionModel) {
    case 'POT_PERCENTAGE':
      rawCommission = pot * commissionRate;
      break;
    case 'DISCOUNT_PERCENTAGE':
      rawCommission = discount * commissionRate;
      break;
    case 'PAYOUT_PERCENTAGE':
      // The base is the gross payout before commission is deducted
      rawCommission = (pot - discount) * commissionRate;
      break;
    case 'FIXED_AMOUNT':
      rawCommission = fixedAmount;
      break;
  }

  // Capped at 5% of pot
  const maxCommission = pot * 0.05;
  return Math.min(rawCommission, maxCommission);
}

// ── 3. Distribution (Dividend & Surplus) ──────────────────────────────────────

/**
 * Master function to split the net discount into dividend and surplus
 * based on the selected auction scheme.
 */
export function calculateDistribution(
  scheme: AuctionScheme,
  numMembers: number,
  discount: number,
  commission: number,
  config?: SchemeConfig,
  commissionStrategy: 'deduct_from_dividend' | 'deduct_from_payout' = 'deduct_from_dividend'
): DistributionResult {
  const netDiscount = commissionStrategy === 'deduct_from_dividend' 
    ? Math.max(0, discount - commission)
    : discount;
  
  let dividendPool = 0;
  let surplusAdded = 0;

  switch (scheme) {
    case 'DIVIDEND_SHARE':
    case 'SEALED_TENDER':
    case 'BOUNDED_AUCTION':
    case 'STEPPED_INSTALLMENT':
      dividendPool = netDiscount;
      break;
    
    case 'ACCUMULATION':
      surplusAdded = netDiscount;
      break;
      
    case 'LOTTERY':
    case 'FIXED_ROTATION':
      // No discount implies no dividend and no surplus
      dividendPool = 0;
      surplusAdded = 0;
      break;
      
    case 'HYBRID_SPLIT':
      const divSplit = config?.dividendSplitPct ?? 0.5; // Default 50%
      const surSplit = config?.surplusSplitPct ?? 0.5;  // Default 50%
      dividendPool = netDiscount * divSplit;
      surplusAdded = netDiscount * surSplit;
      break;
  }

  return {
    dividendPool,
    dividendPerMember: numMembers > 0 ? dividendPool / numMembers : 0,
    surplusAdded,
    commissionStrategy
  };
}

// ── 4. Member Payment Calculations ────────────────────────────────────────────

/**
 * Calculates what a non-winning member owes this month.
 */
export function calculateNetInstallment(
  baseInstallment: number, 
  dividendPerMember: number,
  scheme: AuctionScheme = 'DIVIDEND_SHARE'
): number {
  if (scheme === 'ACCUMULATION' || scheme === 'LOTTERY' || scheme === 'FIXED_ROTATION') {
    return baseInstallment; // Members pay full amount
  }
  return Math.max(0, baseInstallment - dividendPerMember);
}

// ── 5. Auction Settlement Calculations (Payouts) ──────────────────────────────

/**
 * Method A: Direct Calculation (Simple)
 * The winner receives exactly what the auction produced.
 */
export function calculateWinnerPayoutDirect(
  pot: number,
  discount: number,
  commission: number,
  commissionStrategy: 'deduct_from_dividend' | 'deduct_from_payout' = 'deduct_from_dividend'
): number {
  if (commissionStrategy === 'deduct_from_payout') {
    return pot - discount - commission;
  }
  return pot - discount; // Commission was already deducted from dividend
}

/**
 * Method B: Average Bid Method (Fair Settlement)
 * Used at the end of tenure to reconcile and settle members fairly.
 */
export function calculateAverageBidPayout(
  sumOfAllBids: number,
  auctionsConducted: number,
  commission: number
): number {
  if (auctionsConducted <= 1) return 0; // Requires at least two auctions to make sense
  const averageBid = sumOfAllBids / auctionsConducted;
  // (auctionsConducted - 1) reflects the net return after accounting for their own sacrificed pot
  const grossPayout = averageBid * (auctionsConducted - 1);
  return Math.max(0, grossPayout - commission);
}

// ── 6. Early Closure Checks ───────────────────────────────────────────────────

/**
 * Checks if the accumulated surplus pool is large enough to cover
 * all remaining monthly collections.
 */
export function checkEarlyClosureTrigger(
  surplusPool: number,
  pot: number,
  monthsRemaining: number
): boolean {
  if (monthsRemaining <= 0) return true;
  return surplusPool >= (pot * monthsRemaining);
}
