import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { getSignedUrl, isFilesServiceId } from "@/lib/files-service"

const contractSchema = z.object({
  contract_type: z.enum(["LEASING", "FINANCING", "PURCHASE"]),
  contract_status: z
    .enum(["ACTIVE", "EXPIRED", "CANCELLED", "PLANNED"])
    .optional()
    .default("ACTIVE"),
  provider: z.string().min(1).max(200),
  contract_start: z.string(), // ISO date YYYY-MM-DD
  contract_end: z.string().optional().nullable(),
  monthly_cost: z.number().min(0).optional().nullable(),
  purchase_price: z.number().min(0).optional().nullable(),
  financing_amount: z.number().min(0).optional().nullable(),
  residual_value: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).optional().default("EUR"),
  contract_number: z.string().max(100).optional().nullable(),
  notice_period_days: z.number().int().min(0).optional().nullable(),
  notes: z.string().max(2000).optional().nullable(),
})

export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.contracts.view")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const supabase = await createClient()

  // Verify vehicle belongs to tenant
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (vehicleError || !vehicle) {
    return NextResponse.json(
      { error: "Fahrzeug nicht gefunden" },
      { status: 404 }
    )
  }

  // Fetch contracts
  const { data: contracts, error } = await supabase
    .from("contracts")
    .select("*")
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .order("contract_start", { ascending: false })
    .limit(100)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Fetch documents for all contracts
  const contractIds = (contracts ?? []).map(
    (c: { id: string }) => c.id
  )
  const documentsMap: Record<string, Record<string, unknown>[]> = {}

  if (contractIds.length > 0) {
    const { data: documents } = await supabase
      .from("contract_documents")
      .select("*")
      .in("contract_id", contractIds)

    // Generate signed URLs via Files Service
    const enriched = await Promise.all(
      (documents ?? []).map(
        async (doc: { file_path: string; contract_id: string }) => {
          const signedUrl = isFilesServiceId(doc.file_path)
            ? await getSignedUrl(doc.file_path, auth.tenantId, auth.userId)
            : null
          return { ...doc, signed_url: signedUrl }
        }
      )
    )

    // Group by contract id
    for (const doc of enriched) {
      const key = doc.contract_id as string
      if (!documentsMap[key]) documentsMap[key] = []
      documentsMap[key].push(doc)
    }
  }

  const enrichedContracts = (contracts ?? []).map(
    (contract: { id: string }) => ({
      ...contract,
      documents: documentsMap[contract.id] ?? [],
    })
  )

  return NextResponse.json({ data: enrichedContracts })
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.contracts.edit")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId } = await params
  const body = await request.json()
  const parsed = contractSchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Verify vehicle belongs to tenant
  const { data: vehicle, error: vehicleError } = await supabase
    .from("vehicles")
    .select("id")
    .eq("id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .is("deleted_at", null)
    .single()

  if (vehicleError || !vehicle) {
    return NextResponse.json(
      { error: "Fahrzeug nicht gefunden" },
      { status: 404 }
    )
  }

  const adminClient = createAdminClient()
  const { data, error } = await adminClient
    .from("contracts")
    .insert({
      tenant_id: auth.tenantId,
      vehicle_id: vehicleId,
      ...parsed.data,
    })
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ...data, documents: [] }, { status: 201 })
}
