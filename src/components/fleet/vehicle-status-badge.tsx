"use client"

import { Badge } from "@/components/ui/badge"
import type { VehicleStatus } from "@/types/database"

const statusConfig: Record<VehicleStatus, { label: string; className: string }> = {
  Aktiv: {
    label: "Aktiv",
    className:
      "bg-green-500/20 text-green-400 border-green-500/30 hover:bg-green-500/30",
  },
  "In Werkstatt": {
    label: "In Werkstatt",
    className:
      "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30",
  },
  Inaktiv: {
    label: "Inaktiv",
    className:
      "bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30",
  },
  Verkauft: {
    label: "Verkauft",
    className:
      "bg-blue-500/20 text-blue-400 border-blue-500/30 hover:bg-blue-500/30",
  },
  Abgemeldet: {
    label: "Abgemeldet",
    className:
      "bg-red-500/20 text-red-400 border-red-500/30 hover:bg-red-500/30",
  },
}

interface VehicleStatusBadgeProps {
  status: VehicleStatus
}

export function VehicleStatusBadge({ status }: VehicleStatusBadgeProps) {
  const config = statusConfig[status]

  if (!config) {
    return (
      <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
        {status}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}
