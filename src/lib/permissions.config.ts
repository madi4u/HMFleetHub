import type { UserRole } from "@/types/database"

/**
 * Central permission configuration for FleetHub.
 * Single source of truth for all role-based access control.
 *
 * @see features/PROJ-4-user-role-management.md
 */

export type Permission =
  | "dashboard.view"
  | "dashboard.financials.view"
  | "vehicles.list"
  | "vehicles.create"
  | "vehicles.edit"
  | "vehicles.history.view"
  | "vehicles.history.create"
  | "vehicles.history.update"
  | "vehicles.history.delete"
  | "vehicles.contracts.view"
  | "vehicles.contracts.edit"
  | "vehicles.financials.view"
  | "vehicles.media.upload"
  | "vehicles.registration_document.view"
  | "users.manage"
  | "tenants.manage"

/**
 * All defined permissions. Useful for validation and iteration.
 */
export const ALL_PERMISSIONS: Permission[] = [
  "dashboard.view",
  "dashboard.financials.view",
  "vehicles.list",
  "vehicles.create",
  "vehicles.edit",
  "vehicles.history.view",
  "vehicles.history.create",
  "vehicles.history.update",
  "vehicles.history.delete",
  "vehicles.contracts.view",
  "vehicles.contracts.edit",
  "vehicles.financials.view",
  "vehicles.media.upload",
  "vehicles.registration_document.view",
  "users.manage",
  "tenants.manage",
]

/**
 * Role-to-permissions mapping.
 * SUPERADMIN receives all permissions.
 * Each subsequent role has a narrower subset.
 */
export const ROLE_PERMISSIONS: Record<UserRole, Set<Permission>> = {
  SUPERADMIN: new Set<Permission>(ALL_PERMISSIONS),

  TENANT_ADMIN: new Set<Permission>(
    ALL_PERMISSIONS.filter((p) => p !== "tenants.manage")
  ),

  FLEET_MANAGER: new Set<Permission>([
    "dashboard.view",
    "dashboard.financials.view",
    "vehicles.list",
    "vehicles.create",
    "vehicles.edit",
    "vehicles.history.view",
    "vehicles.history.create",
    "vehicles.history.update",
    "vehicles.history.delete",
    "vehicles.contracts.view",
    "vehicles.contracts.edit",
    "vehicles.financials.view",
    "vehicles.media.upload",
    "vehicles.registration_document.view",
  ]),

  OFFICE_USER: new Set<Permission>([
    "dashboard.view",
    "vehicles.list",
    "vehicles.create",
    "vehicles.edit",
    "vehicles.history.view",
    "vehicles.history.create",
    "vehicles.history.update",
    "vehicles.contracts.view",
    "vehicles.media.upload",
    "vehicles.registration_document.view",
  ]),

  WORKSHOP_MECHANIC: new Set<Permission>([
    "vehicles.list",
    "vehicles.history.view",
    "vehicles.history.create",
    "vehicles.history.update",
    "vehicles.media.upload",
    "vehicles.registration_document.view",
  ]),

  READ_ONLY: new Set<Permission>([
    "dashboard.view",
    "vehicles.list",
    "vehicles.history.view",
  ]),
}

/**
 * Check whether a role has a specific permission.
 */
export function hasPermission(role: UserRole, permission: Permission): boolean {
  return ROLE_PERMISSIONS[role]?.has(permission) ?? false
}

/**
 * Throws a structured error if the role lacks the given permission.
 * Intended for use in API routes — callers should catch and return 403.
 */
export function requirePermission(
  role: UserRole,
  permission: Permission
): void {
  if (!hasPermission(role, permission)) {
    const error = new Error(
      `Fehlende Berechtigung: ${permission}`
    ) as Error & { status: number }
    error.status = 403
    throw error
  }
}
