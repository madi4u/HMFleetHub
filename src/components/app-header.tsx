"use client"

import { LogOut, User } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { SidebarTrigger } from "@/components/ui/sidebar"
import { Separator } from "@/components/ui/separator"
import { AppBreadcrumbs } from "@/components/app-breadcrumbs"
import type { UserRole } from "@/lib/navigation"

/**
 * Human-readable labels for role badges.
 */
const roleLabels: Record<UserRole, string> = {
  SUPERADMIN: "Superadmin",
  TENANT_ADMIN: "Tenant Admin",
  FLEET_MANAGER: "Fuhrparkleiter",
  OFFICE_USER: "Sachbearbeiter",
  WORKSHOP_MECHANIC: "Werkstatt",
  READ_ONLY: "Lesezugriff",
}

interface AppHeaderProps {
  userName: string
  userRole: UserRole
  userEmail?: string
  onLogout: () => void
}

export function AppHeader({
  userName,
  userRole,
  userEmail,
  onLogout,
}: AppHeaderProps) {
  // Generate initials from user name
  const initials = userName
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2)

  return (
    <header className="flex h-16 shrink-0 items-center gap-2 border-b border-border bg-background px-4">
      {/* Mobile sidebar toggle */}
      <SidebarTrigger className="-ml-1" />

      <Separator orientation="vertical" className="mr-2 h-4" />

      {/* Breadcrumbs */}
      <div className="flex-1 overflow-hidden">
        <AppBreadcrumbs />
      </div>

      {/* User section */}
      <div className="flex items-center gap-3">
        {/* Role badge - hidden on mobile to save space */}
        <Badge variant="secondary" className="hidden sm:inline-flex">
          {roleLabels[userRole]}
        </Badge>

        {/* User dropdown */}
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button
              variant="ghost"
              className="relative h-8 w-8 rounded-full"
              aria-label="Benutzermenue oeffnen"
            >
              <Avatar className="h-8 w-8">
                <AvatarFallback className="bg-sidebar-primary text-sidebar-primary-foreground text-xs">
                  {initials}
                </AvatarFallback>
              </Avatar>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent className="w-56" align="end" forceMount>
            <DropdownMenuLabel className="font-normal">
              <div className="flex flex-col space-y-1">
                <p className="text-sm font-medium leading-none">{userName}</p>
                {userEmail && (
                  <p className="text-xs leading-none text-muted-foreground">
                    {userEmail}
                  </p>
                )}
                <Badge variant="outline" className="mt-1 w-fit text-xs">
                  {roleLabels[userRole]}
                </Badge>
              </div>
            </DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <button
                onClick={onLogout}
                className="flex w-full cursor-pointer items-center"
              >
                <LogOut className="mr-2 h-4 w-4" />
                <span>Abmelden</span>
              </button>
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  )
}
