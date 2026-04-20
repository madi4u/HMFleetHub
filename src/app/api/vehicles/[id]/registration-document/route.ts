import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { uploadFile, getSignedUrl, deleteFile, isFilesServiceId } from "@/lib/files-service"
import type { VehicleDocument } from "@/types/database"

const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

const MAX_FILE_SIZE = 50 * 1024 * 1024

function getMimeAttachmentType(mime: string): "IMAGE" | "DOCUMENT" {
  if (mime.startsWith("image/")) return "IMAGE"
  return "DOCUMENT"
}

function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200)
}

// ---------------------------------------------------------------------------
// GET /api/vehicles/[id]/registration-document
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.registration_document.view")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const supabase = await createClient()

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (!vehicle) {
    return NextResponse.json({ error: "Fahrzeug nicht gefunden" }, { status: 404 })
  }

  const { data: docs, error } = await supabase
    .from("vehicle_documents")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .eq("document_type", "REGISTRATION_CERTIFICATE")
    .order("created_at", { ascending: false })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const enriched: VehicleDocument[] = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const signedUrl = isFilesServiceId(doc.file_path)
        ? await getSignedUrl(doc.file_path, auth.tenantId, auth.userId)
        : null
      return { ...doc, signed_url: signedUrl }
    })
  )

  const current = enriched.find((d) => d.is_current === true) ?? null
  const archive = enriched.filter((d) => d.is_current !== true)

  return NextResponse.json({ current, archive })
}

// ---------------------------------------------------------------------------
// POST /api/vehicles/[id]/registration-document
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.media.upload")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const supabase = await createClient()

  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (!vehicle) {
    return NextResponse.json({ error: "Fahrzeug nicht gefunden" }, { status: 404 })
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: "Ungültige FormData" }, { status: 400 })
  }

  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json({ error: "Keine Datei übermittelt" }, { status: 400 })
  }

  if (!ALLOWED_MIME_TYPES.includes(file.type as (typeof ALLOWED_MIME_TYPES)[number])) {
    return NextResponse.json(
      { error: "Nur PDF, JPEG, PNG und WEBP sind erlaubt für Fahrzeugscheine." },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json({ error: "Datei zu groß (max. 50 MB)" }, { status: 400 })
  }

  // Upload via Files Service
  const arrayBuffer = await file.arrayBuffer()
  let fileId: string
  try {
    fileId = await uploadFile({
      body: arrayBuffer,
      fileName: sanitizeFilename(file.name),
      mimeType: file.type,
      orgId: auth.tenantId,
      userId: auth.userId,
      sourceEntity: "vehicle",
      sourceEntityId: vehicleId,
    })
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Upload fehlgeschlagen" },
      { status: 500 }
    )
  }

  const adminClient = createAdminClient()

  // Mark existing current registration as not current
  const { error: updateError } = await adminClient
    .from("vehicle_documents")
    .update({ is_current: false })
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .eq("document_type", "REGISTRATION_CERTIFICATE")
    .eq("is_current", true)

  if (updateError) {
    await deleteFile(fileId, auth.tenantId, auth.userId)
    return NextResponse.json({ error: updateError.message }, { status: 500 })
  }

  // Insert new document row
  const { data: doc, error: insertError } = await adminClient
    .from("vehicle_documents")
    .insert({
      tenant_id: auth.tenantId,
      vehicle_id: vehicleId,
      file_path: fileId,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      document_type: "REGISTRATION_CERTIFICATE",
      attachment_type: getMimeAttachmentType(file.type),
      description: null,
      is_current: true,
    })
    .select()
    .single()

  if (insertError) {
    await deleteFile(fileId, auth.tenantId, auth.userId)
    return NextResponse.json({ error: insertError.message }, { status: 500 })
  }

  const signedUrl = await getSignedUrl(fileId, auth.tenantId, auth.userId)
  return NextResponse.json({ ...doc, signed_url: signedUrl }, { status: 201 })
}
