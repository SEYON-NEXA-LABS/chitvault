import { createClient } from '@/lib/supabase/client'

export type ActivityAction = 
  | 'PAYMENT_RECORDED' | 'PAYMENT_DELETED' | 'PAYMENT_ARCHIVED'
  | 'AUCTION_RECORDED' | 'AUCTION_UPDATED' | 'AUCTION_DELETED' | 'AUCTION_ARCHIVED'
  | 'MEMBER_CREATED'   | 'MEMBER_UPDATED'  | 'MEMBER_DELETED' | 'MEMBER_TRANSFERRED' | 'MEMBER_ARCHIVED'
  | 'CASH_ENTRY_SAVED' | 'CASH_ENTRY_DELETED' | 'CASH_ENTRY_ARCHIVED'
  | 'SETTLEMENT_SAVED' | 'SETTLEMENT_DELETED' | 'SETTLEMENT_UPDATED' | 'SETTLEMENT_CANCELLED' | 'SETTLEMENT_ARCHIVED'
  | 'SETTING_UPDATED'  | 'STAFF_ADDED'     | 'STAFF_REMOVED' | 'STAFF_ARCHIVED'
  | 'GROUP_CREATED'    | 'GROUP_UPDATED'   | 'GROUP_DELETED' | 'GROUP_ARCHIVED'

export async function logActivity(
  firmId: string,
  action: ActivityAction,
  entityType: string,
  entityId: number | string | null,
  metadata: any = {}
) {
  const supabase = createClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || !firmId) return

  await supabase.from('activity_logs').insert({
    firm_id: firmId,
    user_id: user.id,
    action,
    entity_type: entityType,
    entity_id: entityId ? String(entityId) : null,
    metadata
  })
}
