import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { hasPermission } from "@/lib/permissions.config"

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
// GET /api/reports
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const guard = await requirePermissionGuard("dashboard.view")
    if (guard instanceof NextResponse) return guard

    const { tenantId, role } = guard
    const adminClient = createAdminClient()

    // ----------------------------------------------------------------
    // 1. Fleet composition
    // ----------------------------------------------------------------
    const { data: vehicles, error: vehiclesError } = await adminClient
      .from("vehicles")
      .select("id, status, vehicle_type, fuel_type")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)

    if (vehiclesError) {
      console.error("reports: vehicles query error:", vehiclesError)
      return NextResponse.json(
        { error: "Fehler beim Laden der Fahrzeugdaten." },
        { status: 500 }
      )
    }

    const vehicleList = vehicles ?? []

    const byStatus: Record<string, number> = {}
    const byType: Record<string, number> = {}
    const byFuel: Record<string, number> = {}

    for (const v of vehicleList) {
      const status = (v.status as string) ?? "Unbekannt"
      byStatus[status] = (byStatus[status] ?? 0) + 1

      const type = (v.vehicle_type as string) ?? "Sonstige"
      byType[type] = (byType[type] ?? 0) + 1

      const fuel = (v.fuel_type as string) ?? "Unbekannt"
      byFuel[fuel] = (byFuel[fuel] ?? 0) + 1
    }

    const fleet: ReportsData["fleet"] = {
      total: vehicleList.length,
      by_status: byStatus,
      by_type: byType,
      by_fuel: byFuel,
    }

    // ----------------------------------------------------------------
    // 2. Cost analytics (permission gated)
    // ----------------------------------------------------------------
    let costs: ReportsData["costs"] | undefined

    if (hasPermission(role, "dashboard.financials.view")) {
      const { data: costEntries, error: costError } = await adminClient
        .from("vehicle_history_entries")
        .select("cost_gross, cost_category, event_date, vehicle_id")
        .eq("tenant_id", tenantId)
        .not("cost_gross", "is", null)

      if (costError) {
        console.error("reports: cost entries error:", costError)
      }

      const entries = (costEntries ?? []) as {
        cost_gross: number
        cost_category: string | null
        event_date: string
        vehicle_id: string
      }[]

      const now = new Date()
      const currentYear = now.getFullYear()
      const lastYear = currentYear - 1

      let totalAllTime = 0
      let totalThisYear = 0
      let totalLastYear = 0

      const monthlyMap = new Map<string, number>()
      const categoryMap = new Map<string, number>()
      const vehicleCostMap = new Map<string, number>()

      for (const e of entries) {
        const gross = e.cost_gross
        totalAllTime += gross

        const eventDate = new Date(e.event_date)
        const eYear = eventDate.getFullYear()
        const eMonth = eventDate.getMonth()

        if (eYear === currentYear) {
          totalThisYear += gross
        }
        if (eYear === lastYear) {
          totalLastYear += gross
        }

        // Monthly trend (last 12 months)
        const twelveMonthsAgo = new Date(currentYear, now.getMonth() - 11, 1)
        if (eventDate >= twelveMonthsAgo) {
          const key = `${eYear}-${String(eMonth + 1).padStart(2, "0")}`
          monthlyMap.set(key, (monthlyMap.get(key) ?? 0) + gross)
        }

        // By category
        const cat = e.cost_category ?? "OTHER"
        categoryMap.set(cat, (categoryMap.get(cat) ?? 0) + gross)

        // By vehicle
        vehicleCostMap.set(
          e.vehicle_id,
          (vehicleCostMap.get(e.vehicle_id) ?? 0) + gross
        )
      }

      // Monthly trend sorted
      const byMonth = Array.from(monthlyMap.entries())
        .map(([key, total]) => ({ month: key, total: Math.round(total * 100) / 100 }))
        .sort((a, b) => a.month.localeCompare(b.month))

      // By category sorted
      const byCategory = Array.from(categoryMap.entries())
        .map(([category, total]) => ({
          category,
          total: Math.round(total * 100) / 100,
        }))
        .sort((a, b) => b.total - a.total)

      // Top 5 vehicles by cost
      const sortedVehicles = Array.from(vehicleCostMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)

      const topVehicleIds = sortedVehicles.map(([id]) => id)

      let topVehicles: ReportsData["costs"] extends undefined
        ? never
        : NonNullable<ReportsData["costs"]>["top_vehicles"] = []

      if (topVehicleIds.length > 0) {
        const { data: topVehicleData } = await adminClient
          .from("vehicles")
          .select("id, license_plate, make, model")
          .in("id", topVehicleIds)

        const vehicleInfoMap = new Map(
          (topVehicleData ?? []).map(
            (v: {
              id: string
              license_plate: string
              make: string
              model: string
            }) => [v.id, v]
          )
        )

        topVehicles = sortedVehicles.map(([vehicleId, totalGross]) => {
          const info = vehicleInfoMap.get(vehicleId)
          return {
            vehicle_id: vehicleId,
            license_plate: info?.license_plate ?? "",
            make: info?.make ?? "",
            model: info?.model ?? "",
            total: Math.round(totalGross * 100) / 100,
          }
        })
      }

      costs = {
        total_all_time: Math.round(totalAllTime * 100) / 100,
        total_this_year: Math.round(totalThisYear * 100) / 100,
        total_last_year: Math.round(totalLastYear * 100) / 100,
        by_month: byMonth,
        by_category: byCategory,
        top_vehicles: topVehicles,
      }
    }

    // ----------------------------------------------------------------
    // 3. History activity
    // ----------------------------------------------------------------
    const { count: totalEntries, error: histCountError } = await adminClient
      .from("vehicle_history_entries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)

    if (histCountError) {
      console.error("reports: history count error:", histCountError)
    }

    const { data: histByType, error: histTypeError } = await adminClient
      .from("vehicle_history_entries")
      .select("entry_type")
      .eq("tenant_id", tenantId)

    if (histTypeError) {
      console.error("reports: history by type error:", histTypeError)
    }

    const entryTypeMap: Record<string, number> = {}
    for (const e of histByType ?? []) {
      const t = (e.entry_type as string) ?? "UNKNOWN"
      entryTypeMap[t] = (entryTypeMap[t] ?? 0) + 1
    }

    // Recent repairs (last 30 days)
    const thirtyDaysAgo = new Date()
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30)
    const thirtyDaysAgoStr = thirtyDaysAgo.toISOString().split("T")[0]

    const { count: recentRepairsCount, error: recentRepairsError } =
      await adminClient
        .from("vehicle_history_entries")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("entry_type", "REPAIR")
        .gte("event_date", thirtyDaysAgoStr)

    if (recentRepairsError) {
      console.error("reports: recent repairs error:", recentRepairsError)
    }

    const history: ReportsData["history"] = {
      total_entries: totalEntries ?? 0,
      by_type: entryTypeMap,
      recent_repairs_count: recentRepairsCount ?? 0,
    }

    // ----------------------------------------------------------------
    // 4. Contracts overview
    // ----------------------------------------------------------------
    const { data: allContracts, error: contractsError } = await adminClient
      .from("contracts")
      .select("id, contract_status, contract_end")
      .eq("tenant_id", tenantId)

    if (contractsError) {
      console.error("reports: contracts error:", contractsError)
    }

    const contractList = allContracts ?? []
    const now = new Date()
    const in60Days = new Date(now)
    in60Days.setDate(in60Days.getDate() + 60)
    const nowStr = now.toISOString().split("T")[0]
    const in60Str = in60Days.toISOString().split("T")[0]

    let activeCount = 0
    let expiringSoonCount = 0
    let expiredCount = 0

    for (const c of contractList) {
      const status = c.contract_status as string
      if (status === "ACTIVE") {
        activeCount++
        // Check expiring soon
        if (c.contract_end && c.contract_end >= nowStr && c.contract_end <= in60Str) {
          expiringSoonCount++
        }
      }
      if (status === "EXPIRED") {
        expiredCount++
      }
    }

    const contracts: ReportsData["contracts"] = {
      total: contractList.length,
      active: activeCount,
      expiring_soon: expiringSoonCount,
      expired: expiredCount,
    }

    // ----------------------------------------------------------------
    // 5. Return response
    // ----------------------------------------------------------------
    const response: ReportsData = {
      fleet,
      ...(costs ? { costs } : {}),
      history,
      contracts,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("reports GET unexpected error:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
