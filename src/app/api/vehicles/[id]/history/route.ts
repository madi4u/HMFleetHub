import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const PAGE_SIZE = 20

const createEntrySchema = z.object({
  entry_type: z.enum([
    "NOTE",
    "REPAIR",
    "MAINTENANCE",
    "OIL_CHANGE",
    "TIRE_CHANGE",
    "DAMAGE",
    "INSPECTION",
    "TUV",
    "MILEAGE_UPDATE",
    "DOCUMENT_UPLOAD",
    "PHOTO_UPLOAD",
    "VIDEO_UPLOAD",
    "OTHER",
  ]),
  title: z.string().max(200).optional().nullable(),
  message: z.string().max(5000).optional().nullable(),
  mileage: z.number().int().positive().optional().nullable(),
  cost_net: z.number().min(0).optional().nullable(),
  cost_gross: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  invoice_number: z.string().max(100).optional().nullable(),
  event_date: z.string().datetime().optional().nullable(),
  repair_status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional().nullable(),
  next_due_date: z.string().optional().nullable(),
  cost_category: z
    .enum([
      "REPAIR",
      "MAINTENANCE",
      "OIL",
      "TIRES",
      "INSPECTION",
      "BODYWORK",
      "ELECTRICAL",
      "OTHER",
    ])
    .optional()
    .nullable(),
})

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.history.view")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const url = new URL(request.url)
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1"))
  const type = url.searchParams.get("type") ?? null
  const types = url.searchParams.get("types") ?? null // e.g. "REPAIR,MAINTENANCE,DAMAGE"

  const supabase = await createClient()

  // Verify vehicle belongs to tenant
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (vehicleError || !vehicle) {
    return NextResponse.json(
      { error: "Fahrzeug nicht gefunden" },
      { status: 404 }
    )
  }

  // Count total
  let countQuery = supabase
    .from("vehicle_history_entries")
    .select("id", { count: "exact", head: true })
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)

  if (types) {
    const typeArray = types.split(",").map((t) => t.trim()).filter(Boolean)
    countQuery = countQuery.in("entry_type", typeArray)
  } else if (type) {
    countQuery = countQuery.eq("entry_type", type)
  }

  const { count } = await countQuery

  // Fetch entries with pagination
  let query = supabase
    .from("vehicle_history_entries")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .order("event_date", { ascending: true })
    .range((page - 1) * PAGE_SIZE, page * PAGE_SIZE - 1)

  if (types) {
    const typeArray = types.split(",").map((t) => t.trim()).filter(Boolean)
    query = query.in("entry_type", typeArray)
  } else if (type) {
    query = query.eq("entry_type", type)
  }

  const { data: entries, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch attachments for all entries
  const entryIds = (entries ?? []).map(
    (e: { id: string }) => e.id
  )
  const attachmentsMap: Record<string, Record<string, unknown>[]> = {}

  if (entryIds.length > 0) {
    const { data: attachments } = await supabase
      .from("vehicle_history_attachments")
      .select("*")
      .in("history_entry_id", entryIds)

    // Generate signed URLs
    const adminClient = createAdminClient()
    const enriched = await Promise.all(
      (attachments ?? []).map(
        async (att: { file_path: string; history_entry_id: string }) => {
          const { data: signed } = await adminClient.storage
            .from("vehicle-media")
            .createSignedUrl(att.file_path, 3600)
          return { ...att, signed_url: signed?.signedUrl ?? null }
        }
      )
    )

    // Group by entry id
    for (const att of enriched) {
      const key = att.history_entry_id as string
      if (!attachmentsMap[key]) attachmentsMap[key] = []
      attachmentsMap[key].push(att)
    }
  }

  // Fetch author profiles
  const authorIds = [
    ...new Set(
      (entries ?? []).map(
        (e: { author_user_id: string }) => e.author_user_id
      )
    ),
  ]
  const adminClient = createAdminClient()
  const profileMap: Record<
    string,
    { full_name: string | null; avatar_url: string | null }
  > = {}

  if (authorIds.length > 0) {
    const { data: profiles } = await adminClient
      .from("profiles")
      .select("id, full_name, avatar_url")
      .in("id", authorIds)

    for (const p of profiles ?? []) {
      const profile = p as {
        id: string
        full_name: string | null
        avatar_url: string | null
      }
      profileMap[profile.id] = {
        full_name: profile.full_name,
        avatar_url: profile.avatar_url,
      }
    }
  }

  const enrichedEntries = (entries ?? []).map(
    (entry: { id: string; author_user_id: string }) => ({
      ...entry,
      author_name:
        profileMap[entry.author_user_id]?.full_name ?? null,
      author_avatar:
        profileMap[entry.author_user_id]?.avatar_url ?? null,
      attachments: attachmentsMap[entry.id] ?? [],
    })
  )

  const total = count ?? 0

  return NextResponse.json({
    data: enrichedEntries,
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
  const auth = await requirePermissionGuard("vehicles.history.create")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const body = await request.json()
  const parsed = createEntrySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Verify vehicle belongs to tenant
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (vehicleError || !vehicle) {
    return NextResponse.json(
      { error: "Fahrzeug nicht gefunden" },
      { status: 404 }
    )
  }

  const { data, error } = await supabase
    .from("vehicle_history_entries")
    .insert({
      tenant_id: auth.tenantId,
      vehicle_id: vehicleId,
      author_user_id: auth.userId,
      ...parsed.data,
      event_date: parsed.data.event_date ?? new Date().toISOString(),
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ...data, attachments: [] }, { status: 201 })
}
