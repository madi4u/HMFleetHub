import Link from "next/link"
import { ShieldAlert } from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardData } from "@/types/database"

type TuevItem = DashboardData["operative"]["upcoming_tuev"][number]

interface UpcomingTuevListProps {
  items: TuevItem[]
}

function getTuevColor(tuevBisStr: string): string {
  const now = new Date()
  // TÜV expires at end of the month stored in tuev_bis
  const d = new Date(tuevBisStr)
  const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const diffMs = endOfMonth.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return "text-red-400"
  if (diffDays <= 30) return "text-red-400"
  if (diffDays <= 60) return "text-yellow-400"
  return "text-muted-foreground"
}

function getDotColor(tuevBisStr: string): string {
  const now = new Date()
  const d = new Date(tuevBisStr)
  const endOfMonth = new Date(d.getFullYear(), d.getMonth() + 1, 0)
  const diffMs = endOfMonth.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays < 0) return "bg-red-500"
  if (diffDays <= 30) return "bg-red-400"
  if (diffDays <= 60) return "bg-yellow-400"
  return "bg-blue-400"
}

function formatTuev(tuevBisStr: string): string {
  return new Date(tuevBisStr).toLocaleDateString("de-DE", {
    month: "2-digit",
    year: "numeric",
  })
}

export function UpcomingTuevList({ items }: UpcomingTuevListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <ShieldAlert className="h-4 w-4 text-yellow-500" />
          TÜV Ablauf (90 Tage)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="py-4 text-center text-sm text-muted-foreground">
            Kein TÜV-Ablauf in den naechsten 90 Tagen.
          </p>
        ) : (
          <ul className="space-y-3" role="list">
            {items.map((item) => (
              <li key={item.vehicle_id}>
                <Link
                  href={`/fleet/${item.vehicle_id}`}
                  className="flex items-center gap-3 rounded-md px-2 py-1.5 transition-colors hover:bg-muted/50"
                >
                  <span
                    className={cn(
                      "h-2.5 w-2.5 shrink-0 rounded-full",
                      getDotColor(item.tuev_bis)
                    )}
                    aria-hidden="true"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className="truncate text-sm font-semibold">
                        {item.license_plate}
                      </span>
                      <span className="truncate text-xs text-muted-foreground">
                        {item.make} {item.model}
                      </span>
                    </div>
                  </div>
                  <span
                    className={cn(
                      "shrink-0 text-xs font-medium",
                      getTuevColor(item.tuev_bis)
                    )}
                  >
                    {formatTuev(item.tuev_bis)}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  )
}
