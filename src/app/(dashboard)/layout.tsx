import { redirect } from "next/navigation"
import { getSessionFromHeaders } from "@/lib/session"
import { db } from "@/lib/db"
import { DashboardShell } from "@/components/dashboard-shell"
import type { UserRole } from "@/lib/navigation"

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await getSessionFromHeaders()

  if (!session) {
    redirect("/login")
  }

  const membership = await db
    .from("user_tenant_memberships")
    .select("role")
    .eq("user_id", session.userId)
    .eq("is_active", true)
    .limit(1)
    .single()

  const dbRole = (membership.data as { role?: string } | null)?.role
  const role = (dbRole ?? session.appRole ?? "READ_ONLY").toUpperCase() as UserRole

  const user = {
    id: session.userId,
    email: session.email,
    name: session.name || session.email.split("@")[0] || "Benutzer",
    role,
    tenantName: session.activeOrgName || "",
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
