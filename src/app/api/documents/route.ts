import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createAdminClient } from "@/lib/supabase/admin"

export async function GET(request: NextRequest) {
  const auth = await requirePermissionGuard("vehicles.list")
  if (auth instanceof NextResponse) return auth

  const url = new URL(request.url)
  const search = url.searchParams.get("search")?.trim() ?? ""
  const typeFilter = url.searchParams.get("type") ?? ""

  const adminClient = createAdminClient()

  let query = adminClient
    .from("vehicle_documents")
    .select(
      "id, vehicle_id, document_type, file_name, file_size, file_path, mime_type, attachment_type, description, created_at, tenant_id, vehicles!inner(id, license_plate, make, model, tenant_id)"
    )
    .eq("vehicles.tenant_id", auth.tenantId)
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false })
    .limit(200)

  if (typeFilter) {
    query = query.eq("document_type", typeFilter)
  }

  if (search) {
    query = query.or(
      `file_name.ilike.%${search}%,document_type.ilike.%${search}%`
    )
  }

  const { data: docs, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Generate signed URLs for all documents
  const enriched = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed } = await adminClient.storage
        .from("vehicle-media")
        .createSignedUrl(doc.file_path, 3600)
      return {
        id: doc.id,
        vehicle_id: doc.vehicle_id,
        document_type: doc.document_type,
        file_name: doc.file_name,
        file_size: doc.file_size,
        mime_type: doc.mime_type,
        created_at: doc.created_at,
        signed_url: signed?.signedUrl ?? null,
        vehicles: doc.vehicles,
      }
    })
  )

  return NextResponse.json({
    documents: enriched,
    total: enriched.length,
  })
}
