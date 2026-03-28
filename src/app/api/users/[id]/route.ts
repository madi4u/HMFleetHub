import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionGuard } from "@/lib/auth-guard"

// ---------------------------------------------------------------------------
// Zod Schema
// ---------------------------------------------------------------------------

const patchSchema = z
  .object({
    role: z
      .enum(
        [
          "TENANT_ADMIN",
          "FLEET_MANAGER",
          "OFFICE_USER",
          "WORKSHOP_MECHANIC",
          "READ_ONLY",
        ] as const,
        { message: "Ungültige Rolle" }
      )
      .optional(),
    is_active: z.boolean().optional(),
  })
  .refine((data) => data.role !== undefined || data.is_active !== undefined, {
    message: "Mindestens ein Feld (role oder is_active) muss angegeben werden.",
  })

// ---------------------------------------------------------------------------
// Route params type
// ---------------------------------------------------------------------------

type RouteContext = { params: Promise<{ id: string }> }

// ---------------------------------------------------------------------------
// PATCH /api/users/[id]
// ---------------------------------------------------------------------------

/**
 * Updates a user's role and/or active status within the current tenant.
 * Requires: users.manage permission.
 *
 * Body: { role?: UserRole, is_active?: boolean }
 *
 * Guards:
 * - Cannot change own role or deactivate yourself
 * - Cannot assign SUPERADMIN via this endpoint
 * - Cannot remove the last TENANT_ADMIN of the tenant
 * - Target user must belong to the same tenant (tenant_id from session)
 */
export async function PATCH(request: NextRequest, context: RouteContext) {
  try {
    const { id: targetUserId } = await context.params

    // Validate UUID format
    if (!z.string().uuid().safeParse(targetUserId).success) {
      return NextResponse.json(
        { error: "Ungültige Benutzer-ID" },
        { status: 400 }
      )
    }

    // 1. Auth + permission check
    const guard = await requirePermissionGuard("users.manage")
    if (guard instanceof NextResponse) return guard

    const { userId: callerId, tenantId } = guard

    // 2. Cannot modify yourself
    if (targetUserId === callerId) {
      return NextResponse.json(
        {
          error:
            "Sie können Ihre eigene Rolle nicht ändern oder sich selbst deaktivieren.",
        },
        { status: 400 }
      )
    }

    // 3. Parse & validate body
    let body: unknown
    try {
      body = await request.json()
    } catch {
      return NextResponse.json(
        { error: "Ungültiger Request-Body" },
        { status: 400 }
      )
    }

    const parseResult = patchSchema.safeParse(body)
    if (!parseResult.success) {
      const errors = parseResult.error.issues.map((i) => i.message)
      return NextResponse.json(
        { error: "Validierungsfehler", details: errors },
        { status: 400 }
      )
    }

    const { role: newRole, is_active: newIsActive } = parseResult.data
    const adminClient = createAdminClient()

    // 4. Verify target membership exists in the same tenant
    const { data: targetMembership, error: targetError } = await adminClient
      .from("user_tenant_memberships")
      .select("id, user_id, role, is_active")
      .eq("user_id", targetUserId)
      .eq("tenant_id", tenantId)
      .single()

    if (targetError || !targetMembership) {
      return NextResponse.json(
        { error: "Benutzer nicht in diesem Mandanten gefunden." },
        { status: 404 }
      )
    }

    // 5. Cannot assign SUPERADMIN role via this endpoint
    if (newRole === ("SUPERADMIN" as string)) {
      return NextResponse.json(
        {
          error:
            "SUPERADMIN-Rolle kann über diesen Endpunkt nicht vergeben werden.",
        },
        { status: 403 }
      )
    }

    // 6. Cannot remove the last TENANT_ADMIN
    const isRemovingAdmin =
      targetMembership.role === "TENANT_ADMIN" &&
      ((newRole !== undefined && newRole !== "TENANT_ADMIN") ||
        newIsActive === false)

    if (isRemovingAdmin) {
      const { count, error: countError } = await adminClient
        .from("user_tenant_memberships")
        .select("id", { count: "exact", head: true })
        .eq("tenant_id", tenantId)
        .eq("role", "TENANT_ADMIN")
        .eq("is_active", true)

      if (countError) {
        return NextResponse.json(
          { error: "Fehler bei der Berechtigungsprüfung." },
          { status: 500 }
        )
      }

      if ((count ?? 0) <= 1) {
        return NextResponse.json(
          {
            error:
              "Mindestens ein TENANT_ADMIN muss im Mandanten verbleiben.",
          },
          { status: 400 }
        )
      }
    }

    // 7. Build update payload
    const updatePayload: Record<string, unknown> = {}
    if (newRole !== undefined) updatePayload.role = newRole
    if (newIsActive !== undefined) updatePayload.is_active = newIsActive

    const { error: updateError } = await adminClient
      .from("user_tenant_memberships")
      .update(updatePayload)
      .eq("id", targetMembership.id)

    if (updateError) {
      return NextResponse.json(
        { error: "Fehler beim Aktualisieren des Benutzers." },
        { status: 500 }
      )
    }

    return NextResponse.json({
      message: "Benutzer erfolgreich aktualisiert.",
      membership_id: targetMembership.id,
    })
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
