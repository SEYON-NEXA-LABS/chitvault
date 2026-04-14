/**
 * Centralized Scoping Utility for Multi-Tenancy
 * Use this to ensure every query to tenant-specific tables is scoped correctly.
 */

import { PostgrestQueryBuilder } from '@supabase/postgrest-js'

/**
 * Applies a firm_id filter to a Supabase query only if a firmId is provided.
 * For Superadmins, if 'all' is passed, the filter is omitted initially 
 * (though Row Level Security still applies if not bypassed).
 * 
 * @param query - The Supabase query object (e.g. supabase.from('groups').select('id, name'))
 * @param firmId - The ID of the firm to filter by, or 'all' to fetch everything.
 */
export function withFirmScope<T extends any>(query: T, firmId: string | 'all' | null | undefined): T {
  if (firmId && firmId !== 'all') {
    return (query as any).eq('firm_id', firmId)
  }
  return query
}

/**
 * Usage Example:
 * 
 * const { firm, role } = useFirm()
 * const targetId = role === 'superadmin' ? selectedFirmId : firm?.id
 * 
 * const { data } = await withFirmScope(
 *   supabase.from('groups').select('id, name'),
 *   targetId
 * )
 */
