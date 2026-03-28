"use client"

import { useState, useEffect } from "react"
import { Loader2, ShieldAlert } from "lucide-react"

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import type { CostCategory, CostSummary } from "@/types/database"

// ---------------------------------------------------------------------------
// Category mappings
// ---------------------------------------------------------------------------

const CATEGORY_LABELS: Record<CostCategory, string> = {
  REPAIR: "Reparatur",
  MAINTENANCE: "Wartung",
  OIL: "Oelwechsel",
  TIRES: "Reifen",
  INSPECTION: "Inspektion",
  BODYWORK: "Karosserie",
  ELECTRICAL: "Elektrik",
  OTHER: "Sonstiges",
}

const CATEGORY_COLORS: Record<CostCategory, string> = {
  REPAIR: "bg-red-500",
  MAINTENANCE: "bg-blue-500",
  OIL: "bg-yellow-500",
  TIRES: "bg-green-500",
  INSPECTION: "bg-purple-500",
  BODYWORK: "bg-orange-500",
  ELECTRICAL: "bg-cyan-500",
  OTHER: "bg-gray-500",
}

const MONTH_NAMES = [
  "Jan",
  "Feb",
  "Mär",
  "Apr",
  "Mai",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Okt",
  "Nov",
  "Dez",
]

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCurrency(value: number): string {
  return value.toLocaleString("de-DE", { style: "currency", currency: "EUR" })
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface CostSummaryTabProps {
  vehicleId: string
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CostSummaryTab({ vehicleId }: CostSummaryTabProps) {
  const [data, setData] = useState<CostSummary | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [forbidden, setForbidden] = useState(false)

  useEffect(() => {
    async function fetchCosts() {
      setIsLoading(true)
      setError(null)
      setForbidden(false)

      try {
        const res = await fetch(`/api/vehicles/${vehicleId}/costs`)
        if (res.status === 403) {
          setForbidden(true)
          return
        }
        if (!res.ok) throw new Error("Kostendaten konnten nicht geladen werden.")
        const json: CostSummary = await res.json()
        setData(json)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        )
      } finally {
        setIsLoading(false)
      }
    }

    fetchCosts()
  }, [vehicleId])

  if (isLoading) {
    return <CostSummarySkeleton />
  }

  if (forbidden) {
    return (
      <Card>
        <CardContent className="flex items-center gap-3 py-8">
          <ShieldAlert className="h-5 w-5 text-muted-foreground" />
          <p className="text-sm text-muted-foreground">
            Keine Berechtigung fuer Finanzdaten.
          </p>
        </CardContent>
      </Card>
    )
  }

  if (error) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-destructive">{error}</p>
        </CardContent>
      </Card>
    )
  }

  if (!data || (data.total_gross === 0 && data.by_category.length === 0)) {
    return (
      <Card>
        <CardContent className="py-8">
          <p className="text-sm text-muted-foreground">
            Noch keine Kosten erfasst.
          </p>
        </CardContent>
      </Card>
    )
  }

  const sortedCategories = [...data.by_category].sort(
    (a, b) => b.total_gross - a.total_gross
  )

  const sortedMonths = [...data.by_month].sort((a, b) => {
    if (b.year !== a.year) return b.year - a.year
    return b.month - a.month
  })

  return (
    <div className="space-y-6">
      {/* Gesamtkosten */}
      <Card>
        <CardHeader>
          <CardTitle>Gesamtkosten</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-3xl font-bold">{formatCurrency(data.total_gross)}</p>
          <p className="text-sm text-muted-foreground">
            Netto: {formatCurrency(data.total_net)}
          </p>
        </CardContent>
      </Card>

      {/* Kosten nach Kategorie */}
      {sortedCategories.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Kosten nach Kategorie</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {sortedCategories.map((item) => (
                <div
                  key={item.category}
                  className="flex items-center justify-between gap-4"
                >
                  <div className="flex items-center gap-3">
                    <span
                      className={`h-3 w-3 rounded-full ${CATEGORY_COLORS[item.category]}`}
                      aria-hidden="true"
                    />
                    <span className="text-sm font-medium">
                      {CATEGORY_LABELS[item.category]}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {item.count} {item.count === 1 ? "Eintrag" : "Eintraege"}
                    </span>
                  </div>
                  <span className="text-sm font-semibold">
                    {formatCurrency(item.total_gross)}
                  </span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {/* Monatliche Aufschluesselung */}
      {sortedMonths.length > 0 && (
        <Card>
          <CardHeader>
            <CardTitle>Monatliche Aufschluesselung</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {sortedMonths.map((item) => (
                <div
                  key={`${item.year}-${item.month}`}
                  className="flex items-center justify-between gap-4 rounded-md border border-border px-3 py-2"
                >
                  <span className="text-sm font-medium">
                    {MONTH_NAMES[item.month - 1]} {item.year}
                  </span>
                  <div className="flex items-center gap-4">
                    <span className="text-xs text-muted-foreground">
                      {item.count} {item.count === 1 ? "Eintrag" : "Eintraege"}
                    </span>
                    <span className="text-sm font-semibold">
                      {formatCurrency(item.total_gross)}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function CostSummarySkeleton() {
  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-32" />
        </CardHeader>
        <CardContent className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-24" />
        </CardContent>
      </Card>
      <Card>
        <CardHeader>
          <Skeleton className="h-5 w-44" />
        </CardHeader>
        <CardContent className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center justify-between">
              <Skeleton className="h-4 w-32" />
              <Skeleton className="h-4 w-20" />
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  )
}
