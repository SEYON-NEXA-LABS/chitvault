// ── SaaS Types ────────────────────────────────────────────────

export type Plan = 'trial' | 'basic' | 'pro'
export type PlanStatus = 'active' | 'suspended' | 'cancelled'
export type UserRole = 'owner' | 'staff' | 'superadmin'

export interface Firm {
  id:             string
  name:           string
  slug:           string
  owner_id:       string | null
  plan:           Plan
  plan_status:    PlanStatus
  trial_ends:     string | null
  invoice_ref:    string | null
  city:           string | null
  address:        string | null
  phone:          string | null
  // Branding
  font:           string | null
  theme_id:       string | null
  color_profile:  string | null
  register_token: string | null
  enabled_schemes: string[]
  created_at:     string
  created_by:     string | null
  updated_at:     string | null
  updated_by:     string | null
}

export interface Profile {
  id:        string
  firm_id:   string | null
  full_name: string | null
  role:      UserRole
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
}

export type GroupStatus = 'active' | 'archived'
export type MemberStatus = 'active' | 'exited' | 'defaulter' | 'foreman'

export interface Group {
  id: number; firm_id: string; name: string; chit_value: number
  num_members: number; duration: number; monthly_contribution: number
  start_date: string | null; status: GroupStatus; 
  auction_scheme: 'DIVIDEND_SHARE' | 'ACCUMULATION' | 'LOTTERY' | 'FIXED_ROTATION' | 'SEALED_TENDER' | 'BOUNDED_AUCTION' | 'HYBRID_SPLIT' | 'STEPPED_INSTALLMENT';
  accumulated_surplus: number;
  dividend_split_pct?: number;
  surplus_split_pct?: number;
  step_amount?: number;
  min_bid_pct: number;
  max_bid_pct: number;
  discount_cap_pct: number;
  commission_type: 'percent_of_chit' | 'percent_of_discount' | 'percent_of_payout' | 'fixed_amount';
  commission_value: number;
  commission_recipient: 'foreman' | 'firm';
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  firms?: { name: string }
}

export interface Person {
  id:         number
  firm_id:    string
  name:       string
  nickname:   string | null
  phone:      string | null
  address:    string | null
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  firms?: { name: string }
}

export interface Member {
  id: number; firm_id: string; person_id: number
  group_id: number; ticket_no: number
  status: MemberStatus; exit_month: number | null; transfer_from_id: number | null
  contact_id: number | null; notes: string | null; 
  created_at: string
  created_by: string | null
  updated_at: string | null
  updated_by: string | null
  firms?: { name: string }
  persons?: Person
}

export interface Auction {
  id: number; firm_id: string; group_id: number; month: number
  auction_date: string | null; winner_id: number | null
  auction_discount: number; total_pot: number; dividend: number;
  net_payout?: number;
  is_payout_settled: boolean
  payout_date: string | null
  payout_amount: number | null
  payout_mode: string | null
  payout_note: string | null
  status: 'draft' | 'confirmed'
  created_at: string
  members?: Member
}


export const PLAN_LIMITS: Record<Plan, { groups: number; members: number; label: string; setupFee: string; amc: string }> = {
  trial: { groups: 2,    members: 20,   label: 'Trial (30 days)', setupFee: 'Free',   amc: 'Free'      },
  basic: { groups: 10,   members: 200,  label: 'Basic',           setupFee: '₹2,000', amc: '₹1,000/yr' },
  pro:   { groups: 9999, members: 9999, label: 'Pro',             setupFee: '₹5,000', amc: '₹2,500/yr' },
}

export interface Payment {
  id:           number
  firm_id:      string
  member_id:    number
  group_id:     number
  month:        number
  amount:       number
  amount_due:   number
  balance_due:  number
  payment_type: 'full' | 'partial'
  payment_date: string | null
  mode:         'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'
  status:       'paid' | 'pending' | 'partial'
  collected_by: string | null
  profiles?: { full_name: string | null }
  members?: Member
  created_at:   string
}

export interface Denomination {
  id:           number
  firm_id:      string
  entry_date:   string
  collected_by: string | null
  note_2000:    number
  note_500:     number
  note_200:     number
  note_100:     number
  note_50:      number
  note_20:      number
  note_10:      number
  coin_5:       number
  coin_2:       number
  coin_1:       number
  total:        number
  notes:        string | null
  created_at:   string
}

export const DENOMINATIONS = [
  { key: 'note_2000', label: '₹2000', value: 2000, type: 'note' },
  { key: 'note_500',  label: '₹500',  value: 500,  type: 'note' },
  { key: 'note_200',  label: '₹200',  value: 200,  type: 'note' },
  { key: 'note_100',  label: '₹100',  value: 100,  type: 'note' },
  { key: 'note_50',   label: '₹50',   value: 50,   type: 'note' },
  { key: 'note_20',   label: '₹20',   value: 20,   type: 'note' },
  { key: 'note_10',   label: '₹10',   value: 10,   type: 'note' },
  { key: 'coin_5',    label: '₹5',    value: 5,    type: 'coin' },
  { key: 'coin_2',    label: '₹2',    value: 2,    type: 'coin' },
  { key: 'coin_1',    label: '₹1',    value: 1,    type: 'coin' },
] as const

// ── Auction Rules (stored on Group) ──────────────────────────
export type CommissionType = 'percent_of_chit' | 'percent_of_discount' | 'percent_of_payout' | 'fixed_amount'
export type DividendRule   = 'equal_split' | 'proportional'
export type CommissionRecipient = 'foreman' | 'firm'

// Extended Group with auction rules
export interface GroupWithRules extends Group {
  min_bid_pct:           number   // 0.70 = 70%
  max_bid_pct:           number   // 1.00 = 100%
  discount_cap_pct:      number   // 1.00 = unlimited
  commission_type:       CommissionType
  commission_value:      number   // % or ₹ amount
  commission_recipient:  CommissionRecipient
  dividend_rule:         DividendRule
}

// Foreman Commission record (one per auction month)
export interface ForemanCommission {
  id:                   number
  firm_id:              string
  group_id:             number
  auction_id:           number | null
  month:                number
  chit_value:           number
  auction_discount:     number
  discount:             number
  commission_type:      CommissionType
  commission_rate:      number
  commission_amt:       number
  net_dividend:         number
  per_member_div:       number
  paid_to:              CommissionRecipient
  foreman_member_id:    number | null
  notes:                string | null
  status:               'draft' | 'confirmed'
  created_at:           string
  created_by:           string | null
  updated_by:           string | null
}

// Settlement record (persistent calculation)
export interface Settlement {
  id:                   number
  firm_id:              string
  member_id:            number | null
  group_id:             number | null
  total_amount:         number
  total_months:         number
  average_per_month:    number
  final_payout_amount:  number
  entries:              { date: string; amount: number }[]
  notes:                string | null
  created_at:           string
  created_by:           string | null
  members?: {
    persons: { name: string }
    groups: { name: string }
  }
}

// Result from calculate_auction RPC
export interface AuctionCalculation {
  chit_value:           number
  auction_discount:     number
  min_bid:              number
  max_bid:              number
  discount:             number
  discount_cap:         number
  commission_type:      CommissionType
  commission_rate:      number
  commission_amt:       number
  commission_recipient: CommissionRecipient
  net_dividend:         number
  num_members:          number
  per_member_div:       number
  each_pays:            number
  net_payout:           number // New field for whitelabel payout logic
}

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  percent_of_chit:     '% of Chit Value (per month)',
  percent_of_discount: '% of Discount (per auction)',
  percent_of_payout:   '% of Payout Amount (deducted)',
  fixed_amount:        'Fixed Amount (per month)',
}

// ── Usage & Telemetry (SaaS Metrics) ────────────────────────
export interface UserUsage {
  full_name:   string
  role:        UserRole
  egress:      number
  operations:  number
}

export interface UsageInsights {
  egress: {
    database:       number
    storage:        number
    api:            number
    realtime:       number
    auth:           number
    edge_functions: number
    total_estimate: number
  }
  metrics: {
    ops:            number
    emails:         number
    users:          number
  }
  top_users:        UserUsage[]
  cycle_start?:     string
  cycle_end?:       string
  status?:          'no_data'
}
