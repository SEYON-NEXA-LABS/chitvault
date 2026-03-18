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
  phone:          string | null
  // Branding
  primary_color:  string | null
  logo_url:       string | null
  tagline:        string | null
  font:           string | null
  register_token: string | null
  created_at:     string
}

export interface Profile {
  id:        string
  firm_id:   string | null
  full_name: string | null
  role:      UserRole
  created_at: string
}

export type GroupStatus = 'active' | 'archived'
export type MemberStatus = 'active' | 'exited' | 'defaulter' | 'foreman'

export interface Group {
  id: number; firm_id: string; name: string; chit_value: number
  num_members: number; duration: number; monthly_contribution: number
  start_date: string | null; status: GroupStatus; created_at: string
}

export interface Member {
  id: number; firm_id: string; name: string; phone: string | null
  address: string | null; group_id: number; ticket_no: number
  status: MemberStatus; exit_month: number | null; transfer_from_id: number | null
  contact_id: number | null; notes: string | null; created_at: string
}

export interface Auction {
  id: number; firm_id: string; group_id: number; month: number
  auction_date: string | null; winner_id: number | null
  bid_amount: number; total_pot: number; dividend: number; created_at: string
}


export const PLAN_LIMITS: Record<Plan, { groups: number; members: number; label: string; price: string }> = {
  trial: { groups: 2,    members: 20,   label: 'Trial (30 days)', price: 'Free'      },
  basic: { groups: 10,   members: 200,  label: 'Basic',           price: '₹2,000/yr' },
  pro:   { groups: 9999, members: 9999, label: 'Pro',             price: '₹5,000/yr' },
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
  status:       'paid' | 'pending'
  collected_by: string | null
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
export type CommissionType = 'percent_of_chit' | 'percent_of_discount' | 'fixed_amount'
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
  bid_amount:           number
  discount:             number
  commission_type:      CommissionType
  commission_rate:      number
  commission_amt:       number
  net_dividend:         number
  per_member_div:       number
  paid_to:              CommissionRecipient
  foreman_member_id:    number | null
  notes:                string | null
  created_at:           string
}

// Result from calculate_auction RPC
export interface AuctionCalculation {
  chit_value:           number
  bid_amount:           number
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
}

export const COMMISSION_TYPE_LABELS: Record<CommissionType, string> = {
  percent_of_chit:     '% of Chit Value (per month)',
  percent_of_discount: '% of Discount (per auction)',
  fixed_amount:        'Fixed Amount (per month)',
}
