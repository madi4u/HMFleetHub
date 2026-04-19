import { getSessionFromHeaders } from "@/lib/session"
import { db } from "@/lib/db"

export async function createClient() {
  return {
    auth: {
      async getUser() {
        const session = await getSessionFromHeaders()
        if (!session) return { data: { user: null }, error: new Error("Not authenticated") }
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
      },
    },
    from(table: string) {
      return db.from(table)
    },
    storage: {
      from(_bucket: string) {
        return {
          getPublicUrl(path: string) {
            return { data: { publicUrl: `/storage/${path}` } }
          },
          upload: async () => ({ data: null, error: new Error("Storage not supported") }),
          remove: async () => ({ data: null, error: null }),
        }
      },
    },
  }
}
