'use client'

import { useQuery, useQueryClient } from '@tanstack/react-query'
import { createClient } from '@/lib/supabase/client'
import type { Group, Auction, Member, ForemanCommission, Person, GroupWithRules, Payment } from '@/types'

export function useGroupLedgerData(groupId: number, firmId?: string | number, role?: string) {
  const supabase = createClient()
  const queryClient = useQueryClient()

  const queryKey = ['groupLedger', groupId]

  const query = useQuery({
    queryKey,
    queryFn: async () => {
      const gQuery = supabase.from('groups').select('id, firm_id, name, duration, monthly_contribution, auction_scheme, start_date, num_members, accumulated_surplus, chit_value, commission_type, commission_value, commission_recipient, status, min_bid_pct, max_bid_pct, discount_cap_pct, dividend_split_pct, surplus_split_pct, step_amount, dividend_strategy, dividend_rule').eq('id', groupId)
      const mQuery = supabase.from('members').select('id, ticket_no, group_id, person_id, status, created_at, persons:persons(id, name, phone, address)').eq('group_id', groupId).order('ticket_no')
      const aQuery = supabase.from('auctions').select('id, group_id, month, auction_date, payout_date, winner_id, auction_discount, dividend, net_payout, status, is_payout_settled, payout_amount, payout_mode, payout_note').eq('group_id', groupId).order('month')
      const fcQuery = supabase.from('foreman_commissions').select('id, auction_id, group_id, month, commission_amt, foreman_member_id, status').eq('group_id', groupId).order('month')
      const payQuery = supabase.from('payments').select('id, member_id, group_id, month, amount, payment_type, payment_date, created_at, mode, note, members:member_id(ticket_no, persons:person_id(name, phone))').eq('group_id', groupId).is('deleted_at', null).order('created_at', { ascending: false })
      const pQuery = supabase.from('persons').select('id, name, phone, firm_id').order('name')

      if (role !== 'superadmin' && firmId) {
        gQuery.eq('firm_id', firmId)
        mQuery.eq('firm_id', firmId)
        aQuery.eq('firm_id', firmId)
        fcQuery.eq('firm_id', firmId)
        payQuery.eq('firm_id', firmId)
        pQuery.eq('firm_id', firmId)
      }

      const [gRes, mRes, aRes, fcRes, payRes, pRes] = await Promise.all([
        gQuery.maybeSingle(),
        mQuery,
        aQuery,
        fcQuery,
        payQuery,
        pQuery
      ])

      if (gRes.error) throw gRes.error

      return {
        group: gRes.data as GroupWithRules,
        members: (mRes.data || []) as Member[],
        auctionHistory: (aRes.data || []) as Auction[],
        commissions: (fcRes.data || []) as ForemanCommission[],
        payments: (payRes.data || []) as Payment[],
        allPersons: (pRes.data || []) as Person[]
      }
    },
    enabled: !!groupId && (!!firmId || role === 'superadmin'),
    staleTime: 60 * 1000,
  })

  const refresh = () => {
    queryClient.invalidateQueries({ queryKey })
  }

  return {
    ...query,
    data: query.data || {
      group: null,
      members: [],
      auctionHistory: [],
      commissions: [],
      payments: [],
      allPersons: []
    },
    refresh
  }
}
