"use client"

import { useState, useEffect } from "react"
import { Car, CheckCircle, Wrench, Calendar, Euro } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { hasPermission } from "@/lib/permissions.config"
import type { DashboardData } from "@/types/database"
import { StatCard } from "@/components/dashboard/stat-card"
import { MonthlyCostChart } from "@/components/dashboard/monthly-cost-chart"
import { CostByCategoryChart } from "@/components/dashboard/cost-by-category-chart"
import { UpcomingMaintenanceList } from "@/components/dashboard/upcoming-maintenance-list"
import { RecentActivityList } from "@/components/dashboard/recent-activity-list"
import { ExpiringContractsList } from "@/components/dashboard/expiring-contracts-list"
import { DashboardSkeleton } from "@/components/dashboard/dashboard-skeleton"

export default function DashboardPage() {
  const { user, isLoading: userLoading } = useUser()
  const [data, setData] = useState<DashboardData | null>(null)
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

    fetch("/api/dashboard")
      .then((r) => {
        if (!r.ok) throw new Error(`Fehler beim Laden (${r.status})`)
        return r.json()
      })
      .then((json: DashboardData) => setData(json))
      .catch((err: Error) => setError(err.message))
      .finally(() => setIsLoading(false))
  }, [userLoading, user])

  const canViewFinancials = user
    ? hasPermission(user.role, "dashboard.financials.view")
    : false

  if (userLoading || isLoading) return <DashboardSkeleton />

  if (error) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      </div>
    )
  }

  if (!data) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">Keine Daten verfuegbar.</p>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dashboard</h1>
        <p className="text-muted-foreground">
          Uebersicht ueber Ihren Fuhrpark.
        </p>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard
          title="Fahrzeuge gesamt"
          value={data.operative.fleet_stats.total}
          icon={Car}
        />
        <StatCard
          title="Aktive Fahrzeuge"
          value={data.operative.fleet_stats.active}
          icon={CheckCircle}
        />
        <StatCard
          title="In Werkstatt"
          value={data.operative.fleet_stats.in_workshop}
          icon={Wrench}
          variant="warning"
        />
        <StatCard
          title="Termine (30 Tage)"
          value={data.operative.fleet_stats.due_soon}
          icon={Calendar}
          variant={data.operative.fleet_stats.due_soon > 0 ? "warning" : "default"}
        />
      </div>

      {/* Operative section: 2 columns on desktop */}
      <div className="grid gap-6 lg:grid-cols-2">
        <UpcomingMaintenanceList
          items={data.operative.upcoming_maintenance}
        />
        <RecentActivityList items={data.operative.recent_activities} />
      </div>

      {/* Financial section - permission gated */}
      {canViewFinancials && data.financial && (
        <>
          {/* Cost summary cards */}
          <div className="grid gap-4 sm:grid-cols-3">
            <StatCard
              title="Kosten (Monat)"
              value={formatEuroCurrency(data.financial.cost_this_month)}
              icon={Euro}
            />
            <StatCard
              title="Kosten (Jahr)"
              value={formatEuroCurrency(data.financial.cost_this_year)}
              icon={Euro}
            />
            <StatCard
              title="Kosten (gesamt)"
              value={formatEuroCurrency(data.financial.cost_total)}
              icon={Euro}
            />
          </div>

          {/* Charts */}
          <div className="grid gap-6 lg:grid-cols-2">
            <MonthlyCostChart data={data.financial.monthly_trend} />
            <CostByCategoryChart data={data.financial.by_category} />
          </div>

          {/* Expiring contracts */}
          <ExpiringContractsList items={data.financial.expiring_contracts} />
        </>
      )}
    </div>
  )
}

function formatEuroCurrency(value: number): string {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 2,
  })
}
