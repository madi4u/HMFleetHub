import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { deleteFile, isFilesServiceId } from "@/lib/files-service"

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; docId: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.media.upload")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId, docId } = await params
  const supabase = await createClient()

  const { data: doc, error: fetchError } = await supabase
    .from("vehicle_documents")
    .select("file_path")
    .eq("id", docId)
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .single()

  if (fetchError || !doc) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    )
  }

  const { error } = await supabase
    .from("vehicle_documents")
    .delete()
    .eq("id", docId)
    .eq("tenant_id", auth.tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  if (isFilesServiceId(doc.file_path)) {
    await deleteFile(doc.file_path, auth.tenantId, auth.userId)
  }

  return new NextResponse(null, { status: 204 })
}
