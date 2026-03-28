import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionGuard } from "@/lib/auth-guard"

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
// POST /api/users/invite
// ---------------------------------------------------------------------------

/**
 * Invites a user to the current tenant.
 * Requires: users.manage permission.
 *
 * Body: { email: string, role: UserRole }
 * - SUPERADMIN role cannot be assigned via this endpoint.
 * - If the user already exists, reactivates their membership or creates a new one.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Auth + permission check
    const guard = await requirePermissionGuard("users.manage")
    if (guard instanceof NextResponse) return guard

    const { tenantId, isSuperadmin } = guard

    // 2. Parse & validate body
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

    // 3. TENANT_ADMIN cannot assign SUPERADMIN role
    //    (Zod schema already excludes SUPERADMIN, but double-check defensively)
    if (!isSuperadmin && role === ("SUPERADMIN" as string)) {
      return NextResponse.json(
        { error: "Nur SUPERADMIN kann die SUPERADMIN-Rolle vergeben." },
        { status: 403 }
      )
    }

    // 3b. Only SUPERADMIN can assign TENANT_ADMIN role
    if (!isSuperadmin && role === "TENANT_ADMIN") {
      return NextResponse.json(
        { error: "Nur SUPERADMIN kann die TENANT_ADMIN-Rolle vergeben." },
        { status: 403 }
      )
    }

    // 4. Verify tenant is active
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

    // 5. Invite the user via Supabase Auth
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        redirectTo: `${
          process.env.NEXT_PUBLIC_APP_URL || ""
        }/auth/reset-password`,
      })

    if (inviteError) {
      // User already registered — handle existing user
      if (inviteError.message?.includes("already been registered")) {
        return await handleExistingUser(adminClient, email, tenantId, role)
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

    // 6. Create tenant membership
    const { error: membershipError } = await adminClient
      .from("user_tenant_memberships")
      .insert({
        user_id: inviteData.user.id,
        tenant_id: tenantId,
        role,
      })

    if (membershipError) {
      // Rollback: remove the invited auth user
      await adminClient.auth.admin.deleteUser(inviteData.user.id)
      return NextResponse.json(
        {
          error:
            "Benutzer wurde erstellt, aber die Mandantenzugehörigkeit konnte nicht angelegt werden. Der Benutzer wurde wieder entfernt.",
        },
        { status: 500 }
      )
    }

    // 7. Set profile tenant_id
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
  // Look up the existing user by email
  const { data: existingUsers } = await adminClient.auth.admin.listUsers()
  const existingUser = existingUsers?.users?.find((u) => u.email === email)

  if (!existingUser) {
    return NextResponse.json(
      {
        error:
          "Benutzer existiert bereits, konnte aber nicht gefunden werden.",
      },
      { status: 409 }
    )
  }

  // Check if membership already exists for this tenant
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
      message: "Benutzer wurde reaktiviert und dem Mandanten zugewiesen.",
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
