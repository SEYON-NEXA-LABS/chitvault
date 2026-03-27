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

  // Not logged in — allow public pages and invite links only
  if (!user && !isPublic && !isInvite) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged in on a public page — route to the right place
  if (user && isPublic) {
    const { data: profile } = await supabase
      .from('profiles').select('firm_id, role').eq('id', user.id).maybeSingle()

    if (profile?.role === 'superadmin') {
      return NextResponse.redirect(new URL('/admin', request.url))
    }

    // Default to dashboard for authenticated users on public pages
    return NextResponse.redirect(new URL('/dashboard', request.url))
  }

  // Logged in, protected route — enforce admin guard
  if (user && !isPublic && !isOnboarding && !isInvite) {
    const { data: profile } = await supabase
      .from('profiles').select('firm_id, role').eq('id', user.id).maybeSingle()

    // Admin-only areas
    if (isAdmin && profile?.role !== 'superadmin') {
      return NextResponse.redirect(new URL('/dashboard', request.url))
    }

    // If no profile or firm_id at all, only then force onboarding
    if (!profile && !isAdmin) {
      return NextResponse.redirect(new URL('/onboarding', request.url))
    }
  }

  return supabaseResponse
}
