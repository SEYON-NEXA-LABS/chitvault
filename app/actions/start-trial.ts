'use server'

import { createAdminClient } from '@/lib/supabase/server'

interface StartTrialParams {
  firmName: string
  city: string
  phone: string
  fullName: string
  email: string
  password?: string
}

export async function startTrialAction(data: StartTrialParams) {
  const adminClient = createAdminClient()

  if (!data.firmName?.trim()) throw new Error('Firm name is required.')
  if (!data.fullName?.trim()) throw new Error('Your name is required.')
  if (!data.email?.trim()) throw new Error('Email is required.')
  if (!data.password || data.password.length < 6) throw new Error('Password must be at least 6 characters.')

  const cleanPhone = (data.phone || '').replace(/\D/g, '')
  if (cleanPhone && cleanPhone.length !== 10) {
    throw new Error('Phone number must be exactly 10 digits.')
  }

  // 1. Generate slug from firm name
  let slug = data.firmName
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')

  if (!slug) slug = 'firm'

  // Check if slug taken, append random string if so
  const { data: existingFirm } = await adminClient
    .from('firms')
    .select('id')
    .eq('slug', slug)
    .maybeSingle()

  if (existingFirm) {
    slug = `${slug}-${Math.floor(1000 + Math.random() * 9000)}`
  }

  // 2. Create Auth User
  const { data: authUser, error: authError } = await adminClient.auth.admin.createUser({
    email: data.email.trim().toLowerCase(),
    password: data.password,
    email_confirm: true,
    user_metadata: {
      full_name: data.fullName.trim()
    }
  })

  if (authError || !authUser.user) {
    if (authError?.message?.includes('already registered')) {
      throw new Error('An account with this email already exists. Please log in.')
    }
    throw new Error(authError?.message || 'Failed to create user account.')
  }

  const userId = authUser.user.id

  // 3. Create Firm with 30-Day Free Trial
  const trialEnds = new Date()
  trialEnds.setDate(trialEnds.getDate() + 30)

  const { data: newFirm, error: firmError } = await adminClient
    .from('firms')
    .insert({
      name: data.firmName.trim(),
      slug,
      city: data.city?.trim() || null,
      phone: cleanPhone || null,
      owner_id: userId,
      plan: 'trial',
      plan_status: 'active',
      trial_ends: trialEnds.toISOString(),
      color_profile: 'indigo',
      font: 'Noto Sans'
    })
    .select('id, name, slug')
    .single()

  if (firmError) {
    // Rollback user creation
    await adminClient.auth.admin.deleteUser(userId)
    throw new Error(`Failed to initialize firm: ${firmError.message}`)
  }

  // 4. Create Profile linked to the new firm as owner
  const { error: profileError } = await adminClient
    .from('profiles')
    .insert({
      id: userId,
      firm_id: newFirm.id,
      role: 'owner',
      full_name: data.fullName.trim()
    })

  if (profileError) {
    // Non-fatal if upsert exists, but log
    console.error('Profile creation error during trial start:', profileError)
  }

  return {
    success: true,
    firmId: newFirm.id,
    firmName: newFirm.name,
    email: data.email.trim().toLowerCase()
  }
}
