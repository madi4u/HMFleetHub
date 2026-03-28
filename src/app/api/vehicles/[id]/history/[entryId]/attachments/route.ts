import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const MAX_ATTACHMENTS = 10
const MAX_IMAGE_SIZE = 50 * 1024 * 1024 // 50 MB
const MAX_VIDEO_SIZE = 500 * 1024 * 1024 // 500 MB
const MAX_DOC_SIZE = 50 * 1024 * 1024 // 50 MB

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

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.history.create")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId, entryId } = await params
  const supabase = await createClient()

  // Verify entry exists in this tenant/vehicle
  const { data: entry, error: entryError } = await supabase
    .from("vehicle_history_entries")
    .select("id")
    .eq("id", entryId)
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .single()

  if (entryError || !entry) {
    return NextResponse.json(
      { error: "Eintrag nicht gefunden" },
      { status: 404 }
    )
  }

  // Check attachment count
  const { count } = await supabase
    .from("vehicle_history_attachments")
    .select("id", { count: "exact", head: true })
    .eq("history_entry_id", entryId)

  if ((count ?? 0) >= MAX_ATTACHMENTS) {
    return NextResponse.json(
      { error: "Maximal 10 Anhaenge pro Eintrag erlaubt" },
      { status: 400 }
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

  const attachmentType = getAttachmentType(file.type)
  if (!attachmentType) {
    return NextResponse.json(
      { error: "Nicht unterstuetzter Dateityp" },
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
    return NextResponse.json(
      { error: "Datei zu gross" },
      { status: 400 }
    )
  }

  const ext = file.name.split(".").pop() ?? "bin"
  const fileName = `${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`
  const filePath = `tenant/${auth.tenantId}/vehicles/${vehicleId}/history/${entryId}/${fileName}`

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

  const { data: attachment, error: dbError } = await supabase
    .from("vehicle_history_attachments")
    .insert({
      tenant_id: auth.tenantId,
      history_entry_id: entryId,
      vehicle_id: vehicleId,
      file_path: filePath,
      file_name: file.name,
      mime_type: file.type,
      file_size: file.size,
      attachment_type: attachmentType,
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
    { ...attachment, signed_url: signed?.signedUrl ?? null },
    { status: 201 }
  )
}
