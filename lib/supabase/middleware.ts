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

  // Logged in — only fetch profile for protected routes or if we need to redirect from public pages
  // To avoid 504 on initial public load, we skip profile fetch if on public page.
  // The client-side Auth Context will handle redirection after load if needed.
  if (isPublic) {
    return supabaseResponse
  }

  const { data: profile } = await supabase
    .from('profiles')
    .select('firm_id, role, status')
    .eq('id', user.id)
    .maybeSingle()

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
