import { headers } from "next/headers"

export interface HundmSession {
  userId: string
  email: string
  name: string
  isSuperadmin: boolean
  activeOrgId: string
  activeOrgName: string
  appRole: string
}

export async function getSessionFromHeaders(): Promise<HundmSession | null> {
  const hdrs = await headers()
  const userId = hdrs.get("X-User-Id")
  if (!userId) return null

  return {
    userId,
    email: hdrs.get("X-User-Email") ?? "",
    name: hdrs.get("X-User-Name") ?? "",
    isSuperadmin: hdrs.get("X-Is-Superadmin") === "true",
    activeOrgId: hdrs.get("X-Org-Id") ?? "",
    activeOrgName: hdrs.get("X-Org-Name") ?? "",
    appRole: hdrs.get("X-App-Role") ?? "VIEWER",
  }
}
