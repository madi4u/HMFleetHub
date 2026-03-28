import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"

/**
 * Root page: checks auth state and redirects accordingly.
 * - Authenticated users go to /dashboard
 * - Unauthenticated users go to /login
 */
export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (user) {
    redirect("/dashboard")
  } else {
    redirect("/login")
  }
}
