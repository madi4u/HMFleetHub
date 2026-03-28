import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionGuard } from "@/lib/auth-guard"
import type {
  Vehicle,
  VehicleType,
  VehicleStatus,
  FuelType,
  PaginatedVehicles,
} from "@/types/database"

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const VEHICLE_TYPES: [string, ...string[]] = [
  "PKW",
  "LKW",
  "Transporter",
  "Motorrad",
  "Anh\u00e4nger",
  "Sonstige",
]
const VEHICLE_STATUSES: [string, ...string[]] = [
  "Aktiv",
  "Inaktiv",
  "In Werkstatt",
  "Verkauft",
  "Abgemeldet",
]
const FUEL_TYPES: [string, ...string[]] = [
  "Benzin",
  "Diesel",
  "Elektro",
  "Hybrid",
  "Gas",
  "Sonstige",
]

const createVehicleSchema = z.object({
  license_plate: z.string().min(1, "Kennzeichen ist erforderlich").max(20),
  make: z.string().min(1, "Marke ist erforderlich").max(100),
  model: z.string().min(1, "Modell ist erforderlich").max(100),
  vehicle_type: z.enum(VEHICLE_TYPES) as z.ZodType<VehicleType>,
  status: (z.enum(VEHICLE_STATUSES) as z.ZodType<VehicleStatus>).default(
    "Aktiv"
  ),
  image_url: z.string().nullable().optional(),
  vin: z.string().max(17).nullable().optional(),
  first_registration: z.string().nullable().optional(),
  year: z.number().int().min(1900).max(2100).nullable().optional(),
  color: z.string().max(50).nullable().optional(),
  current_mileage: z.number().int().min(0).nullable().optional(),
  location: z.string().max(200).nullable().optional(),
  assigned_to: z.string().max(200).nullable().optional(),
  notes: z.string().max(5000).nullable().optional(),
  tire_size: z.string().max(50).nullable().optional(),
  engine_oil_spec: z.string().max(100).nullable().optional(),
  transmission_oil_spec: z.string().max(100).nullable().optional(),
  fuel_type: (z.enum(FUEL_TYPES) as z.ZodType<FuelType>).nullable().optional(),
  engine_code: z.string().max(50).nullable().optional(),
  engine_power: z.number().int().min(0).nullable().optional(),
  hsn: z.string().max(10).nullable().optional(),
  tsn: z.string().max(10).nullable().optional(),
  service_interval_notes: z.string().max(2000).nullable().optional(),
  technical_notes: z.string().max(5000).nullable().optional(),
})

const VALID_PAGE_SIZES = [25, 50, 100] as const

// ---------------------------------------------------------------------------
// GET /api/vehicles — paginated list with search & filters
// ---------------------------------------------------------------------------

export async function GET(request: NextRequest) {
  try {
    const guard = await requirePermissionGuard("vehicles.list")
    if (guard instanceof NextResponse) return guard

    const { tenantId } = guard
    const { searchParams } = new URL(request.url)

    // Parse query params
    const page = Math.max(1, parseInt(searchParams.get("page") ?? "1", 10))
    const rawPageSize = parseInt(searchParams.get("pageSize") ?? "25", 10)
    const pageSize = VALID_PAGE_SIZES.includes(rawPageSize as 25 | 50 | 100)
      ? rawPageSize
      : 25
    const search = searchParams.get("search")?.trim() ?? ""
    // Sanitize: keep only alphanumeric, space, hyphen, dot for license plate format
    const sanitizedSearch = search.replace(/[^\w\s.\-]/g, "").slice(0, 100)
    const statusFilter = searchParams.get("status") ?? ""
    const vehicleTypeFilter = searchParams.get("vehicle_type") ?? ""

    const adminClient = createAdminClient()

    // Build query — admin client bypasses RLS, so we filter by tenant_id manually
    let query = adminClient
      .from("vehicles")
      .select("*", { count: "exact" })
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)

    // Search across license_plate, make, model
    if (sanitizedSearch) {
      query = query.or(
        `license_plate.ilike.%${sanitizedSearch}%,make.ilike.%${sanitizedSearch}%,model.ilike.%${sanitizedSearch}%`
      )
    }

    // Status filter
    if (statusFilter && VEHICLE_STATUSES.includes(statusFilter)) {
      query = query.eq("status", statusFilter)
    }

    // Vehicle type filter
    if (vehicleTypeFilter && VEHICLE_TYPES.includes(vehicleTypeFilter)) {
      query = query.eq("vehicle_type", vehicleTypeFilter)
    }

    // Pagination
    const from = (page - 1) * pageSize
    const to = from + pageSize - 1

    query = query
      .order("created_at", { ascending: false })
      .range(from, to)

    const { data, count, error } = await query

    if (error) {
      console.error("vehicles GET error:", error)
      return NextResponse.json(
        { error: "Fehler beim Laden der Fahrzeuge." },
        { status: 500 }
      )
    }

    const response: PaginatedVehicles = {
      data: (data ?? []) as Vehicle[],
      total: count ?? 0,
      page,
      pageSize,
    }

    return NextResponse.json(response)
  } catch (err) {
    console.error("vehicles GET unexpected error:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/vehicles — create a new vehicle
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermissionGuard("vehicles.create")
    if (guard instanceof NextResponse) return guard

    const { tenantId } = guard

    // Parse & validate body
    const body = await request.json()
    const parsed = createVehicleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validierungsfehler", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Check license_plate uniqueness within tenant
    const { data: existing } = await adminClient
      .from("vehicles")
      .select("id")
      .eq("tenant_id", tenantId)
      .eq("license_plate", parsed.data.license_plate)
      .is("deleted_at", null)
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json(
        {
          error: `Kennzeichen "${parsed.data.license_plate}" existiert bereits in diesem Mandanten.`,
        },
        { status: 409 }
      )
    }

    // Insert vehicle
    const { data: vehicle, error: insertError } = await adminClient
      .from("vehicles")
      .insert({
        tenant_id: tenantId,
        ...parsed.data,
      })
      .select()
      .single()

    if (insertError) {
      console.error("vehicles POST insert error:", insertError)
      // Handle unique constraint violation at DB level as well
      if (insertError.code === "23505") {
        return NextResponse.json(
          {
            error: `Kennzeichen "${parsed.data.license_plate}" existiert bereits in diesem Mandanten.`,
          },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: "Fehler beim Anlegen des Fahrzeugs." },
        { status: 500 }
      )
    }

    return NextResponse.json(vehicle as Vehicle, { status: 201 })
  } catch (err) {
    console.error("vehicles POST unexpected error:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
