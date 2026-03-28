"use client"

import { Badge } from "@/components/ui/badge"
import type { VehicleType } from "@/types/database"

const typeConfig: Record<VehicleType, { label: string; className: string }> = {
  PKW: {
    label: "PKW",
    className:
      "bg-sky-500/20 text-sky-400 border-sky-500/30 hover:bg-sky-500/30",
  },
  LKW: {
    label: "LKW",
    className:
      "bg-amber-500/20 text-amber-400 border-amber-500/30 hover:bg-amber-500/30",
  },
  Transporter: {
    label: "Transporter",
    className:
      "bg-violet-500/20 text-violet-400 border-violet-500/30 hover:bg-violet-500/30",
  },
  Motorrad: {
    label: "Motorrad",
    className:
      "bg-rose-500/20 text-rose-400 border-rose-500/30 hover:bg-rose-500/30",
  },
  "Anhänger": {
    label: "Anhänger",
    className:
      "bg-teal-500/20 text-teal-400 border-teal-500/30 hover:bg-teal-500/30",
  },
  "Verkaufsanhänger": {
    label: "Verkaufsanhänger",
    className:
      "bg-orange-500/20 text-orange-400 border-orange-500/30 hover:bg-orange-500/30",
  },
  Foodtruck: {
    label: "Foodtruck",
    className:
      "bg-lime-500/20 text-lime-400 border-lime-500/30 hover:bg-lime-500/30",
  },
  Sonstige: {
    label: "Sonstige",
    className:
      "bg-gray-500/20 text-gray-400 border-gray-500/30 hover:bg-gray-500/30",
  },
}

interface VehicleTypeBadgeProps {
  type: VehicleType
}

export function VehicleTypeBadge({ type }: VehicleTypeBadgeProps) {
  const config = typeConfig[type]

  if (!config) {
    return (
      <Badge variant="outline" className="bg-gray-500/20 text-gray-400 border-gray-500/30">
        {type}
      </Badge>
    )
  }

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}
