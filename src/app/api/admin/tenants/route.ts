import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperadmin } from "@/lib/auth-guard"

// ---------------------------------------------------------------------------
// Zod Schemas
// ---------------------------------------------------------------------------

const createTenantSchema = z.object({
  name: z
    .string()
    .min(1, "Firmenname ist erforderlich")
    .max(255, "Firmenname darf maximal 255 Zeichen lang sein"),
  slug: z
    .string()
    .min(1, "Slug ist erforderlich")
    .max(100, "Slug darf maximal 100 Zeichen lang sein")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten"
    ),
  contact_email: z.string().email("Ungültige E-Mail-Adresse").nullish(),
  address: z.string().max(500, "Adresse darf maximal 500 Zeichen lang sein").nullish(),
})

// ---------------------------------------------------------------------------
// GET /api/admin/tenants -- list all tenants with user counts
// ---------------------------------------------------------------------------

export async function GET() {
  try {
    const guard = await requireSuperadmin()
    if (guard instanceof NextResponse) return guard

    const adminClient = createAdminClient()

    // Fetch all tenants ordered by created_at DESC
    const { data: tenants, error: tenantsError } = await adminClient
      .from("tenants")
      .select("*")
      .order("created_at", { ascending: false })
      .limit(1000)

    if (tenantsError) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Mandanten." },
        { status: 500 }
      )
    }

    // Fetch user counts and vehicle counts per tenant in parallel
    const [membershipResult, vehicleResult] = await Promise.all([
      adminClient
        .from("user_tenant_memberships")
        .select("tenant_id")
        .eq("is_active", true),
      adminClient
        .from("vehicles")
        .select("tenant_id")
        .is("deleted_at", null),
    ])

    if (membershipResult.error) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Benutzerzahlen." },
        { status: 500 }
      )
    }

    // Aggregate counts in memory (avoids N+1)
    const userCountMap: Record<string, number> = {}
    for (const m of membershipResult.data || []) {
      userCountMap[m.tenant_id] = (userCountMap[m.tenant_id] || 0) + 1
    }

    const vehicleCountMap: Record<string, number> = {}
    for (const v of vehicleResult.data || []) {
      vehicleCountMap[v.tenant_id] = (vehicleCountMap[v.tenant_id] || 0) + 1
    }

    const tenantsWithCounts = (tenants || []).map((tenant) => ({
      ...tenant,
      user_count: userCountMap[tenant.id] || 0,
      vehicle_count: vehicleCountMap[tenant.id] || 0,
    }))

    return NextResponse.json({ tenants: tenantsWithCounts })
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// POST /api/admin/tenants -- create a new tenant
// ---------------------------------------------------------------------------

export async function POST(request: NextRequest) {
  try {
    const guard = await requireSuperadmin()
    if (guard instanceof NextResponse) return guard

    // Parse body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ungültiger Request-Body" },
        { status: 400 }
      )
    }

    const parseResult = createTenantSchema.safeParse(body)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => i.message)
      return NextResponse.json(
        { error: "Validierungsfehler", details: errors },
        { status: 400 }
      )
    }

    const { name, slug, contact_email, address } = parseResult.data
    const adminClient = createAdminClient()

    // Check slug uniqueness
    const { data: existing } = await adminClient
      .from("tenants")
      .select("id")
      .eq("slug", slug)
      .limit(1)
      .single()

    if (existing) {
      return NextResponse.json(
        { error: "Ein Mandant mit diesem Slug existiert bereits." },
        { status: 409 }
      )
    }

    // Insert tenant
    const { data: tenant, error: insertError } = await adminClient
      .from("tenants")
      .insert({
        name,
        slug,
        contact_email: contact_email ?? null,
        address: address ?? null,
        status: "active",
      })
      .select()
      .single()

    if (insertError) {
      // Handle unique constraint violation at DB level too
      if (insertError.code === "23505") {
        return NextResponse.json(
          { error: "Ein Mandant mit diesem Slug existiert bereits." },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: "Fehler beim Erstellen des Mandanten." },
        { status: 500 }
      )
    }

    return NextResponse.json({ tenant }, { status: 201 })
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
