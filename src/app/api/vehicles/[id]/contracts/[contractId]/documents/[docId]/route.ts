import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { deleteFile, isFilesServiceId } from "@/lib/files-service"

export async function DELETE(
  _request: NextRequest,
  {
    params,
  }: {
    params: Promise<{ id: string; contractId: string; docId: string }>
  }
) {
  const auth = await requirePermissionGuard("vehicles.contracts.edit")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId, contractId, docId } = await params
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

  // Fetch document for storage cleanup
  const { data: document, error: docError } = await supabase
    .from("contract_documents")
    .select("id, file_path")
    .eq("id", docId)
    .eq("contract_id", contractId)
    .eq("tenant_id", auth.tenantId)
    .single()

  if (docError || !document) {
    return NextResponse.json(
      { error: "Dokument nicht gefunden" },
      { status: 404 }
    )
  }

  const adminClient = createAdminClient()

  // Delete DB record
  const { error: deleteError } = await adminClient
    .from("contract_documents")
    .delete()
    .eq("id", docId)
    .eq("tenant_id", auth.tenantId)

  if (deleteError) {
    return NextResponse.json(
      { error: deleteError.message },
      { status: 500 }
    )
  }

  // Storage cleanup (best effort)
  if (isFilesServiceId(document.file_path)) {
    await deleteFile(document.file_path, auth.tenantId, auth.userId)
  }

  return new NextResponse(null, { status: 204 })
}
