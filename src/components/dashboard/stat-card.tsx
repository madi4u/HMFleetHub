import { Card, CardContent } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

interface StatCardProps {
  title: string
  value: number | string
  description?: string
  icon: LucideIcon
  variant?: "default" | "warning" | "danger"
}

const iconVariantClasses: Record<string, string> = {
  default: "text-muted-foreground",
  warning: "text-yellow-400",
  danger: "text-red-400",
}

export function StatCard({
  title,
  value,
  description,
  icon: Icon,
  variant = "default",
}: StatCardProps) {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-between">
          <div className="space-y-1">
            <p className="text-sm font-medium text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold">{value}</p>
            {description && (
              <p className="text-xs text-muted-foreground">{description}</p>
            )}
          </div>
          <Icon
            className={cn("h-8 w-8 shrink-0", iconVariantClasses[variant])}
            aria-hidden="true"
          />
        </div>
      </CardContent>
    </Card>
  )
}
