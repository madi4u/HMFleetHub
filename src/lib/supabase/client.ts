import { createBrowserClient } from "@supabase/ssr"

/**
 * Creates a Supabase client for use in browser/client components.
 * Uses @supabase/ssr for proper cookie-based session handling.
 */
export function createClient() {
  return createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
