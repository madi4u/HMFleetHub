import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  const auth = await requirePermissionGuard("vehicles.list")
  if (auth instanceof NextResponse) return auth

  const { searchParams } = request.nextUrl
  const statusFilter = searchParams.get("status")
  const search = searchParams.get("search")

  const adminClient = createAdminClient()

  let query = adminClient
    .from("contracts")
    .select(
      "id, vehicle_id, contract_type, contract_status, provider, contract_number, contract_start, contract_end, monthly_cost, currency, notice_period_days, created_at, updated_at, vehicles!inner(id, license_plate, make, model, tenant_id)"
    )
    .eq("vehicles.tenant_id", auth.tenantId)
    .order("contract_start", { ascending: false })
    .limit(500)

  if (statusFilter && statusFilter !== "all") {
    query = query.eq("contract_status", statusFilter)
  }

  if (search) {
    query = query.or(
      `provider.ilike.%${search}%,contract_number.ilike.%${search}%,vehicles.license_plate.ilike.%${search}%,vehicles.make.ilike.%${search}%,vehicles.model.ilike.%${search}%`
    )
  }

  const { data: contracts, error, count } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({
    contracts: contracts ?? [],
    total: contracts?.length ?? 0,
  })
}
