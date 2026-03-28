import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const MAX_DOC_SIZE = 50 * 1024 * 1024 // 50 MB
const ALLOWED_MIME_TYPES = new Set([
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  "text/plain",
])

function isAllowedMimeType(mimeType: string): boolean {
  if (ALLOWED_MIME_TYPES.has(mimeType)) return true
  // Also allow any vnd.openxmlformats or msword variant
  if (
    mimeType.includes("vnd.openxmlformats") ||
    mimeType.includes("msword")
  )
    return true
  return false
}

export async function POST(
  request: NextRequest,
  {
    params,
  }: { params: Promise<{ id: string; contractId: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.contracts.edit")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId, contractId } = await params
  const supabase = await createClient()

  // Verify contract exists in this tenant/vehicle
  const { data: contract, error: contractError } = await supabase
    .from("contracts")
    .select("id")
    .eq("id", contractId)
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .single()

  if (contractError || !contract) {
    return NextResponse.json(
      { error: "Vertrag nicht gefunden" },
      { status: 404 }
    )
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null

  if (!file) {
    return NextResponse.json(
      { error: "Keine Datei uebermittelt" },
      { status: 400 }
    )
  }

  if (!isAllowedMimeType(file.type)) {
    return NextResponse.json(
      {
        error:
          "Nicht unterstuetzter Dateityp. Erlaubt: PDF, Word, Excel, PowerPoint, Text",
      },
      { status: 400 }
    )
  }

  if (file.size > MAX_DOC_SIZE) {
    return NextResponse.json(
      { error: "Datei zu gross (maximal 50 MB)" },
      { status: 400 }
    )
  }

  const ext = file.name.split(".").pop() ?? "bin"
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const filePath = `tenant/${auth.tenantId}/contracts/${contractId}/${fileName}`

  const adminClient = createAdminClient()
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from("vehicle-media")
    .upload(filePath, arrayBuffer, {
      contentType: file.type,
      upsert: false,
    })

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    )
  }

  const { data: document, error: dbError } = await adminClient
    .from("contract_documents")
    .insert({
      tenant_id: auth.tenantId,
      contract_id: contractId,
      file_path: filePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
    })
    .select()
    .single()

  if (dbError) {
    // Cleanup orphaned storage file
    await adminClient.storage.from("vehicle-media").remove([filePath])
    return NextResponse.json(
      { error: dbError.message },
      { status: 500 }
    )
  }

  // Return with signed URL
  const { data: signed } = await adminClient.storage
    .from("vehicle-media")
    .createSignedUrl(filePath, 3600)

  return NextResponse.json(
    { ...document, signed_url: signed?.signedUrl ?? null },
    { status: 201 }
  )
}
