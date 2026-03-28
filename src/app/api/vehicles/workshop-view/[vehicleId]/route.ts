import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"

/**
 * Only these fields are safe for WORKSHOP_MECHANIC.
 * Excludes: color, location, assigned_to, notes, deleted_at
 * and any future financial/contract columns.
 */
const WORKSHOP_FIELDS = [
  "id",
  "tenant_id",
  "license_plate",
  "make",
  "model",
  "vehicle_type",
  "status",
  "image_url",
  "vin",
  "current_mileage",
  "year",
  "first_registration",
  "tire_size",
  "engine_oil_spec",
  "transmission_oil_spec",
  "fuel_type",
  "engine_code",
  "engine_power",
  "hsn",
  "tsn",
  "service_interval_notes",
  "technical_notes",
  "created_at",
  "updated_at",
].join(", ")

/**
 * GET /api/vehicles/workshop-view/[vehicleId]
 *
 * Returns a single vehicle with only technical fields (no financial/contract data).
 * Requires permission: vehicles.list
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ vehicleId: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.list")
  if (auth instanceof NextResponse) return auth

  const { vehicleId } = await params
  const supabase = await createClient()

  const { data, error } = await supabase
    .from("vehicles")
    .select(WORKSHOP_FIELDS)
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (error || !data) {
    return NextResponse.json(
      { error: "Fahrzeug nicht gefunden" },
      { status: 404 }
    )
  }

  return NextResponse.json(data)
}
