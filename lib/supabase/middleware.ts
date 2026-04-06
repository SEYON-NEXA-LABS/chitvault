import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value, options }) => request.cookies.set(name, value))
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

  // Not logged in — allow public pages, invite links, and access-denied
  if (!user && !isPublic && !isInvite && !isDenied) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged in — enforce routing
  if (user) {
    const { data: profile } = await supabase
      .from('profiles').select('firm_id, role, status').eq('id', user.id).maybeSingle()

    // 0. If account is inactive —> Force Access Denied (unless already there)
    if (profile?.status === 'inactive' && !isDenied) {
      const url = request.nextUrl.clone()
      url.pathname = '/access-denied'
      return NextResponse.redirect(url)
    }

    // 1. If on Onboarding but already have a firm —> Forward to Dashboard
    if (isOnboarding && profile?.firm_id) {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // 2. If on Public page —> Forward to App
    if (isPublic) {
      if (profile?.role === 'superadmin') {
        return NextResponse.redirect(new URL('/admin', request.url))
      }
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

  // 3. If on Protected route —> Enforce guards
    if (!isPublic && !isOnboarding && !isInvite && !isDenied) {
      // Admin-only areas
      if (isAdmin && profile?.role !== 'superadmin') {
        return NextResponse.redirect(new URL('/dashboard', request.url))
      }

      // If no profile at all, force onboarding
      if (!profile && !isAdmin) {
        return NextResponse.redirect(new URL('/onboarding', request.url))
      }
    }
  }

  return supabaseResponse
}
