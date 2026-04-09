import { createServerClient, type CookieOptions } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import { updateSession } from '@/lib/supabase/middleware'

export async function middleware(request: NextRequest) {
  // The `updateSession` function will automatically refresh the session
  // token and update the user in the cookie.
  return await updateSession(request)
}

export const config = {
  matcher: [
    /*
     * Match all request paths except for the ones starting with:
     * - _next/static (static files)
     * - _next/image (image optimization files)
     * - favicon.ico (favicon file)
     * - manifest.webmanifest (PWA manifest)
     * - icons (static icons directory)
     * - any file with an extension (ending in .png, .svg, .webp, .ico, .json, .txt)
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|icons|sw\\.js|.*\\.js$|.*\\.css$|.*\\.png$|.*\\.svg$|.*\\.webp$|.*\\.ico$|.*\\.json$|.*\\.txt$).*)',
  ],
}
