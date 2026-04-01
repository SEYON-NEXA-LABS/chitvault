'use server'

import { createClient } from '@supabase/supabase-js'
import { createClient as createServerClient } from '@/lib/supabase/server'
import { cookies } from 'next/headers'
import { revalidatePath } from 'next/cache'

// Admin client using service role key
function createAdminClient() {
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SECRET_SERVICE_ROLE_KEY!
  )
}

export async function registerFirm(params: {
  name: string;
  slug: string;
  owner_email: string;
  owner_name: string;
  owner_pass: string;
  city?: string;
  phone?: string;
  plan: string;
  color_profile: string;
  font: string;
}) {
  const supabase = createServerClient(cookies())
  const admin = createAdminClient()

  // 1. Check if current user is superadmin
  console.log('--- registerFirm Start ---')
  const { data: { user }, error: userError } = await supabase.auth.getUser()

  if (userError || !user) {
    console.error('Auth User Error:', userError?.message || 'No user found in session')
    return { error: 'Not authenticated. Please log out and log back in.' }
  }

  console.log('Logged in as:', user.email)

  const { data: profile, error: profileError } = await supabase
    .from('profiles')
    .select('role')
    .eq('id', user.id)
    .single()

  if (profileError || profile?.role !== 'superadmin') {
    console.error('Role Check Failed:', profileError?.message || `User role is ${profile?.role}`)
    return { error: 'Access denied. Superadmin role required.' }
  }

  // 2. Create the Auth User
  const { data: authUser, error: authErr } = await admin.auth.admin.createUser({
    email: params.owner_email.trim(),
    password: params.owner_pass,
    user_metadata: { full_name: params.owner_name.trim() },
    email_confirm: true // Mark as confirmed immediately
  })

  if (authErr || !authUser.user) {
    return { error: authErr?.message || 'Failed to create user' }
  }

  // 3. Create Firm & Profile via RPC
  const { data: firmId, error: rpcErr } = await supabase.rpc('admin_create_firm', {
    p_name: params.name,
    p_slug: params.slug,
    p_owner_id: authUser.user.id,
    p_owner_name: params.owner_name,
    p_city: params.city || null,
    p_phone: params.phone || null,
    p_plan: params.plan,
    p_color_profile: params.color_profile,
    p_font: params.font
  })

  if (rpcErr) {
    // Attempt cleanup: delete the auth user if the firm creation fails
    await admin.auth.admin.deleteUser(authUser.user.id)
    return { error: rpcErr.message }
  }

  revalidatePath('/admin')
  return { success: true, firmId }
}

export async function updateFirmProfile(firmId: string, profileId: string) {
  const supabase = createServerClient(cookies())
  
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  
  if (profile?.role !== 'superadmin') {
    return { error: 'Access denied' }
  }

  const { error } = await supabase.from('firms').update({ 
    color_profile: profileId
  }).eq('id', firmId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}

export async function updateFirmDetails(firmId: string, params: {
  name: string;
  slug: string;
  city?: string;
  phone?: string;
  font?: string;
}) {
  const supabase = createServerClient(cookies())
  
  const { data: { user } } = await supabase.auth.getUser()
  const { data: profile } = await supabase.from('profiles').select('role').eq('id', user?.id).single()
  
  if (profile?.role !== 'superadmin') {
    return { error: 'Access denied' }
  }

  const { error } = await supabase.from('firms').update({
    name: params.name,
    slug: params.slug,
    city: params.city || null,
    phone: params.phone || null,
    font: params.font || 'Noto Sans'
  }).eq('id', firmId)

  if (error) return { error: error.message }
  revalidatePath('/admin')
  return { success: true }
}
