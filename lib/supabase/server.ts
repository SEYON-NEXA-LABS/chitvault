import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Used in Server Components, Route Handlers, Server Actions
export function createClient() {
  const cookieStore = cookies()
  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll()         { return cookieStore.getAll() },
        setAll(toSet: any[])    {
          try { toSet.forEach(({ name, value, options }: any) =>
            cookieStore.set(name, value, options)) }
          catch { /* read-only context */ }
        },
      },
    }
  )
}
