import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"

/**
 * GET /api/vehicles/workshop-search?q=XX
 *
 * Returns vehicles matching the license plate (ILIKE).
 * Only returns fields safe for WORKSHOP_MECHANIC (no financial/contract data).
 * Requires permission: vehicles.list
 */
export async function GET(request: NextRequest) {
  const auth = await requirePermissionGuard("vehicles.list")
  if (auth instanceof NextResponse) return auth

  const url = new URL(request.url)
  const q = url.searchParams.get("q") ?? ""

  if (q.length < 2) {
    return NextResponse.json([])
  }

  const supabase = await createClient()

  const { data, error } = await supabase
    .from("vehicles")
    .select("id, license_plate, make, model, vehicle_type, status, image_url")
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .ilike("license_plate", `%${q}%`)
    .order("license_plate", { ascending: true })
    .limit(10)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data ?? [])
}
