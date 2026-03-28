"use client"

import { useState, useEffect } from "react"
import {
  Car,
  CheckCircle,
  Wrench,
  XCircle,
  Euro,
  FileText,
  History,
  BarChart3,
  Fuel,
} from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { hasPermission } from "@/lib/permissions.config"
import { StatCard } from "@/components/dashboard/stat-card"
import { MonthlyCostChart } from "@/components/dashboard/monthly-cost-chart"
import { CostByCategoryChart } from "@/components/dashboard/cost-by-category-chart"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReportsData {
  fleet: {
    total: number
    by_status: Record<string, number>
    by_type: Record<string, number>
    by_fuel: Record<string, number>
  }
  costs?: {
    total_all_time: number
    total_this_year: number
    total_last_year: number
    by_month: { month: string; total: number }[]
    by_category: { category: string; total: number }[]
    top_vehicles: {
      vehicle_id: string
      license_plate: string
      make: string
      model: string
      total: number
    }[]
  }
  history: {
    total_entries: number
    by_type: Record<string, number>
    recent_repairs_count: number
  }
  contracts: {
    total: number
    active: number
    expiring_soon: number
    expired: number
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatEur(value: number): string {
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  }).format(value)
}

const STATUS_COLORS: Record<string, string> = {
  Aktiv: "bg-green-500/20 text-green-400",
  "In Werkstatt": "bg-yellow-500/20 text-yellow-400",
  Inaktiv: "bg-gray-500/20 text-gray-400",
  Abgemeldet: "bg-red-500/20 text-red-400",
}

const ENTRY_TYPE_LABELS: Record<string, string> = {
  NOTE: "Notiz",
  REPAIR: "Reparatur",
  MAINTENANCE: "Wartung",
  OIL_CHANGE: "Oelwechsel",
  TIRE_CHANGE: "Reifenwechsel",
  INSPECTION: "Inspektion",
  ACCIDENT: "Unfall",
  DAMAGE: "Schaden",
  TUV: "TUeV / HU/AU",
  OTHER: "Sonstiges",
}

const CATEGORY_LABELS: Record<string, string> = {
  REPAIR: "Reparatur",
  MAINTENANCE: "Wartung",
  OIL: "Oelwechsel",
  TIRES: "Reifen",
  INSPECTION: "Inspektion",
  BODYWORK: "Karosserie",
  ELECTRICAL: "Elektrik",
  OTHER: "Sonstiges",
}

// ---------------------------------------------------------------------------
// Loading skeleton
// ---------------------------------------------------------------------------

function ReportsSkeleton() {
  return (
    <div className="space-y-6">
      <div>
        <Skeleton className="h-8 w-64 mb-2" />
        <Skeleton className="h-4 w-48" />
      </div>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
      <Skeleton className="h-8 w-48" />
      <div className="grid gap-4 sm:grid-cols-3">
        {Array.from({ length: 3 }).map((_, i) => (
          <Skeleton key={i} className="h-24" />
        ))}
      </div>
      <div className="grid gap-6 lg:grid-cols-2">
        <Skeleton className="h-64" />
        <Skeleton className="h-64" />
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Page
// ---------------------------------------------------------------------------

export default function ReportsPage() {
  const { user, isLoading: userLoading } = useUser()
  const [data, setData] = useState<ReportsData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (userLoading) return
    if (!user) {
      setIsLoading(false)
      return
    }

    setIsLoading(true)
    setError(null)

    fetch("/api/reports")
      .then((r) => {
        if (!r.ok) throw new Error(`Fehler beim Laden (${r.status})`)
        return r.json()
      })
      .then((json: ReportsData) => setData(json))
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [userLoading, user])

  const canViewFinancials = user
    ? hasPermission(user.role, "dashboard.financials.view")
    : false

  if (userLoading || isLoading) return <ReportsSkeleton />

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Berichte & Auswertungen
        </h1>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">
          Berichte & Auswertungen
        </h1>
        <p className="text-muted-foreground">Keine Daten verfuegbar.</p>
      </div>
    )
  }

  // Prepare fleet stat counts
  const activeCount = data.fleet.by_status["Aktiv"] ?? 0
  const workshopCount = data.fleet.by_status["In Werkstatt"] ?? 0
  const otherCount = data.fleet.total - activeCount - workshopCount

  // Transform cost data for the reused chart components
  const monthlyCostChartData = (data.costs?.by_month ?? []).map((m) => {
    const [y, mo] = m.month.split("-")
    return { year: parseInt(y, 10), month: parseInt(mo, 10), total_gross: m.total }
  })

  const categoryChartData = (data.costs?.by_category ?? []).map((c) => ({
    category: c.category,
    total_gross: c.total,
  }))

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Berichte & Auswertungen
        </h1>
        <p className="text-muted-foreground">
          Auswertung aller Flottendaten
        </p>
      </div>

      {/* ============================================================= */}
      {/* Section 1: Flottenuebersicht                                   */}
      {/* ============================================================= */}
      <section aria-label="Flottenuebersicht">
        <h2 className="text-lg font-semibold mb-4">Flottenuebersicht</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Gesamt"
            value={data.fleet.total}
            icon={Car}
          />
          <StatCard
            title="Aktiv"
            value={activeCount}
            icon={CheckCircle}
          />
          <StatCard
            title="In Werkstatt"
            value={workshopCount}
            icon={Wrench}
            variant={workshopCount > 0 ? "warning" : "default"}
          />
          <StatCard
            title="Inaktiv / Sonstige"
            value={otherCount}
            icon={XCircle}
          />
        </div>

        <div className="grid gap-6 lg:grid-cols-2 mt-6">
          {/* By Status */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nach Status</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.fleet.by_status).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Fahrzeuge vorhanden.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.fleet.by_status)
                    .sort(([, a], [, b]) => b - a)
                    .map(([status, count]) => (
                      <div
                        key={status}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm">{status}</span>
                        <Badge
                          variant="secondary"
                          className={
                            STATUS_COLORS[status] ?? "bg-muted text-muted-foreground"
                          }
                        >
                          {count}
                        </Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* By Vehicle Type */}
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Nach Fahrzeugtyp</CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.fleet.by_type).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Fahrzeuge vorhanden.
                </p>
              ) : (
                <div className="space-y-3">
                  {Object.entries(data.fleet.by_type)
                    .sort(([, a], [, b]) => b - a)
                    .map(([type, count]) => (
                      <div
                        key={type}
                        className="flex items-center justify-between"
                      >
                        <span className="text-sm">{type}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        {/* By Fuel Type */}
        <div className="mt-6">
          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <Fuel className="h-4 w-4" aria-hidden="true" />
                Nach Kraftstoffart
              </CardTitle>
            </CardHeader>
            <CardContent>
              {Object.keys(data.fleet.by_fuel).length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Keine Daten vorhanden.
                </p>
              ) : (
                <div className="flex flex-wrap gap-4">
                  {Object.entries(data.fleet.by_fuel)
                    .sort(([, a], [, b]) => b - a)
                    .map(([fuel, count]) => (
                      <div
                        key={fuel}
                        className="flex items-center gap-2 rounded-md border px-3 py-2"
                      >
                        <span className="text-sm font-medium">{fuel}</span>
                        <Badge variant="secondary">{count}</Badge>
                      </div>
                    ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </section>

      {/* ============================================================= */}
      {/* Section 2: Kostenauswertung (hidden for WORKSHOP_MECHANIC)     */}
      {/* ============================================================= */}
      {canViewFinancials && data.costs && (
        <>
          <Separator />
          <section aria-label="Kostenauswertung">
            <h2 className="text-lg font-semibold mb-4">Kostenauswertung</h2>

            <div className="grid gap-4 sm:grid-cols-3">
              <StatCard
                title="Gesamt (alle Jahre)"
                value={formatEur(data.costs.total_all_time)}
                icon={Euro}
              />
              <StatCard
                title="Dieses Jahr"
                value={formatEur(data.costs.total_this_year)}
                icon={Euro}
              />
              <StatCard
                title="Letztes Jahr"
                value={formatEur(data.costs.total_last_year)}
                icon={Euro}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-2 mt-6">
              <MonthlyCostChart data={monthlyCostChartData} />
              <CostByCategoryChart data={categoryChartData} />
            </div>

            {/* Top 5 cost drivers */}
            <Card className="mt-6">
              <CardHeader>
                <CardTitle className="text-base">
                  Top 5 Kostentreiber
                </CardTitle>
              </CardHeader>
              <CardContent>
                {data.costs.top_vehicles.length === 0 ? (
                  <p className="text-sm text-muted-foreground">
                    Keine Kostendaten vorhanden.
                  </p>
                ) : (
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Fahrzeug</TableHead>
                        <TableHead>Kennzeichen</TableHead>
                        <TableHead className="text-right">
                          Gesamtkosten
                        </TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {data.costs.top_vehicles.map((v) => (
                        <TableRow key={v.vehicle_id}>
                          <TableCell className="font-medium">
                            {v.make} {v.model}
                          </TableCell>
                          <TableCell>
                            <Badge variant="outline">{v.license_plate}</Badge>
                          </TableCell>
                          <TableCell className="text-right">
                            {formatEur(v.total)}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                )}
              </CardContent>
            </Card>
          </section>
        </>
      )}

      {/* ============================================================= */}
      {/* Section 3: Historien-Aktivitaet                                */}
      {/* ============================================================= */}
      <Separator />
      <section aria-label="Historien-Aktivitaet">
        <h2 className="text-lg font-semibold mb-4">Historien-Aktivitaet</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          <StatCard
            title="Eintraege gesamt"
            value={data.history.total_entries}
            icon={History}
          />
          <StatCard
            title="Reparaturen (30 Tage)"
            value={data.history.recent_repairs_count}
            icon={Wrench}
            variant={
              data.history.recent_repairs_count > 0 ? "warning" : "default"
            }
          />
          <StatCard
            title="Eintragstypen"
            value={Object.keys(data.history.by_type).length}
            icon={BarChart3}
          />
        </div>

        <Card className="mt-6">
          <CardHeader>
            <CardTitle className="text-base">Nach Eintragstyp</CardTitle>
          </CardHeader>
          <CardContent>
            {Object.keys(data.history.by_type).length === 0 ? (
              <p className="text-sm text-muted-foreground">
                Keine Historieneintraege vorhanden.
              </p>
            ) : (
              <div className="space-y-3">
                {Object.entries(data.history.by_type)
                  .sort(([, a], [, b]) => b - a)
                  .map(([type, count]) => (
                    <div
                      key={type}
                      className="flex items-center justify-between"
                    >
                      <span className="text-sm">
                        {ENTRY_TYPE_LABELS[type] ?? type}
                      </span>
                      <Badge variant="secondary">{count}</Badge>
                    </div>
                  ))}
              </div>
            )}
          </CardContent>
        </Card>
      </section>

      {/* ============================================================= */}
      {/* Section 4: Vertragsuebersicht                                  */}
      {/* ============================================================= */}
      <Separator />
      <section aria-label="Vertragsuebersicht">
        <h2 className="text-lg font-semibold mb-4">Vertragsuebersicht</h2>

        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            title="Gesamt"
            value={data.contracts.total}
            icon={FileText}
          />
          <StatCard
            title="Aktiv"
            value={data.contracts.active}
            icon={CheckCircle}
          />
          <StatCard
            title="Laeuft bald ab"
            value={data.contracts.expiring_soon}
            icon={XCircle}
            variant={data.contracts.expiring_soon > 0 ? "warning" : "default"}
          />
          <StatCard
            title="Abgelaufen"
            value={data.contracts.expired}
            icon={XCircle}
            variant={data.contracts.expired > 0 ? "danger" : "default"}
          />
        </div>
      </section>
    </div>
  )
}
