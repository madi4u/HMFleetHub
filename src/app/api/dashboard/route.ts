import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { db } from "@/lib/db"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { hasPermission } from "@/lib/permissions.config"
import type {
  DashboardData,
  FleetStats,
  DashboardRecentActivity,
  DashboardRecentMileage,
  DashboardTopVehicle,
  DashboardExpiringContract,
} from "@/types/database"

// ---------------------------------------------------------------------------
// Helper: date formatting
// ---------------------------------------------------------------------------

function toISODate(date: Date): string {
  return date.toISOString().split("T")[0]
}

// ---------------------------------------------------------------------------
// GET /api/dashboard
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const guard = await requirePermissionGuard("dashboard.view")
    if (guard instanceof NextResponse) return guard

    const { tenantId, role } = guard
    const adminClient = createAdminClient()

    // ------------------------------------------------------------------
    // 1. Fleet stats
    // ------------------------------------------------------------------
    const { data: vehicles, error: vehiclesError } = await adminClient
      .from("vehicles")
      .select("id, status")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)

    if (vehiclesError) {
      console.error("dashboard: vehicles query error:", vehiclesError)
      return NextResponse.json(
        { error: "Fehler beim Laden der Fahrzeugstatistiken." },
        { status: 500 }
      )
    }

    const vehicleList = vehicles ?? []

    const now = new Date()
    const in30Days = new Date(now)
    in30Days.setDate(in30Days.getDate() + 30)

    // Due soon: history entries with next_due_date in the next 30 days
    const { count: dueSoonCount, error: dueSoonError } = await adminClient
      .from("vehicle_history_entries")
      .select("id", { count: "exact", head: true })
      .eq("tenant_id", tenantId)
      .gte("next_due_date", toISODate(now))
      .lte("next_due_date", toISODate(in30Days))
      .neq("repair_status", "DONE")

    if (dueSoonError) {
      console.error("dashboard: due_soon query error:", dueSoonError)
    }

    const fleetStats: FleetStats = {
      total: vehicleList.length,
      active: vehicleList.filter((v) => v.status === "Aktiv").length,
      in_workshop: vehicleList.filter((v) => v.status === "In Werkstatt")
        .length,
      due_soon: dueSoonCount ?? 0,
    }

    // ------------------------------------------------------------------
    // 1b. Upcoming TÜV (next 3 months)
    // ------------------------------------------------------------------
    const in90Days = new Date(now)
    in90Days.setDate(in90Days.getDate() + 90)

    const { data: tuevRaw } = await adminClient
      .from("vehicles")
      .select("id, license_plate, make, model, tuev_bis")
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .not("tuev_bis", "is", null)
      .lte("tuev_bis", toISODate(in90Days))
      .order("tuev_bis", { ascending: true })
      .limit(20)

    const upcomingTuev = (tuevRaw ?? []).map((v: Record<string, unknown>) => ({
      vehicle_id: v.id as string,
      license_plate: v.license_plate as string,
      make: v.make as string,
      model: v.model as string,
      tuev_bis: v.tuev_bis as string,
    }))

    // ------------------------------------------------------------------
    // 2. Upcoming maintenance (next 30 days)
    // ------------------------------------------------------------------
    let upcomingRaw: Record<string, unknown>[] | null = null
    let upcomingError: unknown = null
    try {
      const r = await db.query(
        `SELECT e.id, e.vehicle_id, e.entry_type, e.title, e.next_due_date, e.repair_status,
                v.license_plate, v.make, v.model
         FROM fleethub.vehicle_history_entries e
         JOIN fleethub.vehicles v ON v.id = e.vehicle_id
         WHERE e.tenant_id = $1
           AND e.next_due_date IS NOT NULL
           AND e.next_due_date >= $2
           AND e.next_due_date <= $3
           AND e.repair_status != 'DONE'
         ORDER BY e.next_due_date ASC
         LIMIT 10`,
        [tenantId, toISODate(now), toISODate(in30Days)]
      )
      upcomingRaw = r.rows.map((row) => ({
        ...row,
        vehicles: { license_plate: row.license_plate, make: row.make, model: row.model },
      }))
    } catch (err) {
      upcomingError = err
      console.error("dashboard: upcoming maintenance error:", err)
    }

    const upcomingMaintenance = (upcomingRaw ?? []).map((entry: Record<string, unknown>) => {
      const v = entry.vehicles as Record<string, unknown> | null
      return {
        id: entry.id as string,
        vehicle_id: entry.vehicle_id as string,
        vehicle_license_plate: (v?.license_plate as string) ?? "",
        vehicle_make: (v?.make as string) ?? "",
        vehicle_model: (v?.model as string) ?? "",
        entry_type: entry.entry_type as DashboardRecentActivity["entry_type"],
        title: entry.title as string | null,
        next_due_date: entry.next_due_date as string,
        repair_status: entry.repair_status as DashboardData["operative"]["upcoming_maintenance"][number]["repair_status"],
      }
    })

    // ------------------------------------------------------------------
    // 3. Recent activities (last 10 history entries)
    // ------------------------------------------------------------------
    let activitiesRaw: Record<string, unknown>[] | null = null
    let activitiesError: unknown = null
    try {
      const r = await db.query(
        `SELECT e.id, e.vehicle_id, e.entry_type, e.title, e.message, e.author_user_id, e.event_date, e.created_at,
                v.license_plate, v.make, v.model
         FROM fleethub.vehicle_history_entries e
         JOIN fleethub.vehicles v ON v.id = e.vehicle_id
         WHERE e.tenant_id = $1
         ORDER BY e.created_at DESC
         LIMIT 10`,
        [tenantId]
      )
      activitiesRaw = r.rows.map((row) => ({
        ...row,
        vehicles: { license_plate: row.license_plate, make: row.make, model: row.model },
      }))
    } catch (err) {
      activitiesError = err
      console.error("dashboard: recent activities error:", err)
    }

    // Collect unique author IDs for name resolution
    const authorIds = new Set<string>()
    for (const entry of activitiesRaw ?? []) {
      if (entry.author_user_id) authorIds.add(entry.author_user_id as string)
    }

    // Fetch author names from profiles
    let authorMap = new Map<string, string>()
    if (authorIds.size > 0) {
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .in("id", Array.from(authorIds))

      if (profiles) {
        authorMap = new Map(
          profiles.map((p: { id: string; full_name: string | null }) => [
            p.id,
            p.full_name ?? "Unbekannt",
          ])
        )
      }
    }

    const recentActivities: DashboardRecentActivity[] = (
      activitiesRaw ?? []
    ).map((entry: Record<string, unknown>) => {
      const v = entry.vehicles as Record<string, unknown> | null
      return {
        id: entry.id as string,
        vehicle_id: entry.vehicle_id as string,
        vehicle_license_plate: (v?.license_plate as string) ?? "",
        vehicle_make: (v?.make as string) ?? "",
        vehicle_model: (v?.model as string) ?? "",
        entry_type: entry.entry_type as DashboardRecentActivity["entry_type"],
        title: entry.title as string | null,
        message: entry.message as string | null,
        author_name:
          authorMap.get(entry.author_user_id as string) ?? null,
        event_date: entry.event_date as string,
        created_at: entry.created_at as string,
      }
    })

    // ------------------------------------------------------------------
    // 4. Recent mileage (last 5)
    // ------------------------------------------------------------------
    let mileageRaw: Record<string, unknown>[] | null = null
    let mileageError: unknown = null
    try {
      const r = await db.query(
        `SELECT e.id, e.vehicle_id, e.user_id, e.mileage, e.recorded_at,
                v.license_plate, v.make, v.model
         FROM fleethub.mileage_entries e
         JOIN fleethub.vehicles v ON v.id = e.vehicle_id
         WHERE e.tenant_id = $1
         ORDER BY e.recorded_at DESC
         LIMIT 5`,
        [tenantId]
      )
      mileageRaw = r.rows.map((row) => ({
        ...row,
        vehicles: { license_plate: row.license_plate, make: row.make, model: row.model },
      }))
    } catch (err) {
      mileageError = err
      console.error("dashboard: recent mileage error:", err)
    }

    // Collect mileage author IDs
    const mileageAuthorIds = new Set<string>()
    for (const entry of mileageRaw ?? []) {
      if (entry.user_id) mileageAuthorIds.add(entry.user_id as string)
    }

    // Only fetch profiles we do not already have
    const missingAuthorIds = Array.from(mileageAuthorIds).filter(
      (id) => !authorMap.has(id)
    )
    if (missingAuthorIds.length > 0) {
      const { data: extraProfiles } = await adminClient
        .from("profiles")
        .select("id, full_name")
        .in("id", missingAuthorIds)

      if (extraProfiles) {
        for (const p of extraProfiles as {
          id: string
          full_name: string | null
        }[]) {
          authorMap.set(p.id, p.full_name ?? "Unbekannt")
        }
      }
    }

    const recentMileage: DashboardRecentMileage[] = (mileageRaw ?? []).map(
      (entry: Record<string, unknown>) => {
        const v = entry.vehicles as Record<string, unknown> | null
        return {
          id: entry.id as string,
          vehicle_id: entry.vehicle_id as string,
          vehicle_license_plate: (v?.license_plate as string) ?? "",
          vehicle_make: (v?.make as string) ?? "",
          vehicle_model: (v?.model as string) ?? "",
          mileage: entry.mileage as number,
          recorded_at: entry.recorded_at as string,
          author_name: authorMap.get(entry.user_id as string) ?? null,
        }
      }
    )

    // ------------------------------------------------------------------
    // 5. Build operative response
    // ------------------------------------------------------------------
    const operative: DashboardData["operative"] = {
      fleet_stats: fleetStats,
      upcoming_maintenance: upcomingMaintenance,
      recent_activities: recentActivities,
      recent_mileage: recentMileage,
      upcoming_tuev: upcomingTuev,
    }

    // ------------------------------------------------------------------
    // 6. Financial data (only if permission granted)
    // ------------------------------------------------------------------
    let financial: DashboardData["financial"] | undefined

    if (hasPermission(role, "dashboard.financials.view")) {
      // Fetch all cost entries for the tenant (rows with cost_gross != null)
      const { data: costEntries, error: costError } = await adminClient
        .from("vehicle_history_entries")
        .select("cost_gross, cost_category, event_date, vehicle_id")
        .eq("tenant_id", tenantId)
        .not("cost_gross", "is", null)

      if (costError) {
        console.error("dashboard: cost entries error:", costError)
      }

      const entries = (costEntries ?? []) as {
        cost_gross: number
        cost_category: string | null
        event_date: string
        vehicle_id: string
      }[]

      const currentYear = now.getFullYear()
      const currentMonth = now.getMonth() // 0-based

      let costThisMonth = 0
      let costThisYear = 0
      let costTotal = 0

      // Monthly trend map: "YYYY-MM" -> total
      const monthlyMap = new Map<string, number>()
      // Category map
      const categoryMap = new Map<string, number>()
      // Vehicle cost map
      const vehicleCostMap = new Map<string, number>()

      // Calculate 12-month window
      const twelveMonthsAgo = new Date(currentYear, currentMonth - 11, 1)

      for (const e of entries) {
        const gross = e.cost_gross
        costTotal += gross

        const eventDate = new Date(e.event_date)
        const eYear = eventDate.getFullYear()
        const eMonth = eventDate.getMonth()

        if (eYear === currentYear) {
          costThisYear += gross
          if (eMonth === currentMonth) {
            costThisMonth += gross
          }
        }

        // Monthly trend (last 12 months)
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

      // Build monthly trend sorted by date
      const monthlyTrend = Array.from(monthlyMap.entries())
        .map(([key, total]) => {
          const [y, m] = key.split("-")
          return { year: parseInt(y, 10), month: parseInt(m, 10), total_gross: total }
        })
        .sort((a, b) => a.year - b.year || a.month - b.month)

      // By category
      const byCategory = Array.from(categoryMap.entries())
        .map(([category, total_gross]) => ({ category, total_gross }))
        .sort((a, b) => b.total_gross - a.total_gross)

      // Top 5 vehicles by cost
      const sortedVehicles = Array.from(vehicleCostMap.entries())
        .sort(([, a], [, b]) => b - a)
        .slice(0, 5)

      const topVehicleIds = sortedVehicles.map(([id]) => id)

      let topVehicles: DashboardTopVehicle[] = []
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
            total_gross: totalGross,
          }
        })
      }

      // Expiring contracts (next 60 days)
      const in60Days = new Date(now)
      in60Days.setDate(in60Days.getDate() + 60)

      // contracts table not yet migrated — skip query
      const contractsRaw: Record<string, unknown>[] = []

      const expiringContracts: DashboardExpiringContract[] = (
        contractsRaw
      ).map((c: Record<string, unknown>) => {
        const v = c.vehicles as Record<string, unknown> | null
        return {
          id: c.id as string,
          vehicle_id: c.vehicle_id as string,
          vehicle_license_plate: (v?.license_plate as string) ?? "",
          vehicle_make: (v?.make as string) ?? "",
          vehicle_model: (v?.model as string) ?? "",
          contract_type: c.contract_type as DashboardExpiringContract["contract_type"],
          contract_status: c.contract_status as DashboardExpiringContract["contract_status"],
          provider: c.provider as string,
          contract_end: c.contract_end as string,
          monthly_cost: c.monthly_cost as number | null,
          currency: c.currency as string,
        }
      })

      financial = {
        cost_this_month: Math.round(costThisMonth * 100) / 100,
        cost_this_year: Math.round(costThisYear * 100) / 100,
        cost_total: Math.round(costTotal * 100) / 100,
        monthly_trend: monthlyTrend.map((m) => ({
          ...m,
          total_gross: Math.round(m.total_gross * 100) / 100,
        })),
        by_category: byCategory.map((c) => ({
          ...c,
          total_gross: Math.round(c.total_gross * 100) / 100,
        })),
        top_vehicles: topVehicles.map((v) => ({
          ...v,
          total_gross: Math.round(v.total_gross * 100) / 100,
        })),
        expiring_contracts: expiringContracts,
      }
    }

    // ------------------------------------------------------------------
    // 7. Return full response
    // ------------------------------------------------------------------
    const response: DashboardData = {
      operative,
      ...(financial ? { financial } : {}),
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("dashboard GET unexpected error:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
