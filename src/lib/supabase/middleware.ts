import { createServerClient } from "@supabase/ssr"
import { NextResponse, type NextRequest } from "next/server"

/**
 * Updates the Supabase session by refreshing the token in middleware.
 * Returns the response with updated cookies.
 */
export async function updateSession(request: NextRequest) {
  let supabaseResponse = NextResponse.next({
    request,
  })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          supabaseResponse = NextResponse.next({
            request,
          })
          cookiesToSet.forEach(({ name, value, options }) =>
            supabaseResponse.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANT: Do not write any logic between createServerClient and
  // supabase.auth.getUser(). A simple mistake could make it very hard to
  // debug issues with users being randomly logged out.
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { pathname } = request.nextUrl

  // Public routes that do not require authentication
  const isPublicRoute =
    pathname === "/login" ||
    pathname.startsWith("/auth/")

  // If not authenticated and trying to access a protected route, redirect to login
  if (!user && !isPublicRoute) {
    const url = request.nextUrl.clone()
    url.pathname = "/login"
    return NextResponse.redirect(url)
  }

  // Helper: look up the user's role (cached within this request)
  let resolvedRole: string | null = null
  async function getUserRole(): Promise<string | null> {
    if (resolvedRole !== null) return resolvedRole
    const { data: membership } = await supabase
      .from("user_tenant_memberships")
      .select("role")
      .eq("user_id", user!.id)
      .eq("is_active", true)
      .limit(1)
      .single()
    resolvedRole = membership?.role ?? null
    return resolvedRole
  }

  // If authenticated and trying to access login page, redirect based on role
  if (user && pathname === "/login") {
    const role = await getUserRole()
    const url = request.nextUrl.clone()
    url.pathname = role === "WORKSHOP_MECHANIC" ? "/workshop" : "/dashboard"
    return NextResponse.redirect(url)
  }

  // Block WORKSHOP_MECHANIC from accessing fleet, admin, and dashboard routes
  if (
    user &&
    (pathname.startsWith("/fleet") ||
      pathname.startsWith("/admin") ||
      pathname.startsWith("/dashboard"))
  ) {
    const role = await getUserRole()
    if (role === "WORKSHOP_MECHANIC") {
      const url = request.nextUrl.clone()
      url.pathname = "/workshop"
      return NextResponse.redirect(url)
    }
  }

  return supabaseResponse
}
