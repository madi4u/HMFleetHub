import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.financials.view")
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

  // Fetch all entries with cost data
  const { data: entries, error } = await supabase
    .from("vehicle_history_entries")
    .select("cost_net, cost_gross, currency, cost_category, event_date")
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .not("cost_gross", "is", null)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  const rows = entries ?? []

  // Aggregate totals
  const total_gross = rows.reduce(
    (sum, r) => sum + ((r.cost_gross as number | null) ?? 0),
    0
  )
  const total_net = rows.reduce(
    (sum, r) => sum + ((r.cost_net as number | null) ?? 0),
    0
  )

  // By category
  const categoryMap: Record<string, { total_gross: number; count: number }> = {}
  for (const r of rows) {
    const cat = (r.cost_category as string | null) ?? "OTHER"
    if (!categoryMap[cat]) categoryMap[cat] = { total_gross: 0, count: 0 }
    categoryMap[cat].total_gross += (r.cost_gross as number | null) ?? 0
    categoryMap[cat].count += 1
  }
  const by_category = Object.entries(categoryMap).map(([category, v]) => ({
    category,
    ...v,
  }))

  // By month
  const monthMap: Record<
    string,
    { year: number; month: number; total_gross: number; count: number }
  > = {}
  for (const r of rows) {
    const d = new Date(r.event_date as string)
    const key = `${d.getFullYear()}-${d.getMonth() + 1}`
    if (!monthMap[key])
      monthMap[key] = {
        year: d.getFullYear(),
        month: d.getMonth() + 1,
        total_gross: 0,
        count: 0,
      }
    monthMap[key].total_gross += (r.cost_gross as number | null) ?? 0
    monthMap[key].count += 1
  }
  const by_month = Object.values(monthMap).sort(
    (a, b) => b.year - a.year || b.month - a.month
  )

  return NextResponse.json({
    total_net: Math.round(total_net * 100) / 100,
    total_gross: Math.round(total_gross * 100) / 100,
    currency: "EUR",
    by_category,
    by_month,
  })
}
