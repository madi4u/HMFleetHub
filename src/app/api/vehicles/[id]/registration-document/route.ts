import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import type { VehicleDocument } from "@/types/database"

// Only PDF and images allowed for registration documents
const ALLOWED_MIME_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
  "image/webp",
] as const

const MAX_FILE_SIZE = 50 * 1024 * 1024 // 50 MB

/**
 * Derive attachment_type from MIME type.
 */
function getMimeAttachmentType(mime: string): "IMAGE" | "DOCUMENT" {
  if (mime.startsWith("image/")) return "IMAGE"
  return "DOCUMENT"
}

/**
 * Sanitize a filename: replace special chars, strip spaces, truncate.
 */
function sanitizeFilename(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, "_").slice(0, 200)
}

// ---------------------------------------------------------------------------
// GET /api/vehicles/[id]/registration-document
// Returns { current: VehicleDocument | null, archive: VehicleDocument[] }
// ---------------------------------------------------------------------------
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.registration_document.view")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const supabase = await createClient()

  // Verify vehicle belongs to the caller's tenant
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

  // Fetch all REGISTRATION_CERTIFICATE documents for this vehicle
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

  const adminClient = createAdminClient()

  // Enrich each document with a signed URL
  const enriched: VehicleDocument[] = await Promise.all(
    (docs ?? []).map(async (doc) => {
      const { data: signed } = await adminClient.storage
        .from("vehicle-media")
        .createSignedUrl(doc.file_path, 3600)
      return { ...doc, signed_url: signed?.signedUrl ?? null }
    })
  )

  const current = enriched.find((d) => d.is_current === true) ?? null
  const archive = enriched.filter((d) => d.is_current !== true)

  return NextResponse.json({ current, archive })
}

// ---------------------------------------------------------------------------
// POST /api/vehicles/[id]/registration-document
// Upload a new registration document (replaces current)
// ---------------------------------------------------------------------------
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.media.upload")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
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

  // Parse multipart form data
  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: "Ungültige FormData" },
      { status: 400 }
    )
  }

  const file = formData.get("file") as File | null
  if (!file) {
    return NextResponse.json(
      { error: "Keine Datei übermittelt" },
      { status: 400 }
    )
  }

  // Validate MIME type
  if (
    !ALLOWED_MIME_TYPES.includes(
      file.type as (typeof ALLOWED_MIME_TYPES)[number]
    )
  ) {
    return NextResponse.json(
      {
        error:
          "Nur PDF, JPEG, PNG und WEBP sind erlaubt für Fahrzeugscheine.",
      },
      { status: 400 }
    )
  }

  // Validate file size
  if (file.size > MAX_FILE_SIZE) {
    return NextResponse.json(
      { error: "Datei zu groß (max. 50 MB)" },
      { status: 400 }
    )
  }

  const sanitized = sanitizeFilename(file.name)
  const filePath = `tenant/${auth.tenantId}/vehicles/${vehicleId}/registration/${Date.now()}-${sanitized}`

  const adminClient = createAdminClient()

  // 1. Upload file to storage
  const arrayBuffer = await file.arrayBuffer()
  const { error: uploadError } = await adminClient.storage
    .from("vehicle-media")
    .upload(filePath, arrayBuffer, { contentType: file.type, upsert: false })

  if (uploadError) {
    return NextResponse.json(
      { error: uploadError.message },
      { status: 500 }
    )
  }

  // 2. Mark existing current registration document as not current
  const { error: updateError } = await adminClient
    .from("vehicle_documents")
    .update({ is_current: false })
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .eq("document_type", "REGISTRATION_CERTIFICATE")
    .eq("is_current", true)

  if (updateError) {
    // Clean up uploaded file on failure
    await adminClient.storage.from("vehicle-media").remove([filePath])
    return NextResponse.json(
      { error: updateError.message },
      { status: 500 }
    )
  }

  // 3. Insert new document row with is_current = true
  const { data: doc, error: insertError } = await adminClient
    .from("vehicle_documents")
    .insert({
      tenant_id: auth.tenantId,
      vehicle_id: vehicleId,
      file_path: filePath,
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
    // Clean up: remove uploaded file on DB failure
    await adminClient.storage.from("vehicle-media").remove([filePath])
    return NextResponse.json(
      { error: insertError.message },
      { status: 500 }
    )
  }

  // Generate signed URL for the new document
  const { data: signed } = await adminClient.storage
    .from("vehicle-media")
    .createSignedUrl(filePath, 3600)

  return NextResponse.json(
    { ...doc, signed_url: signed?.signedUrl ?? null },
    { status: 201 }
  )
}
