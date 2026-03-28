"use client"

import { Badge } from "@/components/ui/badge"
import type { UserRole } from "@/types/database"

const roleConfig: Record<
  UserRole,
  { label: string; className: string }
> = {
  SUPERADMIN: {
    label: "Superadmin",
    className:
      "bg-purple-500/20 text-purple-400 border-purple-500/30 hover:bg-purple-500/30",
  },
  TENANT_ADMIN: {
    label: "Mandanten-Admin",
    className:
      "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30",
  },
  FLEET_MANAGER: {
    label: "Fuhrparkleiter",
    className:
      "bg-cyan-500/20 text-cyan-400 border-cyan-500/30 hover:bg-cyan-500/30",
  },
  OFFICE_USER: {
    label: "Büroanwender",
    className:
      "bg-yellow-500/20 text-yellow-400 border-yellow-500/30 hover:bg-yellow-500/30",
  },
  WORKSHOP_MECHANIC: {
    label: "Werkstatt",
    className:
      "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30",
  },
  READ_ONLY: {
    label: "Nur Lesen",
    className:
      "bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30",
  },
}

interface RoleBadgeProps {
  role: UserRole
}

export function RoleBadge({ role }: RoleBadgeProps) {
  const config = roleConfig[role]

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}

/**
 * Returns the German display label for a role.
 */
export function getRoleLabel(role: UserRole): string {
  return roleConfig[role]?.label ?? role
}
