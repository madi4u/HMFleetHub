import { NextResponse } from "next/server"
import { getSessionFromHeaders } from "@/lib/session"
import { db } from "@/lib/db"
import type { UserRole } from "@/types/database"
import { hasPermission, type Permission } from "@/lib/permissions.config"

export interface AuthGuardResult {
  userId: string
  memberships: {
    role: UserRole
    tenant_id: string
    is_active: boolean
  }[]
  isSuperadmin: boolean
}

export interface TenantAuthResult extends AuthGuardResult {
  tenantId: string
  role: UserRole
}

async function resolveTenantId(userId: string): Promise<{ tenantId: string; role: UserRole } | null> {
  const result = await db
    .from("user_tenant_memberships")
    .select("tenant_id, role")
    .eq("user_id", userId)
    .eq("is_active", true)
    .limit(1)
    .single()

  if (!result.data) return null
  const row = result.data as { tenant_id: string; role: UserRole }
  return { tenantId: row.tenant_id, role: row.role }
}

export async function requireAuthenticated(): Promise<NextResponse | TenantAuthResult> {
  const session = await getSessionFromHeaders()
  if (!session) {
    return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 })
  }

  const resolved = await resolveTenantId(session.userId)
  const tenantId = resolved?.tenantId ?? session.activeOrgId
  const role = (resolved?.role ?? session.appRole) as UserRole

  return {
    userId: session.userId,
    memberships: [{ role, tenant_id: tenantId, is_active: true }],
    isSuperadmin: session.isSuperadmin,
    tenantId,
    role,
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
  const resolved = await resolveTenantId(session.userId)
  const tenantId = resolved?.tenantId ?? session.activeOrgId
  const role = (resolved?.role ?? session.appRole) as UserRole
  return {
    userId: session.userId,
    memberships: [{ role, tenant_id: tenantId, is_active: true }],
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
  const resolved = await resolveTenantId(session.userId)
  const tenantId = resolved?.tenantId ?? session.activeOrgId
  const role = (resolved?.role ?? session.appRole) as UserRole
  return {
    userId: session.userId,
    memberships: [{ role, tenant_id: tenantId, is_active: true }],
    isSuperadmin: session.isSuperadmin,
  }
}
