import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requireAdminForTenant } from "@/lib/auth-guard"

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

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

// ---------------------------------------------------------------------------
// Route params type
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// POST /api/admin/tenants/[id]/invite
// ---------------------------------------------------------------------------

export async function POST(
  request: NextRequest,
  context: RouteContext
) {
  try {
    const { id: tenantId } = await context.params

    // Validate UUID format
    if (!z.string().uuid().safeParse(tenantId).success) {
      return NextResponse.json(
        { error: "Ungültige Mandanten-ID" },
        { status: 400 }
      )
    }

    // Auth check: SUPERADMIN or TENANT_ADMIN for this tenant
    const guard = await requireAdminForTenant(tenantId)
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

    const parseResult = inviteSchema.safeParse(body)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => i.message)
      return NextResponse.json(
        { error: "Validierungsfehler", details: errors },
        { status: 400 }
      )
    }

    const { email, role } = parseResult.data
    const adminClient = createAdminClient()

    // TENANT_ADMIN cannot assign SUPERADMIN role
    if (!guard.isSuperadmin && role === ("SUPERADMIN" as string)) {
      return NextResponse.json(
        { error: "Nur SUPERADMIN kann die SUPERADMIN-Rolle vergeben." },
        { status: 403 }
      )
    }

    // Verify target tenant exists and is active
    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .select("id, status")
      .eq("id", tenantId)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Mandant nicht gefunden" },
        { status: 404 }
      )
    }

    if (tenant.status !== "active") {
      return NextResponse.json(
        { error: "Mandant ist deaktiviert. Einladung nicht möglich." },
        { status: 400 }
      )
    }

    // Invite the user via Supabase Auth (service role)
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${
          process.env.NEXT_PUBLIC_APP_URL || ""
        }/auth/reset-password`,
      })

    if (inviteError) {
      // If user already exists, assign them to the tenant
      if (inviteError.message?.includes("already been registered")) {
        return await handleExistingUser(
          adminClient,
          email,
          tenantId,
          role
        )
      }

      return NextResponse.json(
        { error: `Einladung fehlgeschlagen: ${inviteError.message}` },
        { status: 500 }
      )
    }

    if (!inviteData?.user) {
      return NextResponse.json(
        { error: "Einladung fehlgeschlagen: Kein Benutzer erstellt." },
        { status: 500 }
      )
    }

    // Create tenant membership for the new user
    const { error: membershipError } = await adminClient
      .from("user_tenant_memberships")
      .insert({
        user_id: inviteData.user.id,
        tenant_id: tenantId,
        role,
      })

    if (membershipError) {
      // Rollback: delete the invited user if membership creation fails
      await adminClient.auth.admin.deleteUser(inviteData.user.id)
      return NextResponse.json(
        {
          error:
            "Benutzer wurde erstellt, aber die Mandantenzugehörigkeit konnte nicht angelegt werden. Der Benutzer wurde wieder entfernt.",
        },
        { status: 500 }
      )
    }

    // Update profile with tenant_id
    await adminClient
      .from("profiles")
      .update({ tenant_id: tenantId })
      .eq("id", inviteData.user.id)

    return NextResponse.json(
      {
        message: "Einladung erfolgreich versendet.",
        user_id: inviteData.user.id,
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

// ---------------------------------------------------------------------------
// Helper: handle invite when user already exists in auth.users
// ---------------------------------------------------------------------------

async function handleExistingUser(
  adminClient: ReturnType<typeof createAdminClient>,
  email: string,
  tenantId: string,
  role: string
) {
  // Look up the existing user
  const { data: existingUsers } =
    await adminClient.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find(
    (u) => u.email === email
  )

  if (!existingUser) {
    return NextResponse.json(
      {
        error:
          "Benutzer existiert bereits, konnte aber nicht gefunden werden.",
      },
      { status: 409 }
    )
  }

  // Check if membership already exists
  const { data: existingMem } = await adminClient
    .from("user_tenant_memberships")
    .select("id, is_active, role")
    .eq("user_id", existingUser.id)
    .eq("tenant_id", tenantId)
    .single()

  if (existingMem) {
    if (existingMem.is_active) {
      return NextResponse.json(
        {
          error: `Benutzer ist bereits als ${existingMem.role} in diesem Mandanten aktiv.`,
        },
        { status: 409 }
      )
    }

    // Reactivate inactive membership with new role
    await adminClient
      .from("user_tenant_memberships")
      .update({ is_active: true, role })
      .eq("id", existingMem.id)

    return NextResponse.json({
      message:
        "Benutzer wurde reaktiviert und dem Mandanten zugewiesen.",
      user_id: existingUser.id,
    })
  }

  // Create new membership for existing user
  const { error: membershipInsertError } = await adminClient
    .from("user_tenant_memberships")
    .insert({
      user_id: existingUser.id,
      tenant_id: tenantId,
      role,
    })

  if (membershipInsertError) {
    return NextResponse.json(
      { error: "Fehler beim Erstellen der Mandantenzugehörigkeit." },
      { status: 500 }
    )
  }

  // Update profile with tenant_id
  await adminClient
    .from("profiles")
    .update({ tenant_id: tenantId })
    .eq("id", existingUser.id)

  return NextResponse.json({
    message:
      "Benutzer existiert bereits und wurde dem Mandanten zugewiesen.",
    user_id: existingUser.id,
  })
}
