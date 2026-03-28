import { NextResponse } from "next/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionGuard } from "@/lib/auth-guard"
import type { UserWithMembership } from "@/types/database"

/**
 * GET /api/users
 *
 * Returns all users (active + inactive) of the current tenant.
 * Requires: users.manage permission (SUPERADMIN, TENANT_ADMIN).
 *
 * Joins user_tenant_memberships + profiles.
 * Enriches with last_sign_in_at from auth.users via the admin API.
 */
export async function GET() {
  try {
    // 1. Auth + permission check
    const guard = await requirePermissionGuard("users.manage")
    if (guard instanceof NextResponse) return guard

    const { tenantId } = guard
    const adminClient = createAdminClient()

    // 2. Fetch memberships with joined profiles for this tenant
    const { data: memberships, error: membershipError } = await adminClient
      .from("user_tenant_memberships")
      .select(
        `
        id,
        user_id,
        role,
        is_active,
        created_at,
        profiles (
          full_name,
          avatar_url
        )
      `
      )
      .eq("tenant_id", tenantId)
      .order("created_at", { ascending: true })
      .limit(500)

    if (membershipError) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Benutzer." },
        { status: 500 }
      )
    }

    if (!memberships || memberships.length === 0) {
      return NextResponse.json({ users: [] })
    }

    // 3. Fetch auth.users metadata (email, last_sign_in_at) via admin API
    //    We collect all user_ids and fetch them in bulk.
    const userIds = memberships.map((m) => m.user_id)

    // Supabase admin listUsers returns paginated results.
    // For tenant-scoped lists this is manageable.
    const { data: authUsersData, error: authError } =
      await adminClient.auth.admin.listUsers({ perPage: 1000 })

    if (authError) {
      return NextResponse.json(
        { error: "Fehler beim Laden der Auth-Daten." },
        { status: 500 }
      )
    }

    // Build a lookup map: userId -> auth user info
    const authLookup = new Map<
      string,
      { email: string; last_sign_in_at: string | null }
    >()
    for (const u of authUsersData?.users ?? []) {
      if (userIds.includes(u.id)) {
        authLookup.set(u.id, {
          email: u.email ?? "",
          last_sign_in_at: u.last_sign_in_at ?? null,
        })
      }
    }

    // 4. Merge into response
    const users: UserWithMembership[] = memberships.map((m) => {
      const authInfo = authLookup.get(m.user_id)
      const profile = m.profiles as unknown as {
        full_name: string | null
        avatar_url: string | null
      } | null

      return {
        membership_id: m.id,
        user_id: m.user_id,
        email: authInfo?.email ?? "",
        full_name: profile?.full_name ?? null,
        avatar_url: profile?.avatar_url ?? null,
        role: m.role,
        is_active: m.is_active,
        last_sign_in_at: authInfo?.last_sign_in_at ?? null,
        created_at: m.created_at,
      }
    })

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
