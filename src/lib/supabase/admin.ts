import { db } from "@/lib/db"

export function createAdminClient() {
  return {
    from(table: string) {
      return db.from(table)
    },
    auth: {
      admin: {
        async inviteUserByEmail(_email: string) {
          return { data: null, error: new Error("Use auth.hundm.cloud for user management") }
        },
        async deleteUser(_id: string) {
          return { data: null, error: null }
        },
      },
    },
  }
}
