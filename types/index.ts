// ── SaaS Types ────────────────────────────────────────────────

export type Plan = 'trial' | 'basic' | 'pro'
export type PlanStatus = 'active' | 'suspended' | 'cancelled'
export type UserRole = 'owner' | 'staff' | 'superadmin'

export interface Firm {
  id:          string
  name:        string
  slug:        string
  owner_id:    string | null
  plan:        Plan
  plan_status: PlanStatus
  trial_ends:  string | null
  invoice_ref: string | null
  city:        string | null
  phone:       string | null
  created_at:  string
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

export interface Payment {
  id: number; firm_id: string; member_id: number; group_id: number
  month: number; amount: number; payment_date: string | null
  mode: 'Cash' | 'UPI' | 'Bank Transfer' | 'Cheque'
  status: 'paid' | 'pending'; created_at: string
}

export const PLAN_LIMITS: Record<Plan, { groups: number; members: number; label: string; price: string }> = {
  trial: { groups: 2,    members: 20,   label: 'Trial (30 days)', price: 'Free'      },
  basic: { groups: 10,   members: 200,  label: 'Basic',           price: '₹2,000/yr' },
  pro:   { groups: 9999, members: 9999, label: 'Pro',             price: '₹5,000/yr' },
}
