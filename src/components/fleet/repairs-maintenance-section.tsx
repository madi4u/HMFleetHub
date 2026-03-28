"use client"

import { useState, useEffect, useCallback } from "react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { EntryTypeBadge } from "@/components/fleet/history/entry-type-badge"
import type {
  HistoryEntry,
  HistoryEntryType,
  RepairStatus,
  PaginatedHistory,
} from "@/types/database"

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface RepairsMaintenanceSectionProps {
  vehicleId: string
  canViewFinancials: boolean
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const REPAIR_TYPES: HistoryEntryType[] = ["REPAIR", "MAINTENANCE", "DAMAGE"]

interface FilterOption {
  label: string
  value: HistoryEntryType | null
}

const FILTER_OPTIONS: FilterOption[] = [
  { label: "Alle", value: null },
  { label: "Reparaturen", value: "REPAIR" },
  { label: "Wartungen", value: "MAINTENANCE" },
  { label: "Schaeden", value: "DAMAGE" },
]

function getDueDateStatus(
  nextDueDate: string | null
): "overdue" | "soon" | "ok" | null {
  if (!nextDueDate) return null
  const due = new Date(nextDueDate)
  const now = new Date()
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return "overdue"
  if (diffDays <= 14) return "soon"
  return "ok"
}

function formatDateDE(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatCurrency(value: number, currency: string | null): string {
  return `${value.toLocaleString("de-DE", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })} ${currency || "EUR"}`
}

// ---------------------------------------------------------------------------
// RepairStatusBadge
// ---------------------------------------------------------------------------

function RepairStatusBadge({ status }: { status: RepairStatus | null }) {
  if (!status) return null

  const config: Record<RepairStatus, { label: string; className: string }> = {
    OPEN: {
      label: "Offen",
      className: "text-yellow-400 border-yellow-400/40",
    },
    IN_PROGRESS: {
      label: "In Bearbeitung",
      className: "text-blue-400 border-blue-400/40",
    },
    DONE: {
      label: "Abgeschlossen",
      className: "text-green-400 border-green-400/40",
    },
  }

  const c = config[status]

  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  )
}

// ---------------------------------------------------------------------------
// DueDateDisplay
// ---------------------------------------------------------------------------

function DueDateDisplay({ nextDueDate }: { nextDueDate: string | null }) {
  const status = getDueDateStatus(nextDueDate)
  if (!status || !nextDueDate) return null

  const dateStr = formatDateDE(nextDueDate)

  if (status === "overdue") {
    return (
      <span className="text-xs text-red-400">
        Ueberfaellig: {dateStr}
      </span>
    )
  }

  if (status === "soon") {
    return (
      <span className="text-xs text-yellow-400">
        Bald faellig: {dateStr}
      </span>
    )
  }

  return (
    <span className="text-xs text-muted-foreground">
      Folgetermin: {dateStr}
    </span>
  )
}

// ---------------------------------------------------------------------------
// Main Component
// ---------------------------------------------------------------------------

export function RepairsMaintenanceSection({
  vehicleId,
  canViewFinancials,
}: RepairsMaintenanceSectionProps) {
  const [entries, setEntries] = useState<HistoryEntry[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [typeFilter, setTypeFilter] = useState<HistoryEntryType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchEntries = useCallback(
    async (pageNum: number, filter: HistoryEntryType | null, append: boolean) => {
      setIsLoading(true)
      setError(null)

      try {
        const types = filter ? filter : REPAIR_TYPES.join(",")
        const res = await fetch(
          `/api/vehicles/${vehicleId}/history?types=${types}&page=${pageNum}`
        )

        if (!res.ok) {
          throw new Error("Daten konnten nicht geladen werden.")
        }

        const json: PaginatedHistory = await res.json()

        if (append) {
          setEntries((prev) => [...prev, ...json.data])
        } else {
          setEntries(json.data)
        }
        setHasMore(json.hasMore)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        )
      } finally {
        setIsLoading(false)
      }
    },
    [vehicleId]
  )

  // Initial load + filter change
  useEffect(() => {
    setPage(1)
    fetchEntries(1, typeFilter, false)
  }, [typeFilter, fetchEntries])

  function handleLoadMore() {
    const nextPage = page + 1
    setPage(nextPage)
    fetchEntries(nextPage, typeFilter, true)
  }

  function handleFilterChange(value: HistoryEntryType | null) {
    setTypeFilter(value)
  }

  return (
    <Card className="mt-6">
      <CardHeader>
        <CardTitle>Reparaturen &amp; Wartungen</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Filter tabs */}
        <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filteroptionen">
          {FILTER_OPTIONS.map((opt) => (
            <Badge
              key={opt.label}
              variant={typeFilter === opt.value ? "default" : "outline"}
              className="cursor-pointer select-none"
              role="tab"
              aria-selected={typeFilter === opt.value}
              onClick={() => handleFilterChange(opt.value)}
            >
              {opt.label}
            </Badge>
          ))}
        </div>

        {/* Error state */}
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}

        {/* Loading skeleton (initial load only) */}
        {isLoading && entries.length === 0 && (
          <div className="space-y-3">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="space-y-2">
                <div className="flex gap-2">
                  <Skeleton className="h-5 w-20 rounded-full" />
                  <Skeleton className="h-5 w-24 rounded-full" />
                  <Skeleton className="h-5 w-20" />
                </div>
                <Skeleton className="h-4 w-3/4" />
                <Skeleton className="h-3 w-1/2" />
              </div>
            ))}
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && entries.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">
            Noch keine Reparaturen, Wartungen oder Schaeden erfasst.
          </p>
        )}

        {/* Entries */}
        {entries.length > 0 && (
          <div className="divide-y divide-border">
            {entries.map((entry) => (
              <div key={entry.id} className="space-y-1 py-3">
                {/* Row 1: Badges + date */}
                <div className="flex flex-wrap items-center gap-2">
                  <EntryTypeBadge type={entry.entry_type} />
                  <RepairStatusBadge status={entry.repair_status} />
                  <span className="text-xs text-muted-foreground">
                    {formatDateDE(entry.event_date)}
                  </span>
                </div>

                {/* Row 2: Title or truncated message */}
                <p className="text-sm font-medium">
                  {entry.title ||
                    (entry.message
                      ? entry.message.length > 100
                        ? `${entry.message.slice(0, 100)}...`
                        : entry.message
                      : "")}
                </p>

                {/* Row 3: Meta */}
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
                  {entry.supplier && (
                    <span>Werkstatt: {entry.supplier}</span>
                  )}
                  {entry.mileage != null && (
                    <span>{entry.mileage.toLocaleString("de-DE")} km</span>
                  )}
                  {canViewFinancials && entry.cost_gross != null && (
                    <span>
                      {formatCurrency(entry.cost_gross, entry.currency)} brutto
                    </span>
                  )}
                </div>

                {/* Row 4: Folgetermin */}
                <DueDateDisplay nextDueDate={entry.next_due_date} />
              </div>
            ))}
          </div>
        )}

        {/* Load more */}
        {hasMore && (
          <div className="flex justify-center pt-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleLoadMore}
              disabled={isLoading}
            >
              {isLoading ? "Laden..." : "Mehr laden"}
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
