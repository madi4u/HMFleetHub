import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ENTRY_TYPE_CONFIG } from "@/components/fleet/history/entry-type-badge"
import { cn } from "@/lib/utils"
import type { DashboardData } from "@/types/database"

type MaintenanceItem = DashboardData["operative"]["upcoming_maintenance"][number]

interface UpcomingMaintenanceListProps {
  items: MaintenanceItem[]
}

function getDueColor(dueDateStr: string): string {
  const now = new Date()
  const due = new Date(dueDateStr)
  const diffMs = due.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return "text-red-400"
  if (diffDays <= 14) return "text-yellow-400"
  return "text-muted-foreground"
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

export function UpcomingMaintenanceList({
  items,
}: UpcomingMaintenanceListProps) {
  const displayed = items.slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Bald fällige Termine (30 Tage)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Keine fälligen Termine in den nächsten 30 Tagen.
          </p>
        ) : (
          <ul className="space-y-3" role="list">
            {displayed.map((item) => {
              const config = ENTRY_TYPE_CONFIG[item.entry_type]
              const dueColor = getDueColor(item.next_due_date)

              return (
                <li key={item.id}>
                  <Link
                    href={`/fleet/${item.vehicle_id}`}
                    className="flex items-center gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className={cn(
                        "h-2.5 w-2.5 shrink-0 rounded-full",
                        config
                          ? config.colorClass.split(" ")[0].replace("text-", "bg-")
                          : "bg-gray-400"
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm truncate">
                          {item.vehicle_license_plate}
                        </span>
                        <span className="text-xs text-muted-foreground truncate">
                          {item.vehicle_make} {item.vehicle_model}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground truncate">
                        {config?.label ?? item.entry_type}
                        {item.title ? ` - ${item.title}` : ""}
                      </p>
                    </div>
                    <span
                      className={cn("text-xs font-medium shrink-0", dueColor)}
                    >
                      {formatDate(item.next_due_date)}
                    </span>
                  </Link>
                </li>
              )
            })}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
