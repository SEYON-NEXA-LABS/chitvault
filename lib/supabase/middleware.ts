import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY

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
  const isPublic = ['/login', '/register', '/', '/reset-password'].some(p => pathname === p)
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

  // 1. Get Profile (Try Cache First)
  let profile: { firm_id: string; role: string; status: string } | null = null
  const cachedProfile = request.cookies.get('cv_profile')?.value

  if (cachedProfile) {
    try {
      profile = JSON.parse(atob(cachedProfile))
    } catch {
      profile = null
    }
  }

  if (!profile) {
    const { data } = await supabase
      .from('profiles')
      .select('firm_id, role, status')
      .eq('id', user.id)
      .maybeSingle()
    
    if (data) {
      profile = data as any
      // Set Cache for 1 hour
      supabaseResponse.cookies.set('cv_profile', btoa(JSON.stringify(data)), {
        maxAge: 3600,
        path: '/'
      })
    }
  }

  // Track Usage (Internal Telemetry - Precision Calibrated to Navigation only)
  // We only record usage if it's a page navigation (not an internal API fetch/asset)
  const isPage = !pathname.includes('.') && !pathname.startsWith('/api')
  if (profile?.firm_id && isPage) {
    // We attribute a baseline of 2KB for the session check
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
  if (!isPublic && !isOnboarding && !isInvite && !isDenied) {
    // Superadmin-only areas
    if (isSuperadminRoute && profile?.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // If no profile at all, force onboarding
    if (!profile && !isAdmin && !isSuperadminRoute) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return supabaseResponse
}
