import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ENTRY_TYPE_CONFIG } from "@/components/fleet/history/entry-type-badge"
import { cn } from "@/lib/utils"
import { formatDistanceToNow } from "date-fns"
import { de } from "date-fns/locale"
import type { DashboardRecentActivity } from "@/types/database"

interface RecentActivityListProps {
  items: DashboardRecentActivity[]
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text
  return text.slice(0, max) + "..."
}

export function RecentActivityList({ items }: RecentActivityListProps) {
  const displayed = items.slice(0, 10)

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Letzte Aktivitaeten</CardTitle>
      </CardHeader>
      <CardContent>
        {displayed.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Noch keine Aktivitaeten vorhanden.
          </p>
        ) : (
          <ul className="space-y-3" role="list">
            {displayed.map((item) => {
              const config = ENTRY_TYPE_CONFIG[item.entry_type]
              const summary =
                item.title ?? (item.message ? truncate(item.message, 60) : null)
              const timeAgo = formatDistanceToNow(new Date(item.created_at), {
                addSuffix: true,
                locale: de,
              })

              return (
                <li key={item.id}>
                  <Link
                    href={`/fleet/${item.vehicle_id}`}
                    className="flex items-start gap-3 rounded-md px-2 py-1.5 hover:bg-muted/50 transition-colors"
                  >
                    <span
                      className={cn(
                        "mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full",
                        config
                          ? config.colorClass.split(" ")[0].replace("text-", "bg-")
                          : "bg-gray-400"
                      )}
                      aria-hidden="true"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm">
                          {item.vehicle_license_plate}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {config?.label ?? item.entry_type}
                        </span>
                      </div>
                      {summary && (
                        <p className="text-xs text-muted-foreground truncate">
                          {summary}
                        </p>
                      )}
                      <p className="text-xs text-muted-foreground/70 mt-0.5">
                        {item.author_name && `${item.author_name} · `}
                        {timeAgo}
                      </p>
                    </div>
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
