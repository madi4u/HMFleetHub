"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { Car } from "lucide-react"

import {
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
  SidebarSeparator,
} from "@/components/ui/sidebar"
import { getNavigationForRole, type UserRole } from "@/lib/navigation"

interface AppSidebarProps {
  userRole: UserRole
}

export function AppSidebar({ userRole }: AppSidebarProps) {
  const pathname = usePathname()
  const navigationGroups = getNavigationForRole(userRole)

  return (
    <Sidebar collapsible="icon" className="border-r border-sidebar-border">
      {/* Branding */}
      <SidebarHeader className="h-16 items-center justify-center border-b border-sidebar-border">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-2"
          aria-label="H+M FleetHub - Startseite"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md bg-sidebar-primary text-sidebar-primary-foreground">
            <Car className="h-4 w-4" />
          </div>
          <span className="truncate text-base font-semibold tracking-tight text-sidebar-foreground group-data-[collapsible=icon]:hidden">
            H+M FleetHub
          </span>
        </Link>
      </SidebarHeader>

      {/* Navigation groups */}
      <SidebarContent>
        {navigationGroups.map((group, groupIndex) => (
          <div key={group.label}>
            {groupIndex > 0 && <SidebarSeparator />}
            <SidebarGroup>
              <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
              <SidebarGroupContent>
                <SidebarMenu>
                  {group.items.map((item) => {
                    const isActive =
                      pathname === item.href ||
                      pathname.startsWith(item.href + "/")

                    return (
                      <SidebarMenuItem key={item.href}>
                        <SidebarMenuButton
                          asChild
                          isActive={isActive}
                          tooltip={item.title}
                        >
                          <Link href={item.href}>
                            <item.icon className="h-4 w-4" />
                            <span>{item.title}</span>
                          </Link>
                        </SidebarMenuButton>
                      </SidebarMenuItem>
                    )
                  })}
                </SidebarMenu>
              </SidebarGroupContent>
            </SidebarGroup>
          </div>
        ))}
      </SidebarContent>

      <SidebarRail />
    </Sidebar>
  )
}
