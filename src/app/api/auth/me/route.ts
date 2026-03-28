import { NextResponse } from "next/server"
import { createClient } from "@/lib/supabase/server"
import type { AuthMeResponse } from "@/types/database"

/**
 * GET /api/auth/me
 *
 * Returns the current authenticated user's profile, role, and tenant info.
 * Used by the useUser hook on the client side.
 *
 * Response: AuthMeResponse | { error: string }
 */
export async function GET() {
  try {
    const supabase = await createClient()

    // 1. Verify authentication
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

    // 2. Fetch membership with tenant info using a join (no N+1)
    // .limit(1) is a temporary simplification -- full multi-tenant
    // selection will be implemented in PROJ-3.
    const { data: membership, error: membershipError } = await supabase
      .from("user_tenant_memberships")
      .select(
        `
        id,
        user_id,
        tenant_id,
        role,
        is_active,
        tenants (
          id,
          name,
          slug,
          status
        )
      `
      )
      .eq("user_id", authUser.id)
      .eq("is_active", true)
      .limit(1)
      .single()

    if (membershipError || !membership) {
      return NextResponse.json(
        {
          error:
            "Keine aktive Mandantenzugehörigkeit gefunden. Wenden Sie sich an Ihren Administrator.",
        },
        { status: 403 }
      )
    }

    // 3. Check if the tenant is active
    const tenant = membership.tenants as unknown as {
      id: string
      name: string
      slug: string
      status: string
    }

    if (!tenant || tenant.status !== "active") {
      return NextResponse.json(
        {
          error:
            "Ihr Mandant ist deaktiviert. Wenden Sie sich an Ihren Administrator.",
        },
        { status: 403 }
      )
    }

    // 4. Fetch profile
    const { data: profile } = await supabase
      .from("profiles")
      .select("full_name, avatar_url")
      .eq("id", authUser.id)
      .single()

    // 5. Build response
    const response: AuthMeResponse = {
      id: authUser.id,
      email: authUser.email || "",
      full_name: profile?.full_name || null,
      avatar_url: profile?.avatar_url || null,
      role: membership.role as AuthMeResponse["role"],
      tenant_id: membership.tenant_id,
      tenant_name: tenant.name,
      tenant_slug: tenant.slug,
      is_active: membership.is_active,
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
