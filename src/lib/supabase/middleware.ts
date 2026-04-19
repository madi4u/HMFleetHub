import { NextResponse, type NextRequest } from "next/server"

// Stub — replaced by src/middleware.ts hundm-auth integration
export async function updateSession(request: NextRequest) {
  return NextResponse.next({ request })
}
