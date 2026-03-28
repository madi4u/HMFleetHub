"use client"

import { SidebarProvider, SidebarInset } from "@/components/ui/sidebar"
import { AppSidebar } from "@/components/app-sidebar"
import { AppHeader } from "@/components/app-header"
import { UserProvider, useLogout } from "@/components/user-provider"
import type { AppUser } from "@/components/user-provider"

function ShellInner({
  user,
  children,
}: {
  user: AppUser
  children: React.ReactNode
}) {
  const logout = useLogout()

  return (
    <SidebarProvider>
      <AppSidebar userRole={user.role} />
      <SidebarInset>
        <AppHeader
          userName={user.name}
          userRole={user.role}
          userEmail={user.email}
          onLogout={logout}
        />
        <main className="flex-1 overflow-auto p-4 md:p-6">{children}</main>
      </SidebarInset>
    </SidebarProvider>
  )
}

/**
 * Client shell for the dashboard layout.
 * Wraps children with UserProvider context and renders
 * the sidebar + header with logout functionality.
 */
export function DashboardShell({
  user,
  children,
}: {
  user: AppUser
  children: React.ReactNode
}) {
  return (
    <UserProvider user={user}>
      <ShellInner user={user}>{children}</ShellInner>
    </UserProvider>
  )
}
