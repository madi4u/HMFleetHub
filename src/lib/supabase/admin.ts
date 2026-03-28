import { createClient } from "@supabase/supabase-js"

/**
 * Creates a Supabase admin client using the service role key.
 * ONLY use this server-side for privileged operations like inviteUserByEmail.
 * NEVER import this in client components or expose the service role key.
 */
export function createAdminClient() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY

  if (!supabaseUrl || !serviceRoleKey) {
    throw new Error(
      "Missing NEXT_PUBLIC_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY environment variables"
    )
  }

  if (serviceRoleKey === "REPLACE_WITH_SERVICE_ROLE_KEY_FROM_SUPABASE_DASHBOARD") {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is still a placeholder. Set it in .env.local from Supabase Dashboard > Settings > API."
    )
  }

  return createClient(supabaseUrl, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  })
}
