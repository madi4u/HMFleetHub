import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { db } from "@/lib/db"
import { requirePermissionGuard } from "@/lib/auth-guard"

const inviteSchema = z.object({
  email: z.string().email("Ungültige E-Mail-Adresse"),
  role: z.enum(
    [
      "TENANT_ADMIN",
      "FLEET_MANAGER",
      "OFFICE_USER",
      "WORKSHOP_MECHANIC",
      "READ_ONLY",
    ] as const,
    { message: "Ungültige Rolle" }
  ),
})

export async function POST(request: NextRequest) {
  try {
    const guard = await requirePermissionGuard("users.manage")
    if (guard instanceof NextResponse) return guard

    const { tenantId, isSuperadmin } = guard

    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ungültiger Request-Body" },
        { status: 400 }
      )
    }

    const parseResult = inviteSchema.safeParse(body)
    if (!parseResult.success) {
      return NextResponse.json(
        { error: "Validierungsfehler", details: parseResult.error.issues.map((i) => i.message) },
        { status: 400 }
      )
    }

    const { email, role } = parseResult.data

    if (!isSuperadmin && role === "TENANT_ADMIN") {
      return NextResponse.json(
        { error: "Nur SUPERADMIN kann die TENANT_ADMIN-Rolle vergeben." },
        { status: 403 }
      )
    }

    // Verify tenant is active
    const tenantRes = await db.query(
      `SELECT id, status FROM fleethub.tenants WHERE id = $1`,
      [tenantId]
    )
    const tenant = tenantRes.rows[0]
    if (!tenant) {
      return NextResponse.json({ error: "Mandant nicht gefunden" }, { status: 404 })
    }
    if (tenant.status !== "active") {
      return NextResponse.json(
        { error: "Mandant ist deaktiviert. Hinzufügen nicht möglich." },
        { status: 400 }
      )
    }

    // Look up user in identity.users by email
    const userRes = await db.query(
      `SELECT id, name FROM identity.users WHERE email = $1 AND is_active = true`,
      [email]
    )
    const identityUser = userRes.rows[0]

    if (!identityUser) {
      return NextResponse.json(
        {
          error:
            "Kein aktiver Benutzer mit dieser E-Mail gefunden. Der Benutzer muss sich zuerst über auth.hundm.cloud anmelden.",
        },
        { status: 404 }
      )
    }

    // Check existing membership
    const memRes = await db.query(
      `SELECT id, is_active, role FROM fleethub.user_tenant_memberships
       WHERE user_id = $1 AND tenant_id = $2`,
      [identityUser.id, tenantId]
    )
    const existingMem = memRes.rows[0]

    if (existingMem) {
      if (existingMem.is_active) {
        return NextResponse.json(
          {
            error: `Benutzer ist bereits als ${existingMem.role} in diesem Mandanten aktiv.`,
          },
          { status: 409 }
        )
      }

      // Reactivate
      await db.query(
        `UPDATE fleethub.user_tenant_memberships SET is_active = true, role = $1 WHERE id = $2`,
        [role, existingMem.id]
      )

      return NextResponse.json({
        message: "Benutzer wurde reaktiviert und dem Mandanten zugewiesen.",
        user_id: identityUser.id,
      })
    }

    // Create new membership
    const insertRes = await db.query(
      `INSERT INTO fleethub.user_tenant_memberships (user_id, tenant_id, role)
       VALUES ($1, $2, $3)
       RETURNING id`,
      [identityUser.id, tenantId, role]
    )

    if (!insertRes.rows[0]) {
      return NextResponse.json(
        { error: "Fehler beim Erstellen der Mandantenzugehörigkeit." },
        { status: 500 }
      )
    }

    return NextResponse.json(
      {
        message: "Benutzer wurde dem Mandanten hinzugefügt.",
        user_id: identityUser.id,
      },
      { status: 201 }
    )
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
