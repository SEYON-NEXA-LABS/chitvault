import { createClient } from '@/lib/supabase/client'

export type ActivityAction = 
  | 'PAYMENT_RECORDED' | 'PAYMENT_DELETED'
  | 'AUCTION_RECORDED' | 'AUCTION_DELETED'
  | 'MEMBER_CREATED'   | 'MEMBER_UPDATED'  | 'MEMBER_DELETED' | 'MEMBER_TRANSFERRED'
  | 'CASH_ENTRY_SAVED' | 'CASH_ENTRY_DELETED'
  | 'SETTLEMENT_SAVED' | 'SETTLEMENT_DELETED' | 'SETTLEMENT_UPDATED' | 'SETTLEMENT_CANCELLED'
  | 'SETTING_UPDATED'  | 'STAFF_ADDED'     | 'STAFF_REMOVED'

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
