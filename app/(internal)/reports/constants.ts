import { History, DollarSign, TrendingUp, ShieldCheck, Calendar, Users, FileText, CheckCircle, AlertTriangle } from 'lucide-react'

export const GET_REPORTS = (t: any, term: any) => [
  { 
    id: 'today_collection', 
    category: t('cat_financial'), 
    title: t('report_today_title'), 
    desc: 'Detailed log of all collections received today across all groups, including payment mode and time-stamps.', 
    icon: History 
  },
  { 
    id: 'pnl', 
    category: t('cat_financial'), 
    title: 'Firm Income (P&L)', 
    desc: 'Analysis of realized advisor commissions vs. projected full-cycle earnings across active groups.', 
    icon: DollarSign 
  },
  { 
    id: 'cashflow', 
    category: t('cat_financial'), 
    title: t('report_cashflow_title'), 
    desc: 'Real-time tracking of cash inflows from member payments vs. outflows for auction payouts to manage liquidity.', 
    icon: TrendingUp 
  },
  { 
    id: 'dividend', 
    category: t('cat_financial'), 
    title: term.isAccOnly ? 'Surplus Accumulation' : term.isDivOnly ? t('report_dividend_title') : 'Member Benefit Analysis', 
    desc: 'Comprehensive breakdown of savings generated for members through auction dividends and surplus distributions.', 
    icon: TrendingUp 
  },
  { 
    id: 'auction_insights', 
    category: t('cat_financial'), 
    title: 'Winner Intelligence', 
    desc: 'Early-bird borrower analytics and bidding patterns used to identify high-risk profiles and portfolio health.', 
    icon: ShieldCheck 
  },
  
  { 
    id: 'group_enrollment', 
    category: t('cat_operational'), 
    title: t('report_enrollment_title'), 
    desc: 'Audit of vacancy vs. occupancy across all groups to identify marketing needs for under-subscribed pools.', 
    icon: Users 
  },
  { 
    id: 'auction_sched', 
    category: t('cat_operational'), 
    title: t('report_auction_sched_title'), 
    desc: 'Centralized timeline of all scheduled and completed auctions for better operational coordination.', 
    icon: Calendar 
  },
  { 
    id: 'group_ledger', 
    category: t('cat_operational'), 
    title: t('report_group_ledger_title'), 
    desc: 'Complete financial statement for a specific group, detailing every auction, collection, and payout in its lifecycle.', 
    icon: FileText 
  },
  
  { 
    id: 'member_history', 
    category: t('cat_member'), 
    title: t('report_member_history_title'), 
    desc: "A 360-degree view of an individual member's payments, dues, and participation history across all groups.", 
    icon: Users 
  },
  { 
    id: 'defaulters', 
    category: t('cat_member'), 
    title: t('report_defaulters_title'), 
    desc: 'Critical monitoring of members with significant arrears or missed payments to prioritize recovery efforts.', 
    icon: AlertTriangle 
  },
  { 
    id: 'winners', 
    category: t('cat_member'), 
    title: t('report_winners_title'), 
    desc: 'Tracking log of all auction winners, settlement status, and net payout amounts for audit and follow-up.', 
    icon: CheckCircle 
  },
  
  { 
    id: 'reconciliation', 
    category: t('cat_audit'), 
    title: t('report_reconciliation_title'), 
    desc: 'Audit tool matching physical cash entries with system-recorded collections for zero-discrepancy operations.', 
    icon: FileText 
  },
  { 
    id: 'activity', 
    category: t('cat_audit'), 
    title: t('report_activity_title'), 
    desc: 'Full diagnostic trail of system changes and administrative actions to ensure platform accountability.', 
    icon: History 
  },
]
