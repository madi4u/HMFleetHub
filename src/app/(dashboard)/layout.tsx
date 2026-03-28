import { redirect } from "next/navigation"
import { createClient } from "@/lib/supabase/server"
import { DashboardShell } from "@/components/dashboard-shell"
import type { UserRole } from "@/lib/navigation"

/**
 * Server-side dashboard layout.
 * Auth check happens on the server (same mechanism as middleware),
 * so there are no client-side Supabase calls or redirect loops.
 */
export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()

  const {
    data: { user: authUser },
  } = await supabase.auth.getUser()

  if (!authUser) {
    redirect("/login")
  }

  const { data: membership } = await supabase
    .from("user_tenant_memberships")
    .select("role")
    .eq("user_id", authUser.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!membership) {
    redirect("/login")
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", authUser.id)
    .single()

  const user = {
    id: authUser.id,
    email: authUser.email || "",
    name: profile?.full_name || authUser.email?.split("@")[0] || "Benutzer",
    role: membership.role as UserRole,
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
