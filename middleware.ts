import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

export async function middleware(request: NextRequest) {
  let supabaseResponse = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()      { return request.cookies.getAll() },
        setAll(toSet) {
          toSet.forEach(({ name, value }) => request.cookies.set(name, value))
          supabaseResponse = NextResponse.next({ request })
          toSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options))
        },
      },
    }
  )

  const { data: { user } } = await supabase.auth.getUser()
  const { pathname } = request.nextUrl

  const isPublic     = ['/login', '/register', '/'].some(p => pathname === p)
  const isAdmin      = pathname.startsWith('/admin')
  const isOnboarding = pathname === '/onboarding'
  const isInvite     = pathname.startsWith('/invite')

  // Not logged in — allow public pages and invite links only
  if (!user && !isPublic && !isInvite) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  // Logged in on a public page — route to the right place
  if (user && isPublic) {
    const { data: profile, error } = await supabase
      .from('profiles').select('firm_id, role').eq('id', user.id).maybeSingle()

    // If no profile exists yet, send to /onboarding (user hasn't completed registration)
    if (!profile) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    if (profile?.role === 'superadmin') {
      const url = request.nextUrl.clone()
      url.pathname = '/admin'
      return NextResponse.redirect(url)
    }

    const url = request.nextUrl.clone()
    url.pathname = '/dashboard'
    return NextResponse.redirect(url)
  }

  // Logged in, protected route — enforce admin guard + firm check
  if (user && !isPublic && !isOnboarding && !isInvite) {
    const { data: profile } = await supabase
      .from('profiles').select('firm_id, role').eq('id', user.id).maybeSingle()

    // If no profile exists, redirect to onboarding to complete registration
    if (!profile) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }

    if (isAdmin && profile?.role !== 'superadmin') {
      const url = request.nextUrl.clone()
      url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }

    // Enforce firm_id requirement
    if (!profile?.firm_id && !isAdmin) {
      const url = request.nextUrl.clone()
      url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|.*\\.png$|.*\\.ico$).*)'],
}
