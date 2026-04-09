import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";

const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_DEFAULT_KEY;

export const createClient = async (cookieStore?: Awaited<ReturnType<typeof cookies>>) => {
  // If no cookie store provided, try to get it from next/headers
  if (!cookieStore) {
    try {
      cookieStore = await cookies()
    } catch (e) {
      // Cookies not available (e.g. static build or metadata route)
    }
  }

  return createServerClient(
    supabaseUrl!,
    supabaseKey!,
    {
      cookies: {
        getAll() {
          if (!cookieStore) return []
          return typeof cookieStore.getAll === 'function' ? cookieStore.getAll() : []
        },
        setAll(cookiesToSet) {
          try {
            if (cookieStore && typeof cookieStore.set === 'function') {
              cookiesToSet.forEach(({ name, value, options }) => cookieStore.set(name, value, options))
            }
          } catch {
            // The `setAll` method was called from a Server Component.
            // This can be ignored if you have middleware refreshing
            // user sessions.
          }
        },
      },
    },
  );
};

// Admin Client: High-privilege client using Service Role Key
// ONLY USE IN SERVER COMPONENTS / ACTIONS WITH SUPERADMIN CHECKS
export const createAdminClient = () => {
  return createServerClient(
    supabaseUrl!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      cookies: {
        getAll() { return [] },
        setAll() { },
      },
    }
  );
};