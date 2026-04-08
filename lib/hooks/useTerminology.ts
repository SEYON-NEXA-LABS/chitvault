import { useMemo } from 'react'
import { useI18n } from '@/lib/i18n/context'
import type { Firm } from '@/types'

export function useTerminology(firm: Firm | null | undefined) {
  const { t } = useI18n()

  return useMemo(() => {
    const schemes = firm?.enabled_schemes || ['DIVIDEND', 'ACCUMULATION']
    const hasAcc = schemes.includes('ACCUMULATION')
    const hasDiv = schemes.includes('DIVIDEND')
    const isHybrid = hasAcc && hasDiv
    const isAccOnly = hasAcc && !hasDiv
    const isDivOnly = hasDiv && !hasAcc

    return {
      isHybrid,
      isAccOnly,
      isDivOnly,
      
      // General term for the "savings/dividend" concept
      benefitLabel: isAccOnly ? t('surplus') : isDivOnly ? t('dividend') : `${t('surplus')} / ${t('dividend')}`,
      
      // Label for the P&L Distributed column
      pnlBenefitLabel: isAccOnly ? t('surplus_to_pool') : isDivOnly ? t('dividends_distributed') : `${t('surplus_to_pool')} / ${t('dividends_distributed')}`,
      
      // Label for per-auction surplus/dividend
      auctionBenefitLabel: isAccOnly ? t('pool_contribution') : isDivOnly ? t('dividend') : t('surplus_div'),
      
      // Label for Member Benefits (StatCards)
      memberBenefitLabel: isAccOnly ? t('member_savings') : isDivOnly ? t('member_dividend') : t('member_benefit_plural'),

      // Label for Group Surplus (Dashboard/Ledger)
      groupSurplusLabel: isAccOnly ? t('group_surplus') : isDivOnly ? t('dividends') : t('group_surplus'),

      // Label for Payout (Prize Money)
      payoutLabel: isAccOnly ? t('winner_payout') : isDivOnly ? t('dividend_payout') : t('settlement_payout'),

      // Label for Settlement Page
      settlementLabel: isAccOnly ? t('surplus_settlement') : isDivOnly ? t('dividend_settlement') : t('settlement_title')
    }
  }, [firm?.enabled_schemes, t])
}
