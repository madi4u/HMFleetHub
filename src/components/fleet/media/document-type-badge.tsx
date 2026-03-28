"use client"

import { Badge } from "@/components/ui/badge"
import type { VehicleDocumentType } from "@/types/database"

const DOCUMENT_TYPE_CONFIG: Record<
  VehicleDocumentType,
  { label: string; className: string }
> = {
  REGISTRATION_CERTIFICATE: {
    label: "Fahrzeugschein",
    className: "border-blue-500/50 text-blue-400 bg-blue-500/10",
  },
  INSURANCE: {
    label: "Versicherung",
    className: "border-green-500/50 text-green-400 bg-green-500/10",
  },
  LEASE_CONTRACT: {
    label: "Leasingvertrag",
    className: "border-purple-500/50 text-purple-400 bg-purple-500/10",
  },
  FINANCING_CONTRACT: {
    label: "Finanzierungsvertrag",
    className: "border-purple-500/50 text-purple-400 bg-purple-500/10",
  },
  INVOICE: {
    label: "Rechnung",
    className: "border-yellow-500/50 text-yellow-400 bg-yellow-500/10",
  },
  INSPECTION_REPORT: {
    label: "Pruefbericht",
    className: "border-orange-500/50 text-orange-400 bg-orange-500/10",
  },
  OTHER: {
    label: "Sonstiges",
    className: "border-gray-500/50 text-gray-400 bg-gray-500/10",
  },
}

export function getDocumentTypeLabel(type: VehicleDocumentType): string {
  return DOCUMENT_TYPE_CONFIG[type]?.label ?? type
}

interface DocumentTypeBadgeProps {
  type: VehicleDocumentType
}

export function DocumentTypeBadge({ type }: DocumentTypeBadgeProps) {
  const config = DOCUMENT_TYPE_CONFIG[type] ?? DOCUMENT_TYPE_CONFIG.OTHER

  return (
    <Badge variant="outline" className={config.className}>
      {config.label}
    </Badge>
  )
}
