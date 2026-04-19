import { NextResponse } from "next/server"
import { getSessionFromHeaders } from "@/lib/session"
import type { AuthMeResponse } from "@/types/database"

export async function GET() {
  try {
    const session = await getSessionFromHeaders()

    if (!session) {
      return NextResponse.json({ error: "Nicht authentifiziert" }, { status: 401 })
    }

    const response: AuthMeResponse = {
      id: session.userId,
      email: session.email,
      full_name: session.name || null,
      avatar_url: null,
      role: session.appRole as AuthMeResponse["role"],
      tenant_id: session.activeOrgId,
      tenant_name: session.activeOrgName,
      tenant_slug: session.activeOrgId,
      is_active: true,
    }

    return NextResponse.json(response)
  } catch {
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 })
  }
}
