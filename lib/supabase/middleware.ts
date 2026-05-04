import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY

  if (!supabaseUrl || !supabaseKey) {
    console.error('CRITICAL: Supabase credentials missing in Middleware.')
    return supabaseResponse
  }

  const supabase = createServerClient(
    supabaseUrl,
    supabaseKey,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl
  const isPublic = ['/login', '/', '/reset-password', '/schemes', '/legal'].some(p => pathname === p || pathname.startsWith('/legal/') || pathname.startsWith('/schemes/'))
  const isAdmin = pathname.startsWith('/admin')
  const isOnboarding = pathname === '/onboarding'
  const isInvite = pathname.startsWith('/invite')
  const isDenied = pathname === '/access-denied'
  const isSuperadminRoute = pathname.startsWith('/superadmin')

  // Not logged in —> Allow public pages, redirect protected to login
  if (!user) {
    if (!isPublic && !isInvite && !isDenied) {
      const url = request.nextUrl.clone()
      url.pathname = '/login'
      url.searchParams.set('next', pathname + request.nextUrl.search)
      return NextResponse.redirect(url)
    }
    return supabaseResponse
  }

  // Logged in — only fetch profile for protected routes
  if (isPublic) {
    return supabaseResponse
  }

  // 1. Get Profile (Prioritize Secure App Metadata)
  let profile: { id: string; firm_id: string; role: string; status: string } | null = null
  const meta = { ...user.user_metadata, ...user.app_metadata }
  
  if (meta.role && meta.firm_id) {
    profile = {
      id: user.id,
      firm_id: meta.firm_id,
      role: meta.role,
      status: meta.status || 'active'
    }
  }

  // 2. Fallback to Database if metadata is missing or forced refresh needed
  if (!profile) {
    const { data } = await supabase
      .from('profiles')
      .select('id, firm_id, role, status')
      .eq('id', user.id)
      .maybeSingle()
    
    // Retry once if missing to handle eventual consistency during login
    if (!data) {
      await new Promise(r => setTimeout(r, 800))
      const { data: retryData } = await supabase
        .from('profiles')
        .select('id, firm_id, role, status')
        .eq('id', user.id)
        .maybeSingle()
      if (retryData) profile = retryData as any
    } else {
      profile = data as any
    }
  }

  // Track Usage (Internal Telemetry - Precision Calibrated to Navigation only)
  const isPage = !pathname.includes('.') && !pathname.startsWith('/api')
  if (profile?.firm_id && isPage) {
    supabase.rpc('record_user_usage', {
      p_firm_id: profile.firm_id,
      p_user_id: user.id,
      p_egress_bytes: 2048, 
      p_is_auth: true
    }).then() 
  }

  // 0. If account is inactive —> Force Access Denied
  if (profile?.status === 'inactive' && !isDenied) {
    const url = request.nextUrl.clone()
    url.pathname = '/access-denied'
    return NextResponse.redirect(url)
  }

  // 1. If on Onboarding but already have a firm —> Forward to Dashboard
  if (isOnboarding && profile?.firm_id) {
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // 2. If on Protected route —> Enforce guards
  if (!isPublic && !isInvite && !isDenied) {
    // Superadmin-only areas
    if (isSuperadminRoute && profile?.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // FINAL NORMALIZATION: We re-enable the security guard now that
    // the database RLS is stabilized and recursion-free.
    if (!profile && !isAdmin && !isSuperadminRoute && !isOnboarding) {
      const url = request.nextUrl.clone()
      url.pathname = '/access-denied'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
