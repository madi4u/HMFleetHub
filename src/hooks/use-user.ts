"use client"

import { useState, useEffect, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/lib/navigation"
import type { AuthMeResponse } from "@/types/database"

/**
 * The app-level user object combining Supabase auth data
 * with tenant membership (role).
 */
export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
}

/**
 * Hook to access the current authenticated user.
 * Fetches user data from the server-side /api/auth/me endpoint
 * so all auth/DB checks happen server-to-Supabase (reliable),
 * not browser-to-Supabase (can hang or be blocked).
 */
export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    // Fetch user from server-side API — avoids browser→Supabase connectivity issues
    fetch("/api/auth/me")
      .then((r) => {
        if (r.status === 401 || r.status === 403) return null
        if (!r.ok) return null
        return r.json() as Promise<AuthMeResponse>
      })
      .then((data) => {
        if (!data) {
          setUser(null)
        } else {
          setUser({
            id: data.id,
            email: data.email,
            name: data.full_name || data.email.split("@")[0] || "Benutzer",
            role: data.role as UserRole,
          })
        }
      })
      .catch(() => setUser(null))
      .finally(() => setIsLoading(false))

    // Listen only for logout events (sign-out in another tab)
    const supabase = createClient()
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((event) => {
      if (event === "SIGNED_OUT") {
        setUser(null)
        setIsLoading(false)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }, [])

  return { user, isLoading, logout }
}
