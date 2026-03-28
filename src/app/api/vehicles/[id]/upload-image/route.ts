import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionGuard } from "@/lib/auth-guard"

const uuidSchema = z.string().uuid()

const ALLOWED_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "image/gif",
]
const MAX_FILE_SIZE = 10 * 1024 * 1024 // 10 MB

/**
 * POST /api/vehicles/[id]/upload-image
 *
 * Accepts multipart/form-data with an "image" field.
 * Uploads to Supabase Storage bucket "vehicle-media"
 * at path: tenant/{tenantId}/vehicles/{vehicleId}/cover.{ext}
 * Updates vehicles.image_url with the storage path.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermissionGuard("vehicles.edit")
    if (guard instanceof NextResponse) return guard

    const { tenantId } = guard
    const { id } = await params

    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json(
        { error: "Ungültige Fahrzeug-ID." },
        { status: 400 }
      )
    }

    const adminClient = createAdminClient()

    // Verify vehicle exists in tenant
    const { data: vehicle, error: fetchError } = await adminClient
      .from("vehicles")
      .select("id")
      .eq("id", id)
      .eq("tenant_id", tenantId)
      .is("deleted_at", null)
      .single()

    if (fetchError || !vehicle) {
      return NextResponse.json(
        { error: "Fahrzeug nicht gefunden." },
        { status: 404 }
      )
    }

    // Parse multipart form data
    const formData = await request.formData()
    const file = formData.get("image")

    if (!file || !(file instanceof File)) {
      return NextResponse.json(
        { error: "Kein Bild hochgeladen. Feld 'image' wird erwartet." },
        { status: 400 }
      )
    }

    // Validate MIME type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        {
          error: `Ungültiger Dateityp: ${file.type}. Erlaubt: ${ALLOWED_MIME_TYPES.join(", ")}`,
        },
        { status: 400 }
      )
    }

    // Validate file size
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json(
        { error: "Datei zu groß. Maximal 10 MB erlaubt." },
        { status: 400 }
      )
    }

    // Determine file extension from MIME type
    const extMap: Record<string, string> = {
      "image/jpeg": "jpg",
      "image/png": "png",
      "image/webp": "webp",
      "image/gif": "gif",
    }
    const ext = extMap[file.type] ?? "jpg"

    // Build storage path
    const storagePath = `tenant/${tenantId}/vehicles/${id}/cover.${ext}`

    // Read file as buffer
    const arrayBuffer = await file.arrayBuffer()
    const buffer = new Uint8Array(arrayBuffer)

    // Upload to Supabase Storage (upsert to overwrite existing cover)
    const { error: uploadError } = await adminClient.storage
      .from("vehicle-media")
      .upload(storagePath, buffer, {
        contentType: file.type,
        upsert: true,
      })

    if (uploadError) {
      console.error("upload-image storage error:", uploadError)
      return NextResponse.json(
        { error: "Fehler beim Hochladen des Bildes." },
        { status: 500 }
      )
    }

    // Update vehicle record with the storage path
    const { error: updateError } = await adminClient
      .from("vehicles")
      .update({ image_url: storagePath })
      .eq("id", id)
      .eq("tenant_id", tenantId)

    if (updateError) {
      console.error("upload-image db update error:", updateError)
      return NextResponse.json(
        { error: "Bild hochgeladen, aber Fahrzeugdatensatz konnte nicht aktualisiert werden." },
        { status: 500 }
      )
    }

    return NextResponse.json({ image_url: storagePath }, { status: 200 })
  } catch (err) {
    console.error("upload-image unexpected error:", err)
    return NextResponse.json(
      { error: "Interner Serverfehler" },
      { status: 500 }
    )
  }
}
