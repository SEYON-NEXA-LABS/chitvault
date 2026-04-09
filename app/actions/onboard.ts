'use server'

import { createAdminClient, createClient } from '@/lib/supabase/server'
import { revalidatePath } from 'next/cache'

export async function onboardFirmAction(formData: {
  name: string
  slug: string
  city: string
  ownerEmail: string
  ownerName: string
  initialPassword?: string
}) {
  const supabase = createClient()
  const adminClient = createAdminClient()

  // 1. Security Check: Must be Superadmin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    throw new Error('UNAUTHORIZED: Only the platform Superadmin can onboard new firms.')
  }

  try {
    // 2. Clear any existing user with this email to prevent conflicts (Optional safety)
    // Actually, auth.admin.createUser will throw if exists.

    // 3. Create Auth User
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: formData.ownerEmail,
      password: formData.initialPassword || 'ChitVault2024!',
      email_confirm: true,
      user_metadata: {
        full_name: formData.ownerName
      }
    })

    if (authError) throw authError
    if (!authUser.user) throw new Error('Failed to create auth user')

    // 4. Create Firm record
    const { data: firm, error: firmError } = await adminClient
      .from('firms')
      .insert({
        name: formData.name,
        slug: formData.slug.toLowerCase(),
        city: formData.city,
        owner_id: authUser.user.id,
        plan: 'trial'
      })
      .select()
      .single()

    if (firmError) {
      // Rollback auth user if firm creation fails
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      throw firmError
    }

    // 5. Create Profile record linking user to firm as 'owner'
    const { error: profileError } = await adminClient
      .from('profiles')
      .upsert({
        id: authUser.user.id,
        firm_id: firm.id,
        role: 'owner',
        full_name: formData.ownerName,
        status: 'active'
      })

    if (profileError) {
      // Rollback firm and user
      await adminClient.from('firms').delete().eq('id', firm.id)
      await adminClient.auth.admin.deleteUser(authUser.user.id)
      throw profileError
    }

    revalidatePath('/superadmin/firms')
    return { success: true, firmId: firm.id, userId: authUser.user.id }
  } catch (error: any) {
    console.error('ONBOARDING_ERROR:', error)
    return { success: false, error: error.message }
  }
}
