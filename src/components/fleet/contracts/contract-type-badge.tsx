import { Badge } from "@/components/ui/badge"
import type { ContractType } from "@/types/database"

const CONFIG: Record<ContractType, { label: string; className: string }> = {
  LEASING: { label: "Leasing", className: "border-blue-500/50 text-blue-400" },
  FINANCING: {
    label: "Finanzierung",
    className: "border-purple-500/50 text-purple-400",
  },
  PURCHASE: {
    label: "Barkauf",
    className: "border-green-500/50 text-green-400",
  },
}

interface ContractTypeBadgeProps {
  type: ContractType
}

export function ContractTypeBadge({ type }: ContractTypeBadgeProps) {
  const { label, className } = CONFIG[type]
  return (
    <Badge variant="outline" className={className}>
      {label}
    </Badge>
  )
}
