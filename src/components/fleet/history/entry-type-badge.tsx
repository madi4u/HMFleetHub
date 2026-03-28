"use client"

import {
  MessageSquare,
  Wrench,
  Settings,
  Droplets,
  CircleDot,
  AlertTriangle,
  ClipboardCheck,
  ShieldCheck,
  Gauge,
  FileText,
  Camera,
  Video,
  MoreHorizontal,
  type LucideIcon,
} from "lucide-react"

import { Badge } from "@/components/ui/badge"
import type { HistoryEntryType } from "@/types/database"

interface EntryTypeConfig {
  label: string
  colorClass: string
  icon: LucideIcon
}

const ENTRY_TYPE_CONFIG: Record<HistoryEntryType, EntryTypeConfig> = {
  NOTE: { label: "Notiz", colorClass: "text-gray-400 border-gray-400/40", icon: MessageSquare },
  REPAIR: { label: "Reparatur", colorClass: "text-red-400 border-red-400/40", icon: Wrench },
  MAINTENANCE: { label: "Wartung", colorClass: "text-blue-400 border-blue-400/40", icon: Settings },
  OIL_CHANGE: { label: "Oelwechsel", colorClass: "text-yellow-400 border-yellow-400/40", icon: Droplets },
  TIRE_CHANGE: { label: "Reifenwechsel", colorClass: "text-green-400 border-green-400/40", icon: CircleDot },
  DAMAGE: { label: "Schaden", colorClass: "text-orange-400 border-orange-400/40", icon: AlertTriangle },
  INSPECTION: { label: "Inspektion", colorClass: "text-purple-400 border-purple-400/40", icon: ClipboardCheck },
  TUV: { label: "TUEV", colorClass: "text-blue-400 border-blue-400/40", icon: ShieldCheck },
  MILEAGE_UPDATE: { label: "Kilometerstand", colorClass: "text-cyan-400 border-cyan-400/40", icon: Gauge },
  DOCUMENT_UPLOAD: { label: "Dokument", colorClass: "text-gray-400 border-gray-400/40", icon: FileText },
  PHOTO_UPLOAD: { label: "Foto", colorClass: "text-green-400 border-green-400/40", icon: Camera },
  VIDEO_UPLOAD: { label: "Video", colorClass: "text-red-400 border-red-400/40", icon: Video },
  OTHER: { label: "Sonstiges", colorClass: "text-gray-400 border-gray-400/40", icon: MoreHorizontal },
}

export { ENTRY_TYPE_CONFIG }

interface EntryTypeBadgeProps {
  type: HistoryEntryType
}

export function EntryTypeBadge({ type }: EntryTypeBadgeProps) {
  const config = ENTRY_TYPE_CONFIG[type]
  const Icon = config.icon

  return (
    <Badge variant="outline" className={config.colorClass}>
      <Icon className="mr-1 h-3 w-3" />
      {config.label}
    </Badge>
  )
}
