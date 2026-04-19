import { NextResponse } from "next/server"
import { getSessionFromHeaders } from "@/lib/session"
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

export async function requireAuthenticated(): Promise<NextResponse | TenantAuthResult> {
  const session = await getSessionFromHeaders()
  if (!session) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 })
  }
  return {
    userId: session.userId,
    memberships: [{ role: session.appRole as UserRole, tenant_id: session.activeOrgId, is_active: true }],
    isSuperadmin: session.isSuperadmin,
    tenantId: session.activeOrgId,
    role: session.appRole as UserRole,
  }
}

export async function requirePermissionGuard(
  permission: Permission
): Promise<NextResponse | TenantAuthResult> {
  const guard = await requireAuthenticated()
  if (guard instanceof NextResponse) return guard
  if (!hasPermission(guard.role, permission)) {
    return NextResponse.json({ error: `Fehlende Berechtigung: ${permission}` }, { status: 403 })
  }
  return guard
}

export async function requireSuperadmin(): Promise<NextResponse | AuthGuardResult> {
  const session = await getSessionFromHeaders()
  if (!session) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 })
  }
  if (!session.isSuperadmin) {
    return NextResponse.json({ error: "Nur SUPERADMIN hat Zugriff auf diesen Endpunkt." }, { status: 403 })
  }
  return {
    userId: session.userId,
    memberships: [{ role: session.appRole as UserRole, tenant_id: session.activeOrgId, is_active: true }],
    isSuperadmin: true,
  }
}

export async function requireAdminForTenant(
  _tenantId: string
): Promise<NextResponse | AuthGuardResult> {
  const session = await getSessionFromHeaders()
  if (!session) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 })
  }
  const isTenantAdmin = session.appRole === "TENANT_ADMIN" || session.appRole === "FLEET_MANAGER"
  if (!session.isSuperadmin && !isTenantAdmin) {
    return NextResponse.json({ error: "Nur SUPERADMIN oder TENANT_ADMIN des Mandanten hat Zugriff." }, { status: 403 })
  }
  return {
    userId: session.userId,
    memberships: [{ role: session.appRole as UserRole, tenant_id: session.activeOrgId, is_active: true }],
    isSuperadmin: session.isSuperadmin,
  }
}
