import { NextResponse } from "next/server"
import { db } from "@/lib/db"
import { requirePermissionGuard } from "@/lib/auth-guard"

export async function GET() {
  try {
    const guard = await requirePermissionGuard("users.manage")
    if (guard instanceof NextResponse) return guard

    const { tenantId } = guard

    const result = await db.query(
      `SELECT
         utm.id          AS membership_id,
         utm.user_id,
         utm.role,
         utm.is_active,
         utm.created_at,
         iu.email,
         iu.name         AS full_name
       FROM fleethub.user_tenant_memberships utm
       LEFT JOIN identity.users iu ON iu.id = utm.user_id
       WHERE utm.tenant_id = $1
       ORDER BY utm.created_at ASC
       LIMIT 500`,
      [tenantId]
    )

    const users = result.rows.map((m: Record<string, unknown>) => ({
      membership_id: m.membership_id,
      user_id: m.user_id,
      email: m.email ?? "",
      full_name: m.full_name ?? null,
      avatar_url: null,
      role: m.role,
      is_active: m.is_active,
      last_sign_in_at: null,
      created_at: m.created_at,
    }))

    return NextResponse.json({ users })
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
