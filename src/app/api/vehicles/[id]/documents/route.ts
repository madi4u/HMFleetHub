import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { uploadFile, getSignedUrl, isFilesServiceId } from "@/lib/files-service"

const VALID_DOCUMENT_TYPES = [
  "REGISTRATION_CERTIFICATE",
  "INSURANCE",
  "LEASE_CONTRACT",
  "FINANCING_CONTRACT",
  "INVOICE",
  "INSPECTION_REPORT",
  "OTHER",
] as const

const MAX_IMAGE_SIZE = 50 * 1024 * 1024
const MAX_VIDEO_SIZE = 500 * 1024 * 1024
const MAX_DOC_SIZE = 50 * 1024 * 1024

function getAttachmentType(
  mimeType: string
): "IMAGE" | "VIDEO" | "DOCUMENT" | null {
  if (mimeType.startsWith("image/")) return "IMAGE"
  if (mimeType.startsWith("video/")) return "VIDEO"
  if (
    mimeType === "application/pdf" ||
    mimeType.includes("document") ||
    mimeType.includes("msword") ||
    mimeType.includes("spreadsheet") ||
    mimeType.includes("presentation") ||
    mimeType === "text/plain"
  )
    return "DOCUMENT"
  return null
}

function sanitizeFilename(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9._\-]/g, "_")
    .replace(/\s+/g, "-")
    .slice(0, 200)
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.list")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const url = new URL(request.url)
  const category = url.searchParams.get("category") ?? null

  const supabase = await createClient()

  // Verify vehicle belongs to tenant
  const { data: vehicle } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (!vehicle) {
    return NextResponse.json(
      { error: "Fahrzeug nicht gefunden" },
      { status: 404 }
    )
  }

  let query = supabase
    .from("vehicle_documents")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .order("created_at", { ascending: false })

  if (category) {
    query = query.eq("document_type", category)
  }

  const { data: docs, error } = await query

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Generate signed URLs via Files Service
  const enriched = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const signedUrl = isFilesServiceId(doc.file_path)
        ? await getSignedUrl(doc.file_path, auth.tenantId, auth.userId)
        : null
      return { ...doc, signed_url: signedUrl }
    })
  )

  return NextResponse.json(enriched)
}

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
    return NextResponse.json(
      { error: "Fahrzeug nicht gefunden" },
      { status: 404 }
    )
  }

  const formData = await request.formData()
  const file = formData.get("file") as File | null
  const documentType = (formData.get("document_type") as string) ?? "OTHER"
  const description = (formData.get("description") as string) ?? null

  if (!file) {
    return NextResponse.json(
      { error: "Keine Datei übermittelt" },
      { status: 400 }
    )
  }

  if (
    !VALID_DOCUMENT_TYPES.includes(
      documentType as (typeof VALID_DOCUMENT_TYPES)[number]
    )
  ) {
    return NextResponse.json(
      { error: "Ungültiger Dokumenttyp" },
      { status: 400 }
    )
  }

  const attachmentType = getAttachmentType(file.type)
  if (!attachmentType) {
    return NextResponse.json(
      { error: "Nicht unterstützter Dateityp" },
      { status: 400 }
    )
  }

  const maxSize =
    attachmentType === "VIDEO"
      ? MAX_VIDEO_SIZE
      : attachmentType === "IMAGE"
        ? MAX_IMAGE_SIZE
        : MAX_DOC_SIZE
  if (file.size > maxSize) {
    const maxMB = maxSize / (1024 * 1024)
    return NextResponse.json(
      { error: `Datei zu groß (max. ${maxMB} MB)` },
      { status: 400 }
    )
  }

  const arrayBuffer = await file.arrayBuffer()
  const fileId = await uploadFile({
    body: arrayBuffer, fileName: sanitizeFilename(file.name), mimeType: file.type,
    orgId: auth.tenantId, userId: auth.userId,
    sourceEntity: "vehicle", sourceEntityId: vehicleId,
  })

  const { data: doc, error: dbError } = await supabase
    .from("vehicle_documents")
    .insert({
      tenant_id: auth.tenantId, vehicle_id: vehicleId,
      file_path: fileId, file_name: file.name,
      mime_type: file.type, file_size: file.size,
      document_type: documentType, attachment_type: attachmentType,
      description: description || null,
    })
    .select().single()

  if (dbError) return NextResponse.json({ error: dbError.message }, { status: 500 })

  const signedUrl = await getSignedUrl(fileId, auth.tenantId, auth.userId)
  return NextResponse.json({ ...doc, signed_url: signedUrl }, { status: 201 })
}
