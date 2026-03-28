"use client"

import { createContext, useContext, useCallback } from "react"
import { createClient } from "@/lib/supabase/client"
import type { UserRole } from "@/lib/navigation"

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
}

const UserContext = createContext<AppUser | null>(null)

export function UserProvider({
  user,
  children,
}: {
  user: AppUser
  children: React.ReactNode
}) {
  return <UserContext.Provider value={user}>{children}</UserContext.Provider>
}

export function useUserContext(): AppUser | null {
  return useContext(UserContext)
}

export function useLogout() {
  return useCallback(async () => {
    const supabase = createClient()
    await supabase.auth.signOut()
    window.location.href = "/login"
  }, [])
}
