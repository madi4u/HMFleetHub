import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { UserRole } from "@/types/database"
import { hasPermission, type Permission } from "@/lib/permissions.config"

/**
 * Result of a successful auth guard check.
 */
export interface AuthGuardResult {
  userId: string
  memberships: {
    role: UserRole
    tenant_id: string
    is_active: boolean
  }[]
  isSuperadmin: boolean
}

/**
 * Result of a tenant-scoped auth guard.
 * Includes the resolved tenant_id and role for the current tenant context.
 */
export interface TenantAuthResult extends AuthGuardResult {
  tenantId: string
  role: UserRole
}

/**
 * Verifies authentication and resolves the caller's first active membership.
 * Does NOT check any specific permission — use requirePermissionGuard for that.
 * Returns an error NextResponse if authentication or membership lookup fails.
 */
export async function requireAuthenticated(): Promise<
  NextResponse | TenantAuthResult
> {
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

  const adminClient = createAdminClient()
  const { data: memberships, error: membershipError } = await adminClient
    .from("user_tenant_memberships")
    .select("role, tenant_id, is_active")
    .eq("user_id", authUser.id)
    .eq("is_active", true)
    .limit(50)

  if (membershipError || !memberships || memberships.length === 0) {
    return NextResponse.json(
      { error: "Keine aktive Mandantenzugehoerigkeit gefunden." },
      { status: 403 }
    )
  }

  const isSuperadmin = memberships.some(
    (m) => m.role === "SUPERADMIN" && m.is_active
  )

  // Use the first active membership as the current tenant context.
  // Multi-tenant selection will refine this in the future.
  const primary = memberships[0]

  return {
    userId: authUser.id,
    memberships: memberships as AuthGuardResult["memberships"],
    isSuperadmin,
    tenantId: primary.tenant_id,
    role: primary.role as UserRole,
  }
}

/**
 * Verifies authentication, resolves tenant context, and checks a permission.
 * Returns an error NextResponse (401/403) on failure, or the TenantAuthResult on success.
 */
export async function requirePermissionGuard(
  permission: Permission
): Promise<NextResponse | TenantAuthResult> {
  const guard = await requireAuthenticated()
  if (guard instanceof NextResponse) return guard

  if (!hasPermission(guard.role, permission)) {
    return NextResponse.json(
      { error: `Fehlende Berechtigung: ${permission}` },
      { status: 403 }
    )
  }

  return guard
}

/**
 * Verifies authentication and checks that the caller has SUPERADMIN role.
 * Returns an error NextResponse if checks fail, or the AuthGuardResult on success.
 */
export async function requireSuperadmin(): Promise<
  NextResponse | AuthGuardResult
> {
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

  const adminClient = createAdminClient()
  const { data: memberships, error: membershipError } = await adminClient
    .from("user_tenant_memberships")
    .select("role, tenant_id, is_active")
    .eq("user_id", authUser.id)
    .eq("is_active", true)
    .limit(50)

  if (membershipError || !memberships || memberships.length === 0) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    )
  }

  const isSuperadmin = memberships.some(
    (m) => m.role === "SUPERADMIN" && m.is_active
  )

  if (!isSuperadmin) {
    return NextResponse.json(
      { error: "Nur SUPERADMIN hat Zugriff auf diesen Endpunkt." },
      { status: 403 }
    )
  }

  return {
    userId: authUser.id,
    memberships: memberships as AuthGuardResult["memberships"],
    isSuperadmin: true,
  }
}

/**
 * Verifies authentication and checks that the caller has SUPERADMIN
 * or TENANT_ADMIN role for the given tenant.
 */
export async function requireAdminForTenant(
  tenantId: string
): Promise<NextResponse | AuthGuardResult> {
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

  const adminClient = createAdminClient()
  const { data: memberships, error: membershipError } = await adminClient
    .from("user_tenant_memberships")
    .select("role, tenant_id, is_active")
    .eq("user_id", authUser.id)
    .eq("is_active", true)
    .limit(50)

  if (membershipError || !memberships || memberships.length === 0) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    )
  }

  const isSuperadmin = memberships.some(
    (m) => m.role === "SUPERADMIN" && m.is_active
  )
  const isTenantAdmin = memberships.some(
    (m) =>
      m.role === "TENANT_ADMIN" &&
      m.tenant_id === tenantId &&
      m.is_active
  )

  if (!isSuperadmin && !isTenantAdmin) {
    return NextResponse.json(
      {
        error:
          "Nur SUPERADMIN oder TENANT_ADMIN des Mandanten hat Zugriff.",
      },
      { status: 403 }
    )
  }

  return {
    userId: authUser.id,
    memberships: memberships as AuthGuardResult["memberships"],
    isSuperadmin,
  }
}
