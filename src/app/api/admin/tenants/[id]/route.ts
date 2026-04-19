import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
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

    // Fetch tenant
    const tenantRes = await db.query(
      `SELECT * FROM fleethub.tenants WHERE id = $1`,
      [id]
    )
    const tenant = tenantRes.rows[0]

    if (!tenant) {
      return NextResponse.json(
        { error: "Mandant nicht gefunden" },
        { status: 404 }
      )
    }

    // Fetch memberships joined with identity.users
    const membershipsRes = await db.query(
      `SELECT
         utm.id          AS membership_id,
         utm.user_id,
         utm.role,
         utm.is_active,
         utm.created_at  AS joined_at,
         iu.email,
         iu.name         AS full_name
       FROM fleethub.user_tenant_memberships utm
       LEFT JOIN identity.users iu ON iu.id = utm.user_id
       WHERE utm.tenant_id = $1
       ORDER BY utm.created_at DESC
       LIMIT 500`,
      [id]
    )

    const users = membershipsRes.rows.map((m: Record<string, unknown>) => ({
      membership_id: m.membership_id,
      user_id: m.user_id,
      role: m.role,
      is_active: m.is_active,
      joined_at: m.joined_at,
      email: m.email ?? "",
      full_name: m.full_name ?? null,
      avatar_url: null,
    }))

    // Count active vehicles for this tenant
    const vehicleCountRes = await db.query(
      `SELECT COUNT(*) AS cnt FROM fleethub.vehicles WHERE tenant_id = $1 AND deleted_at IS NULL`,
      [id]
    )
    const vehicleCount = parseInt(vehicleCountRes.rows[0]?.cnt ?? "0")

    return NextResponse.json({
      tenant: {
        ...tenant,
        user_count: users.filter((u) => u.is_active).length,
        vehicle_count: vehicleCount,
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

    // If deactivating, prevent locking yourself out
    if (updates.status === "inactive") {
      const lockoutCheck = await db.query(
        `SELECT id FROM fleethub.user_tenant_memberships
         WHERE user_id = $1 AND tenant_id = $2 AND is_active = true LIMIT 1`,
        [guard.userId, id]
      )
      if (lockoutCheck.rows.length > 0) {
        return NextResponse.json(
          {
            error:
              "Sie können einen Mandanten nicht deaktivieren, in dem Sie selbst Mitglied sind.",
          },
          { status: 400 }
        )
      }
    }

    // Check slug uniqueness
    if (updates.slug) {
      const slugCheck = await db.query(
        `SELECT id FROM fleethub.tenants WHERE slug = $1 AND id != $2 LIMIT 1`,
        [updates.slug, id]
      )
      if (slugCheck.rows.length > 0) {
        return NextResponse.json(
          { error: "Ein Mandant mit diesem Slug existiert bereits." },
          { status: 409 }
        )
      }
    }

    // Build SET clause dynamically
    const fields: string[] = []
    const vals: unknown[] = []
    if (updates.name !== undefined) { fields.push("name"); vals.push(updates.name) }
    if (updates.slug !== undefined) { fields.push("slug"); vals.push(updates.slug) }
    if (updates.contact_email !== undefined) { fields.push("contact_email"); vals.push(updates.contact_email ?? null) }
    if (updates.address !== undefined) { fields.push("address"); vals.push(updates.address ?? null) }
    if (updates.status !== undefined) { fields.push("status"); vals.push(updates.status) }

    vals.push(id)
    const setClauses = fields.map((f, i) => `"${f}" = $${i + 1}`).join(", ")

    let tenant: Record<string, unknown> | null = null
    try {
      const updateRes = await db.query(
        `UPDATE fleethub.tenants SET ${setClauses} WHERE id = $${vals.length} RETURNING *`,
        vals
      )
      tenant = updateRes.rows[0] ?? null
    } catch (err: unknown) {
      const pgErr = err as { code?: string }
      if (pgErr?.code === "23505") {
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
