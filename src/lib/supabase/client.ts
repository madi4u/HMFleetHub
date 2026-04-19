const AUTH_URL = process.env.NEXT_PUBLIC_AUTH_SERVICE_URL ?? "https://auth.hundm.cloud"

export function createClient() {
  return {
    auth: {
      async getUser() {
        try {
          const res = await fetch(`${AUTH_URL}/api/session`, { credentials: "include" })
          if (!res.ok) return { data: { user: null }, error: null }
          const session = await res.json()
          if (!session?.userId) return { data: { user: null }, error: null }
          return {
            data: {
              user: {
                id: session.userId,
                email: session.email,
                user_metadata: { full_name: session.name },
              },
            },
            error: null,
          }
        } catch {
          return { data: { user: null }, error: null }
        }
      },
      async signOut() {
        await fetch(`${AUTH_URL}/api/auth/logout`, { method: "POST", credentials: "include" })
        window.location.href = `${AUTH_URL}/login`
      },
    },
    from(_table: string) {
      return {
        select: () => ({ data: [], error: null }),
        insert: () => ({ data: null, error: null }),
        update: () => ({ data: null, error: null }),
        delete: () => ({ data: null, error: null }),
      }
    },
  }
}
