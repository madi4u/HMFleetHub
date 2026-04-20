import { NextRequest, NextResponse } from "next/server"
import { z } from "zod"
import { createAdminClient } from "@/lib/supabase/admin"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { uploadFile } from "@/lib/files-service"

const uuidSchema = z.string().uuid()
const ALLOWED_MIME_TYPES = ["image/jpeg", "image/png", "image/webp", "image/gif"]
const MAX_FILE_SIZE = 10 * 1024 * 1024

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const guard = await requirePermissionGuard("vehicles.edit")
    if (guard instanceof NextResponse) return guard

    const { tenantId, userId } = guard
    const { id } = await params

    if (!uuidSchema.safeParse(id).success) {
      return NextResponse.json({ error: "Ungültige Fahrzeug-ID." }, { status: 400 })
    }

    const adminClient = createAdminClient()
    const { data: vehicle, error: fetchError } = await adminClient
      .from("vehicles").select("id").eq("id", id).eq("tenant_id", tenantId).is("deleted_at", null).single()

    if (fetchError || !vehicle) {
      return NextResponse.json({ error: "Fahrzeug nicht gefunden." }, { status: 404 })
    }

    const formData = await request.formData()
    const file = formData.get("image")

    if (!file || !(file instanceof File)) {
      return NextResponse.json({ error: "Kein Bild hochgeladen. Feld 'image' wird erwartet." }, { status: 400 })
    }
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json({ error: `Ungültiger Dateityp: ${file.type}.` }, { status: 400 })
    }
    if (file.size > MAX_FILE_SIZE) {
      return NextResponse.json({ error: "Datei zu groß. Maximal 10 MB erlaubt." }, { status: 413 })
    }

    const arrayBuffer = await file.arrayBuffer()
    const fileId = await uploadFile({
      body: arrayBuffer, fileName: file.name, mimeType: file.type,
      orgId: tenantId, userId,
      sourceEntity: "vehicle", sourceEntityId: id,
    })

    const { error: updateError } = await adminClient
      .from("vehicles").update({ image_url: fileId }).eq("id", id).eq("tenant_id", tenantId)

    if (updateError) {
      return NextResponse.json(
        { error: "Bild hochgeladen, aber Fahrzeugdatensatz konnte nicht aktualisiert werden." },
        { status: 500 }
      )
    }

    return NextResponse.json({ image_url: fileId }, { status: 200 })
  } catch (err) {
    console.error("upload-image error:", err)
    return NextResponse.json({ error: "Interner Serverfehler" }, { status: 500 })
  }
}
