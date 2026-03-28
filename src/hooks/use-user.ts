"use client"

import { useState, useEffect, useCallback } from "react"
import type { User } from "@supabase/supabase-js"
import type { UserRole } from "@/lib/navigation"
import { createClient } from "@/lib/supabase/client"

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
 * Reads the session from Supabase and fetches the user's role
 * from user_tenant_memberships.
 */
export function useUser() {
  const [user, setUser] = useState<AppUser | null>(null)
  const [isLoading, setIsLoading] = useState(true)

  useEffect(() => {
    const supabase = createClient()

    async function loadUser() {
      try {
        const {
          data: { user: authUser },
        } = await supabase.auth.getUser()

        if (!authUser) {
          setUser(null)
          setIsLoading(false)
          return
        }

        // Fetch role from user_tenant_memberships
        const appUser = await resolveAppUser(authUser)
        setUser(appUser)
      } catch {
        setUser(null)
      } finally {
        setIsLoading(false)
      }
    }

    loadUser()

    // Listen for auth state changes (e.g., logout in another tab)
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange(async (event, session) => {
      if (event === "SIGNED_OUT" || !session?.user) {
        setUser(null)
        return
      }

      if (event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        const appUser = await resolveAppUser(session.user)
        setUser(appUser)
      }
    })

    return () => {
      subscription.unsubscribe()
    }
  }, [])

  const logout = useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    // Full page reload to clear all client state and trigger middleware
    window.location.href = "/login"
  }, [])

  return { user, isLoading, logout }
}

/**
 * Resolves a Supabase auth user into an AppUser by fetching
 * their tenant membership and role.
 */
async function resolveAppUser(authUser: User): Promise<AppUser | null> {
  const supabase = createClient()

  // Try to get role from user_tenant_memberships
  const { data: membership } = await supabase
    .from("user_tenant_memberships")
    .select("role, is_active")
    .eq("user_id", authUser.id)
    .limit(1)
    .single()

  // If no membership found or user is deactivated, return null
  if (!membership || !membership.is_active) {
    return null
  }

  // Get display name from profiles table or fall back to email
  const { data: profile } = await supabase
    .from("profiles")
    .select("full_name")
    .eq("id", authUser.id)
    .single()

  return {
    id: authUser.id,
    name: profile?.full_name || authUser.email?.split("@")[0] || "Benutzer",
    email: authUser.email || "",
    role: membership.role as UserRole,
  }
}
