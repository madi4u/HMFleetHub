import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionGuard } from "@/lib/auth-guard"
import type { Vehicle, VehicleType, VehicleStatus, FuelType } from "@/types/database"

// ---------------------------------------------------------------------------
// Zod schemas
// ---------------------------------------------------------------------------

const VEHICLE_TYPES: [string, ...string[]] = [
  "PKW",
  "LKW",
  "Transporter",
  "Motorrad",
  "Anhänger",
  "Verkaufsanhänger",
  "Foodtruck",
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
  "LPG",
  "CNG",
  "Sonstige",
]

const updateVehicleSchema = z.object({
  license_plate: z.string().min(1).max(20).optional(),
  make: z.string().min(1).max(100).optional(),
  model: z.string().min(1).max(100).optional(),
  vehicle_type: (z.enum(VEHICLE_TYPES) as z.ZodType<VehicleType>).optional(),
  status: (z.enum(VEHICLE_STATUSES) as z.ZodType<VehicleStatus>).optional(),
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
  tuev_bis: z.string().nullable().optional(),
  service_interval_notes: z.string().max(2000).nullable().optional(),
  technical_notes: z.string().max(5000).nullable().optional(),
})

const uuidSchema = z.string().uuid()

// ---------------------------------------------------------------------------
// GET /api/vehicles/[id] — single vehicle
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermissionGuard("vehicles.list")
    if (guard instanceof NextResponse) return guard

    const { tenantId } = guard
    const { id } = await params

    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json(
        { error: "Ungültige Fahrzeug-ID." },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    const { data: vehicle, error } = await adminClient
      .from("vehicles")
      .select("*")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single()

    if (error || !vehicle) {
      return NextResponse.json(
        { error: "Fahrzeug nicht gefunden." },
        { status: 404 }
      )
    }

    // Generate signed URL for vehicle photo if stored as a storage path
    let signedImageUrl: string | null = vehicle.image_url ?? null
    if (signedImageUrl && !signedImageUrl.startsWith("http")) {
      const { data: signed } = await adminClient.storage
        .from("vehicle-media")
        .createSignedUrl(signedImageUrl, 3600)
      signedImageUrl = signed?.signedUrl ?? null
    }
    const vehicleWithImage = { ...vehicle, image_url: signedImageUrl }

    // WORKSHOP_MECHANIC: strip management-only fields
    if (guard.role === "WORKSHOP_MECHANIC") {
      // eslint-disable-next-line @typescript-eslint/no-unused-vars
      const { notes, deleted_at, ...workshopFields } = vehicleWithImage
      return NextResponse.json(workshopFields)
    }

    return NextResponse.json(vehicleWithImage as Vehicle)
  } catch (err) {
    console.error("vehicles/[id] GET unexpected error:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/vehicles/[id] — partial update
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermissionGuard("vehicles.edit")
    if (guard instanceof NextResponse) return guard

    const { tenantId } = guard
    const { id } = await params

    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json(
        { error: "Ungültige Fahrzeug-ID." },
        { status: 400 }
      )
    }

    const body = await request.json()
    const parsed = updateVehicleSchema.safeParse(body)

    if (!parsed.success) {
      return NextResponse.json(
        { error: "Validierungsfehler", details: parsed.error.flatten() },
        { status: 400 }
      )
    }

    if (Object.keys(parsed.data).length === 0) {
      return NextResponse.json(
        { error: "Keine Felder zum Aktualisieren angegeben." },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify vehicle exists in tenant and is not deleted
    const { data: existing, error: fetchError } = await adminClient
      .from("vehicles")
      .select("id, license_plate")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Fahrzeug nicht gefunden." },
        { status: 404 }
      )
    }

    // If license_plate is being changed, check uniqueness
    if (
      parsed.data.license_plate &&
      parsed.data.license_plate !== existing.license_plate
    ) {
      const { data: duplicate } = await adminClient
        .from("vehicles")
        .select("id")
        .eq("tenant_id", tenantId)
        .eq("license_plate", parsed.data.license_plate)
        .is("deleted_at", null)
        .neq("id", id)
        .limit(1)
        .single()

      if (duplicate) {
        return NextResponse.json(
          {
            error: `Kennzeichen "${parsed.data.license_plate}" existiert bereits in diesem Mandanten.`,
          },
          { status: 409 }
        )
      }
    }

    const { data: updated, error: updateError } = await adminClient
      .from("vehicles")
      .update(parsed.data)
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .select()
      .single()

    if (updateError) {
      console.error("vehicles/[id] PATCH error:", updateError)
      if (updateError.code === "23505") {
        return NextResponse.json(
          {
            error: `Kennzeichen "${parsed.data.license_plate}" existiert bereits in diesem Mandanten.`,
          },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: "Fehler beim Aktualisieren des Fahrzeugs." },
        { status: 500 }
      )
    }

    return NextResponse.json(updated as Vehicle)
  } catch (err) {
    console.error("vehicles/[id] PATCH unexpected error:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// DELETE /api/vehicles/[id] — soft delete (TENANT_ADMIN+ only)
// ---------------------------------------------------------------------------

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    // First check vehicles.edit permission
    const guard = await requirePermissionGuard("vehicles.edit")
    if (guard instanceof NextResponse) return guard

    const { tenantId, role } = guard
    const { id } = await params

    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json(
        { error: "Ungültige Fahrzeug-ID." },
        { status: 400 }
      )
    }

    // Additional role check: only TENANT_ADMIN and SUPERADMIN can delete
    if (role !== "TENANT_ADMIN" && role !== "SUPERADMIN") {
      return NextResponse.json(
        {
          error:
            "Nur TENANT_ADMIN oder SUPERADMIN dürfen Fahrzeuge löschen.",
        },
        { status: 403 }
      )
    }

    const adminClient = createAdminClient()

    // Verify vehicle exists in tenant and is not already deleted
    const { data: existing, error: fetchError } = await adminClient
      .from("vehicles")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single()

    if (fetchError || !existing) {
      return NextResponse.json(
        { error: "Fahrzeug nicht gefunden." },
        { status: 404 }
      )
    }

    // Soft delete: set deleted_at
    const { error: deleteError } = await adminClient
      .from("vehicles")
      .update({ deleted_at: new Date().toISOString() })
      .eq("id", id)
      .eq("tenant_id", tenantId)

    if (deleteError) {
      console.error("vehicles/[id] DELETE error:", deleteError)
      return NextResponse.json(
        { error: "Fehler beim Löschen des Fahrzeugs." },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true })
  } catch (err) {
    console.error("vehicles/[id] DELETE unexpected error:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
