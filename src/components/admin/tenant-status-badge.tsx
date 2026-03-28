"use client"

import { Badge } from "@/components/ui/badge"
import type { TenantStatus } from "@/types/database"

interface TenantStatusBadgeProps {
  status: TenantStatus
}

export function TenantStatusBadge({ status }: TenantStatusBadgeProps) {
  if (status === "active") {
    return (
      <Badge
        variant="default"
        className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
      >
        Aktiv
      </Badge>
    )
  }

  return (
    <Badge
      variant="destructive"
      className="bg-red-600 text-white hover:bg-red-700 dark:bg-red-700 dark:hover:bg-red-600"
    >
      Inaktiv
    </Badge>
  )
}
