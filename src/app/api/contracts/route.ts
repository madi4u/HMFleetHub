import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { db } from "@/lib/db"

export async function GET(request: NextRequest) {
  const auth = await requirePermissionGuard("vehicles.list")
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const statusFilter = searchParams.get("status")
  const search = searchParams.get("search")?.trim() ?? ""

  const values: unknown[] = [auth.tenantId]
  const conditions: string[] = ["c.tenant_id = $1"]

  if (statusFilter && statusFilter !== "all") {
    values.push(statusFilter)
    conditions.push(`c.contract_status = $${values.length}`)
  }

  if (search) {
    values.push(`%${search}%`)
    const ph = `$${values.length}`
    conditions.push(
      `(c.provider ILIKE ${ph} OR c.contract_number ILIKE ${ph} OR v.license_plate ILIKE ${ph} OR v.make ILIKE ${ph} OR v.model ILIKE ${ph})`
    )
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const sql = `
    SELECT
      c.id, c.vehicle_id, c.contract_type, c.contract_status,
      c.provider, c.contract_number, c.contract_start, c.contract_end,
      c.monthly_cost, c.currency, c.notice_period_days,
      c.created_at, c.updated_at,
      json_build_object(
        'id', v.id,
        'license_plate', v.license_plate,
        'make', v.make,
        'model', v.model
      ) AS vehicle
    FROM fleethub.contracts c
    JOIN fleethub.vehicles v ON v.id = c.vehicle_id
    ${where}
    ORDER BY c.contract_start DESC
    LIMIT 500
  `

  try {
    const result = await db.query(sql, values)
    const contracts = result.rows

    return NextResponse.json({ contracts, total: contracts.length })
  } catch (err) {
    console.error("contracts GET error:", err)
    return NextResponse.json({ error: "Fehler beim Laden der Verträge." }, { status: 500 })
  }
}
