"use client"

import { createContext, useContext, useCallback } from "react"
import type { UserRole } from "@/lib/navigation"

export interface AppUser {
  id: string
  name: string
  email: string
  role: UserRole
  tenantName?: string
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
    await fetch("https://auth.hundm.cloud/api/auth/logout", {
      method: "POST",
      credentials: "include",
    }).catch(() => {})
    window.location.href = "https://auth.hundm.cloud/login"
  }, [])
}
