import { createBrowserClient } from "@supabase/ssr";

// Extract environment variables with fallback to empty strings
const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY || '';

// Warn if credentials are missing
if (!supabaseUrl || !supabaseKey) {
  console.warn('⚠️ Supabase credentials missing in environment.');
}

let client: ReturnType<typeof createBrowserClient> | undefined;

export const createClient = () => {
  if (client) return client;
  
  if (!supabaseUrl || !supabaseKey) {
    console.error("Critical: Supabase Configuration Missing.");
    return {} as any; // Prevent hard crash
  }

  client = createBrowserClient(
    supabaseUrl,
    supabaseKey,
  );
  
  return client;
};