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
    .select("role, tenant_id")
    .eq("user_id", authUser.id)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!membership) {
    redirect("/login")
  }

  const [profileResult, tenantResult] = await Promise.all([
    supabase
      .from("profiles")
      .select("full_name")
      .eq("id", authUser.id)
      .single(),
    supabase
      .from("tenants")
      .select("name")
      .eq("id", membership.tenant_id)
      .single(),
  ])

  const user = {
    id: authUser.id,
    email: authUser.email || "",
    name: profileResult.data?.full_name || authUser.email?.split("@")[0] || "Benutzer",
    role: membership.role as UserRole,
    tenantName: tenantResult.data?.name || "",
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
