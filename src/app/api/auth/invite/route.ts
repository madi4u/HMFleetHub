import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { UserRole } from "@/types/database"

/**
 * Zod schema for the invite request body.
 * Validates email format, role against allowed values, and required tenant_id.
 */
const inviteSchema = z.object({
  email: z.email("Ungueltige E-Mail-Adresse"),
  role: z.enum([
    "TENANT_ADMIN",
    "FLEET_MANAGER",
    "OFFICE_USER",
    "WORKSHOP_MECHANIC",
    "READ_ONLY",
  ] as const, "Ungueltige Rolle"),
  tenant_id: z.uuid("Ungueltige Mandanten-ID"),
  full_name: z.string().optional(),
})

type InviteRequest = z.infer<typeof inviteSchema>

/**
 * POST /api/auth/invite
 *
 * Invites a new user by email. Creates the auth user via Supabase
 * inviteUserByEmail and assigns them a tenant membership.
 *
 * Requires: SUPERADMIN or TENANT_ADMIN role.
 * - SUPERADMIN can invite to any tenant.
 * - TENANT_ADMIN can only invite to their own tenant.
 *
 * Uses the service role key server-side only.
 */
export async function POST(request: NextRequest) {
  try {
    // 1. Verify authentication
    const supabase = await createClient()
    const {
      data: { user: authUser },
      error: authError,
    } = await supabase.auth.getUser()

    if (authError || !authUser) {
      return NextResponse.json(
        { error: "Nicht authentifiziert" },
        { status: 401 }
      )
    }

    // 2. Parse and validate request body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ungueltiger Request-Body" },
        { status: 400 }
      )
    }

    const parseResult = inviteSchema.safeParse(body)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((issue) => issue.message)
      return NextResponse.json(
        { error: "Validierungsfehler", details: errors },
        { status: 400 }
      )
    }

    const { email, role, tenant_id, full_name }: InviteRequest =
      parseResult.data

    // 3. Check caller's role -- must be SUPERADMIN or TENANT_ADMIN
    const { data: callerMembership, error: callerError } = await supabase
      .from("user_tenant_memberships")
      .select("role, tenant_id, is_active")
      .eq("user_id", authUser.id)
      .eq("is_active", true)
      .limit(10)

    if (callerError || !callerMembership || callerMembership.length === 0) {
      return NextResponse.json(
        { error: "Keine Berechtigung" },
        { status: 403 }
      )
    }

    const isSuperadmin = callerMembership.some(
      (m) => m.role === "SUPERADMIN" && m.is_active
    )
    const isTenantAdmin = callerMembership.some(
      (m) =>
        m.role === "TENANT_ADMIN" &&
        m.tenant_id === tenant_id &&
        m.is_active
    )

    if (!isSuperadmin && !isTenantAdmin) {
      return NextResponse.json(
        {
          error:
            "Nur SUPERADMIN oder TENANT_ADMIN des Mandanten duerfen Benutzer einladen.",
        },
        { status: 403 }
      )
    }

    // 4. TENANT_ADMIN cannot assign SUPERADMIN role
    if (!isSuperadmin && role === ("SUPERADMIN" as UserRole)) {
      return NextResponse.json(
        { error: "Nur SUPERADMIN kann die SUPERADMIN-Rolle vergeben." },
        { status: 403 }
      )
    }

    // 5. Verify target tenant exists and is active
    const adminClient = createAdminClient()

    const { data: tenant, error: tenantError } = await adminClient
      .from("tenants")
      .select("id, status")
      .eq("id", tenant_id)
      .single()

    if (tenantError || !tenant) {
      return NextResponse.json(
        { error: "Mandant nicht gefunden" },
        { status: 404 }
      )
    }

    if (tenant.status !== "active") {
      return NextResponse.json(
        { error: "Mandant ist deaktiviert. Einladung nicht moeglich." },
        { status: 400 }
      )
    }

    // 6. Invite the user via Supabase Auth (service role)
    const { data: inviteData, error: inviteError } =
      await adminClient.auth.admin.inviteUserByEmail(email, {
        data: {
          full_name: full_name || undefined,
        },
        redirectTo: `${process.env.NEXT_PUBLIC_SUPABASE_URL ? new URL(process.env.NEXT_PUBLIC_SUPABASE_URL).origin.replace(".supabase.co", "") : ""}/auth/reset-password`,
      })

    if (inviteError) {
      // If user already exists, we can still assign them to the tenant
      if (inviteError.message?.includes("already been registered")) {
        // Look up the existing user
        const { data: existingUsers } =
          await adminClient.auth.admin.listUsers()
        const existingUser = existingUsers?.users?.find(
          (u) => u.email === email
        )

        if (!existingUser) {
          return NextResponse.json(
            { error: "Benutzer existiert bereits, konnte aber nicht gefunden werden." },
            { status: 409 }
          )
        }

        // Check if membership already exists
        const { data: existingMem } = await adminClient
          .from("user_tenant_memberships")
          .select("id, is_active, role")
          .eq("user_id", existingUser.id)
          .eq("tenant_id", tenant_id)
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
            tenant_id,
            role,
          })

        if (membershipInsertError) {
          return NextResponse.json(
            { error: "Fehler beim Erstellen der Mandantenzugehörigkeit." },
            { status: 500 }
          )
        }

        return NextResponse.json({
          message:
            "Benutzer existiert bereits und wurde dem Mandanten zugewiesen.",
          user_id: existingUser.id,
        })
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

    // 7. Create tenant membership for the new user
    const { error: membershipError } = await adminClient
      .from("user_tenant_memberships")
      .insert({
        user_id: inviteData.user.id,
        tenant_id,
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

    // 8. Update profile with tenant_id
    await adminClient
      .from("profiles")
      .update({ tenant_id })
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
