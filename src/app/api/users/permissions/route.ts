import { NextResponse } from "next/server"
import { requireAuthenticated } from "@/lib/auth-guard"
import { ROLE_PERMISSIONS } from "@/lib/permissions.config"

/**
 * GET /api/users/permissions
 *
 * Returns the current user's role and permissions.
 * Any authenticated user can call this endpoint (no special permission required).
 * Used by the frontend to adapt the UI based on the user's role.
 */
export async function GET() {
  try {
    const guard = await requireAuthenticated()
    if (guard instanceof NextResponse) return guard

    const { role } = guard
    const permissions = Array.from(ROLE_PERMISSIONS[role] ?? [])

    return NextResponse.json({ role, permissions })
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
