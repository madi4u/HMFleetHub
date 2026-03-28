import { Badge } from "@/components/ui/badge"
import type { ContractStatus } from "@/types/database"

const CONFIG: Record<ContractStatus, { label: string; className: string }> = {
  ACTIVE: { label: "Aktiv", className: "border-green-500/50 text-green-400" },
  EXPIRED: {
    label: "Abgelaufen",
    className: "border-red-500/50 text-red-400",
  },
  CANCELLED: {
    label: "Gekuendigt",
    className: "border-gray-500/50 text-gray-400",
  },
  PLANNED: {
    label: "Geplant",
    className: "border-yellow-500/50 text-yellow-400",
  },
}

interface ContractStatusBadgeProps {
  status: ContractStatus
}

export function ContractStatusBadge({ status }: ContractStatusBadgeProps) {
  const { label, className } = CONFIG[status]
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}
