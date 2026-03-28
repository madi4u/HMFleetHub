import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const PAGE_SIZE = 20

const createMileageSchema = z.object({
  mileage: z.number().int().min(0),
  recorded_at: z.string().datetime().optional().nullable(),
  source: z.string().max(200).optional().nullable(),
  notes: z.string().max(500).optional().nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.list")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"))

  const supabase = await createClient()

  // Verify vehicle belongs to tenant
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (!vehicle) {
    return NextResponse.json(
      { error: "Fahrzeug nicht gefunden" },
      { status: 404 }
    )
  }

  const { count } = await supabase
    .from("mileage_entries")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)

  const { data: entries, error } = await supabase
    .from("mileage_entries")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .order("recorded_at", { ascending: false })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Enrich with author names
  const authorIds = [...new Set((entries ?? []).map((e) => e.user_id))]
  const profileMap: Record<string, string | null> = {}
  if (authorIds.length > 0) {
    const adminClient = createAdminClient()
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name")
      .in("id", authorIds)
    for (const p of profiles ?? []) {
      const profile = p as { id: string; full_name: string | null }
      profileMap[profile.id] = profile.full_name
    }
  }

  const enriched = (entries ?? []).map((e) => ({
    ...e,
    author_name: profileMap[e.user_id] ?? null,
  }))

  const total = count ?? 0
  return NextResponse.json({
    data: enriched,
    total,
    page,
    pageSize: PAGE_SIZE,
    hasMore: page * PAGE_SIZE < total,
  })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.edit")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const body = await request.json()
  const parsed = createMileageSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id, current_mileage")
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (!vehicle) {
    return NextResponse.json(
      { error: "Fahrzeug nicht gefunden" },
      { status: 404 }
    )
  }

  const { data, error } = await supabase
    .from("mileage_entries")
    .insert({
      tenant_id: auth.tenantId,
      vehicle_id: vehicleId,
      user_id: auth.userId,
      mileage: parsed.data.mileage,
      recorded_at: parsed.data.recorded_at ?? new Date().toISOString(),
      source: parsed.data.source ?? null,
      notes: parsed.data.notes ?? null,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(
    { ...data, previousMileage: vehicle.current_mileage },
    { status: 201 }
  )
}
