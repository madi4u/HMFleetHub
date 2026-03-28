import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

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

  // Generate signed URLs
  const adminClient = createAdminClient()
  const enriched = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed } = await adminClient.storage
        .from("vehicle-media")
        .createSignedUrl(doc.file_path, 3600)
      return { ...doc, signed_url: signed?.signedUrl ?? null }
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

  const sanitized = sanitizeFilename(file.name)
  const filePath = `tenant/${auth.tenantId}/vehicles/${vehicleId}/documents/${Date.now()}-${sanitized}`

  const adminClient = createAdminClient()
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from("vehicle-media")
    .upload(filePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json({ error: uploadError.message }, { status: 500 })
  }

  const { data: doc, error: dbError } = await supabase
    .from("vehicle_documents")
    .insert({
      tenant_id: auth.tenantId,
      vehicle_id: vehicleId,
      file_path: filePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      document_type: documentType,
      attachment_type: attachmentType,
      description: description || null,
    })
    .select()
    .single()

  if (dbError) {
    // Clean up storage on DB failure
    await adminClient.storage.from("vehicle-media").remove([filePath])
    return NextResponse.json({ error: dbError.message }, { status: 500 })
  }

  const { data: signed } = await adminClient.storage
    .from("vehicle-media")
    .createSignedUrl(filePath, 3600)

  return NextResponse.json(
    { ...doc, signed_url: signed?.signedUrl ?? null },
    { status: 201 }
  )
}
