'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function updateFirmStatusAction(firmId: string, status: 'active' | 'suspended' | 'cancelled') {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // 1. Security Check: Must be Superadmin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    throw new Error('UNAUTHORIZED')
  }

  const { error } = await adminClient
    .from('firms')
    .update({ plan_status: status })
    .eq('id', firmId)

  if (error) throw error

  revalidatePath('/superadmin')
  return { success: true }
}

export async function extendTrialAction(firmId: string, days: number = 30) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // Security Check
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    throw new Error('UNAUTHORIZED')
  }

  // Get current trial end
  const { data: firm } = await adminClient.from('firms').select('trial_ends').eq('id', firmId).single()
  
  const currentEnd = firm?.trial_ends ? new Date(firm.trial_ends) : new Date()
  const newEnd = new Date(currentEnd.getTime() + (days * 24 * 60 * 60 * 1000))

  const { error } = await adminClient
    .from('firms')
    .update({ 
      trial_ends: newEnd.toISOString(),
      plan_status: 'active' 
    })
    .eq('id', firmId)

  if (error) throw error

  revalidatePath('/superadmin')
  return { success: true }
}
