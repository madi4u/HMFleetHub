import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireSuperadmin } from "@/lib/auth-guard"

// ---------------------------------------------------------------------------
// Zod Schema for PATCH
// ---------------------------------------------------------------------------

const updateTenantSchema = z
  .object({
    name: z
      .string()
      .min(1, "Firmenname ist erforderlich")
      .max(255, "Firmenname darf maximal 255 Zeichen lang sein")
      .optional(),
    slug: z
      .string()
      .min(1, "Slug ist erforderlich")
      .max(100, "Slug darf maximal 100 Zeichen lang sein")
      .regex(
        /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
        "Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten"
      )
      .optional(),
    contact_email: z.string().email("Ungültige E-Mail-Adresse").nullish(),
    address: z
      .string()
      .max(500, "Adresse darf maximal 500 Zeichen lang sein")
      .nullish(),
    status: z.enum(["active", "inactive"]).optional(),
  })
  .refine((data) => Object.keys(data).length > 0, {
    message: "Mindestens ein Feld muss angegeben werden.",
  })

// ---------------------------------------------------------------------------
// Route params type
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// GET /api/admin/tenants/[id] -- single tenant with user list
// ---------------------------------------------------------------------------

export async function GET(
  _request: NextRequest,
  context: RouteContext
) {
  try {
    const guard = await requireSuperadmin()
    if (guard instanceof NextResponse) return guard

    const { id } = await context.params

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: "Ungültige Mandanten-ID" },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Fetch tenant
    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .select("*")
      .eq("id", id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Mandant nicht gefunden" },
        { status: 404 }
      )
    }

    // Fetch memberships for this tenant (without profiles join — no FK to public.profiles)
    const { data: memberships, error: membershipsError } = await adminClient
      .from("user_tenant_memberships")
      .select("id, user_id, role, is_active, created_at")
      .eq("tenant_id", id)
      .order("created_at", { ascending: false })
      .limit(500)

    if (membershipsError) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Benutzer." },
        { status: 500 }
      )
    }

    // Get user emails + full_names via separate queries
    const userIds = (memberships || []).map((m) => m.user_id)
    const emailMap: Record<string, string> = {}
    const nameMap: Record<string, string | null> = {}

    if (userIds.length > 0) {
      // Fetch emails from auth.users
      const { data: authUsers } = await adminClient.auth.admin.listUsers({
        perPage: 1000,
      })
      if (authUsers?.users) {
        for (const u of authUsers.users) {
          if (userIds.includes(u.id)) {
            emailMap[u.id] = u.email || ""
          }
        }
      }

      // Fetch full_name + avatar_url from profiles
      const { data: profiles } = await adminClient
        .from("profiles")
        .select("id, full_name, avatar_url")
        .in("id", userIds)

      if (profiles) {
        for (const p of profiles) {
          nameMap[p.id] = p.full_name ?? null
        }
      }
    }

    const users = (memberships || []).map((m) => ({
      membership_id: m.id,
      user_id: m.user_id,
      role: m.role,
      is_active: m.is_active,
      joined_at: m.created_at,
      email: emailMap[m.user_id] || "",
      full_name: nameMap[m.user_id] ?? null,
      avatar_url: null,
    }))

    return NextResponse.json({
      tenant: {
        ...tenant,
        user_count: users.filter((u) => u.is_active).length,
        vehicle_count: 0, // PROJ-5
      },
      users,
    })
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}

// ---------------------------------------------------------------------------
// PATCH /api/admin/tenants/[id] -- update tenant or toggle status
// ---------------------------------------------------------------------------

export async function PATCH(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const guard = await requireSuperadmin()
    if (guard instanceof NextResponse) return guard

    const { id } = await context.params

    // Validate UUID format
    if (!z.string().uuid().safeParse(id).success) {
      return NextResponse.json(
        { error: "Ungültige Mandanten-ID" },
        { status: 400 }
      )
    }

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

    const parseResult = updateTenantSchema.safeParse(body)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => i.message)
      return NextResponse.json(
        { error: "Validierungsfehler", details: errors },
        { status: 400 }
      )
    }

    const updates = parseResult.data
    const adminClient = createAdminClient()

    // If deactivating, check that the SUPERADMIN's own membership is not in this tenant
    // (prevent locking yourself out)
    if (updates.status === "inactive") {
      const { data: callerMembership } = await adminClient
        .from("user_tenant_memberships")
        .select("id")
        .eq("user_id", guard.userId)
        .eq("tenant_id", id)
        .eq("is_active", true)
        .limit(1)

      if (callerMembership && callerMembership.length > 0) {
        return NextResponse.json(
          {
            error:
              "Sie können einen Mandanten nicht deaktivieren, in dem Sie selbst Mitglied sind.",
          },
          { status: 400 }
        )
      }
    }

    // If slug is being changed, check uniqueness
    if (updates.slug) {
      const { data: existing } = await adminClient
        .from("tenants")
        .select("id")
        .eq("slug", updates.slug)
        .neq("id", id)
        .limit(1)
        .single()

      if (existing) {
        return NextResponse.json(
          { error: "Ein Mandant mit diesem Slug existiert bereits." },
          { status: 409 }
        )
      }
    }

    // Build update payload -- only include defined fields
    const updatePayload: Record<string, unknown> = {}
    if (updates.name !== undefined) updatePayload.name = updates.name
    if (updates.slug !== undefined) updatePayload.slug = updates.slug
    if (updates.contact_email !== undefined)
      updatePayload.contact_email = updates.contact_email ?? null
    if (updates.address !== undefined)
      updatePayload.address = updates.address ?? null
    if (updates.status !== undefined) updatePayload.status = updates.status

    const { data: tenant, error: updateError } = await adminClient
      .from("tenants")
      .update(updatePayload)
      .eq("id", id)
      .select()
      .single()

    if (updateError) {
      if (updateError.code === "23505") {
        return NextResponse.json(
          { error: "Ein Mandant mit diesem Slug existiert bereits." },
          { status: 409 }
        )
      }
      return NextResponse.json(
        { error: "Fehler beim Aktualisieren des Mandanten." },
        { status: 500 }
      )
    }

    if (!tenant) {
      return NextResponse.json(
        { error: "Mandant nicht gefunden" },
        { status: 404 }
      )
    }

    return NextResponse.json({ tenant })
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
