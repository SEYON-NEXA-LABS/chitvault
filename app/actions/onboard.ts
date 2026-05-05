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
  font?: string
  color_profile?: string
}) {
  const supabase = await createClient()
  const adminClient = createAdminClient()

  // 1. Security Check: Must be Superadmin
  const { data: { user } } = await supabase.auth.getUser()
  if (!user || user.email !== process.env.SUPERADMIN_EMAIL) {
    throw new Error('UNAUTHORIZED: Only the platform Superadmin can onboard new firms.')
  }

  try {
    console.log('1. Starting Onboarding for:', formData.name);

    // 2. Create Auth User
    const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
      email: formData.ownerEmail,
      password: formData.initialPassword || 'ChitVault2024!',
      email_confirm: true,
      user_metadata: {
        full_name: formData.ownerName
      }
    })

    if (authError) {
      console.error('AUTH_ERROR:', authError);
      throw authError;
    }
    
    if (!authUser.user) throw new Error('Failed to create auth user');
    console.log('2. Auth User Created:', authUser.user.id);

    // 3. Create Firm record
    const { data: firm, error: firmError } = await adminClient
      .from('firms')
      .insert({
        name: formData.name,
        slug: formData.slug.toLowerCase(),
        city: formData.city,
        owner_id: authUser.user.id,
        plan: 'trial',
        font: formData.font || 'Noto Sans',
        color_profile: formData.color_profile || 'indigo'
      })
      .select()
      .single()

    if (firmError) {
      console.error('FIRM_ERROR:', firmError);
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      throw firmError;
    }
    console.log('3. Firm Record Created:', firm.id);

    // 4. Create Profile record
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
      console.error('PROFILE_ERROR:', profileError);
      await adminClient.from('firms').delete().eq('id', firm.id);
      await adminClient.auth.admin.deleteUser(authUser.user.id);
      throw profileError;
    }
    console.log('4. Profile Linked Successfully');

    revalidatePath('/superadmin/dashboard');
    return { success: true, firmId: firm.id, userId: authUser.user.id };
  } catch (error: any) {
    console.error('ONBOARDING_CRASH:', error);
    return { success: false, error: error.message || 'Unknown internal error' };
  }
}
