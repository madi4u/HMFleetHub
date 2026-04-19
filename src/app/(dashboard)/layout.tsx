import { redirect } from "next/navigation"
import { getSessionFromHeaders } from "@/lib/session"
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

  const user = {
    id: session.userId,
    email: session.email,
    name: session.name || session.email.split("@")[0] || "Benutzer",
    role: (session.appRole?.toUpperCase() ?? "VIEWER") as UserRole,
    tenantName: session.activeOrgName || "",
  }

  return <DashboardShell user={user}>{children}</DashboardShell>
}
