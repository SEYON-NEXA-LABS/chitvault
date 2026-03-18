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
  const isPublic = ['/login','/register'].some(p => pathname.startsWith(p))
  const isAdmin  = pathname.startsWith('/admin')
  const isOnboarding = pathname === '/onboarding'

  if (!user && !isPublic) {
    const url = request.nextUrl.clone(); url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && !isPublic && !isOnboarding) {
    const { data: profile } = await supabase
      .from('profiles').select('firm_id,role').eq('id', user.id).single()
    if (isAdmin && profile?.role !== 'superadmin') {
      const url = request.nextUrl.clone(); url.pathname = '/dashboard'
      return NextResponse.redirect(url)
    }
    if (!profile?.firm_id && !isAdmin) {
      const url = request.nextUrl.clone(); url.pathname = '/onboarding'
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico|icons|.*\\.png$).*)'],
}
