"use client"

import { useUserContext } from "@/components/user-provider"
import type { UserRole } from "@/lib/navigation"

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
 * Reads from UserContext set by the server-side dashboard layout —
 * no network calls, no loading state, no redirect loops.
 */
export function useUser() {
  const user = useUserContext() as AppUser | null
  return { user, isLoading: false }
}
