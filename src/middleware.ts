import { NextResponse, type NextRequest } from "next/server"

const AUTH_SERVICE = process.env.AUTH_SERVICE_URL ?? "https://auth.hundm.cloud"
const APP_ID = "fleethub"

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  if (
    pathname.startsWith("/_next") ||
    pathname.startsWith("/api/auth") ||
    pathname.match(/\.(svg|png|jpg|jpeg|gif|webp|ico|css|js)$/)
  ) {
    return NextResponse.next()
  }

  const cookieHeader = request.headers.get("cookie") ?? ""
  const sessionCookie = cookieHeader
    .split(";")
    .find((c) => c.trim().startsWith("hundm_session="))

  if (!sessionCookie) {
    return NextResponse.redirect(`${AUTH_SERVICE}/login?redirect=${encodeURIComponent(request.url)}`)
  }

  try {
    const sessionRes = await fetch(`${AUTH_SERVICE}/api/session`, {
      headers: { cookie: cookieHeader },
      cache: "no-store",
    })

    if (!sessionRes.ok) {
      return NextResponse.redirect(`${AUTH_SERVICE}/login?redirect=${encodeURIComponent(request.url)}`)
    }

    const session = await sessionRes.json()
    if (!session?.userId) {
      return NextResponse.redirect(`${AUTH_SERVICE}/login?redirect=${encodeURIComponent(request.url)}`)
    }

    const accessRes = await fetch(`${AUTH_SERVICE}/api/access/check`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userId: session.userId, orgId: session.activeOrgId, appId: APP_ID }),
      cache: "no-store",
    })

    if (!accessRes.ok) {
      return NextResponse.redirect(`${AUTH_SERVICE}/select-org`)
    }

    const { allowed, role } = await accessRes.json()
    if (!allowed) {
      return NextResponse.redirect(`${AUTH_SERVICE}/select-org`)
    }

    const requestHeaders = new Headers(request.headers)
    requestHeaders.set("X-User-Id", session.userId)
    requestHeaders.set("X-User-Email", session.email ?? "")
    requestHeaders.set("X-User-Name", session.name ?? "")
    requestHeaders.set("X-Org-Id", session.activeOrgId ?? "")
    requestHeaders.set("X-Org-Name", session.activeOrgName ?? "")
    requestHeaders.set("X-App-Role", role ?? "VIEWER")
    requestHeaders.set("X-Is-Superadmin", session.isSuperadmin ? "true" : "false")

    return NextResponse.next({ request: { headers: requestHeaders } })
  } catch {
    return NextResponse.redirect(`${AUTH_SERVICE}/login?redirect=${encodeURIComponent(request.url)}`)
  }
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
}
