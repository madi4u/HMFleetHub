import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"

const updateContractSchema = z.object({
  contract_type: z
    .enum(["LEASING", "FINANCING", "PURCHASE"])
    .optional(),
  contract_status: z
    .enum(["ACTIVE", "EXPIRED", "CANCELLED", "PLANNED"])
    .optional(),
  provider: z.string().min(1).max(200).optional(),
  contract_start: z.string().optional(),
  contract_end: z.string().optional().nullable(),
  monthly_cost: z.number().min(0).optional().nullable(),
  purchase_price: z.number().min(0).optional().nullable(),
  financing_amount: z.number().min(0).optional().nullable(),
  residual_value: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).optional(),
  contract_number: z.string().max(100).optional().nullable(),
  notice_period_days: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.contracts.edit")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId, contractId } = await params
  const body = await request.json()
  const parsed = updateContractSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Verify contract exists in this tenant/vehicle
  const { data: contract, error: fetchError } = await supabase
    .from("contracts")
    .select("id")
    .eq("id", contractId)
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .single()

  if (fetchError || !contract) {
    return NextResponse.json(
      { error: "Vertrag nicht gefunden" },
      { status: 404 }
    )
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("contracts")
    .update(parsed.data)
    .eq("id", contractId)
    .eq("tenant_id", auth.tenantId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; contractId: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.contracts.edit")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId, contractId } = await params
  const supabase = await createClient()

  // Fetch document file paths before deletion for storage cleanup
  const { data: documents } = await supabase
    .from("contract_documents")
    .select("file_path")
    .eq("contract_id", contractId)
    .eq("tenant_id", auth.tenantId)

  // Delete contract (documents cascade via FK)
  const adminClient = createAdminClient()
  const { error } = await adminClient
    .from("contracts")
    .delete()
    .eq("id", contractId)
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Storage cleanup (best effort)
  if (documents && documents.length > 0) {
    const filePaths = documents.map(
      (d: { file_path: string }) => d.file_path
    )
    await adminClient.storage.from("vehicle-media").remove(filePaths)
  }

  return new NextResponse(null, { status: 204 })
}
