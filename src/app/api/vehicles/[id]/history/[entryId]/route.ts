import { NextResponse, type NextRequest } from "next/server"
import { z } from "zod"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { createClient } from "@/lib/supabase/server"
import { hasPermission } from "@/lib/permissions.config"
import { deleteFile, isFilesServiceId } from "@/lib/files-service"

const updateEntrySchema = z.object({
  entry_type: z
    .enum([
      "NOTE",
      "REPAIR",
      "MAINTENANCE",
      "OIL_CHANGE",
      "TIRE_CHANGE",
      "DAMAGE",
      "INSPECTION",
      "TUV",
      "MILEAGE_UPDATE",
      "DOCUMENT_UPLOAD",
      "PHOTO_UPLOAD",
      "VIDEO_UPLOAD",
      "OTHER",
    ])
    .optional(),
  title: z.string().max(200).optional().nullable(),
  message: z.string().max(5000).optional().nullable(),
  mileage: z.number().int().positive().optional().nullable(),
  cost_net: z.number().min(0).optional().nullable(),
  cost_gross: z.number().min(0).optional().nullable(),
  currency: z.string().length(3).optional().nullable(),
  supplier: z.string().max(200).optional().nullable(),
  invoice_number: z.string().max(100).optional().nullable(),
  event_date: z.string().datetime().optional().nullable(),
  repair_status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional().nullable(),
  next_due_date: z.string().optional().nullable(),
  cost_category: z
    .enum([
      "REPAIR",
      "MAINTENANCE",
      "OIL",
      "TIRES",
      "INSPECTION",
      "BODYWORK",
      "ELECTRICAL",
      "OTHER",
    ])
    .optional()
    .nullable(),
})

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.history.update")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId, entryId } = await params
  const body = await request.json()
  const parsed = updateEntrySchema.safeParse(body)

  if (!parsed.success) {
    return NextResponse.json(
      { error: parsed.error.flatten() },
      { status: 400 }
    )
  }

  const supabase = await createClient()

  // Fetch entry to verify ownership
  const { data: entry, error: fetchError } = await supabase
    .from("vehicle_history_entries")
    .select("id, author_user_id, tenant_id")
    .eq("id", entryId)
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)
    .single()

  if (fetchError || !entry) {
    return NextResponse.json(
      { error: "Eintrag nicht gefunden" },
      { status: 404 }
    )
  }

  // Must be own entry OR an admin/manager who can edit any entry
  const isOwn = entry.author_user_id === auth.userId
  const canEditAll =
    hasPermission(auth.role, "vehicles.history.update") &&
    (auth.role === "SUPERADMIN" ||
      auth.role === "TENANT_ADMIN" ||
      auth.role === "FLEET_MANAGER")

  if (!isOwn && !canEditAll) {
    return NextResponse.json(
      { error: "Keine Berechtigung" },
      { status: 403 }
    )
  }

  const { data, error } = await supabase
    .from("vehicle_history_entries")
    .update(parsed.data)
    .eq("id", entryId)
    .select()
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}

export async function DELETE(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string; entryId: string }> }
) {
  const auth = await requirePermissionGuard("vehicles.history.delete")
  if (auth instanceof NextResponse) return auth

  const { id: vehicleId, entryId } = await params
  const supabase = await createClient()

  // Fetch attachments first for storage cleanup
  const { data: attachments } = await supabase
    .from("vehicle_history_attachments")
    .select("file_path")
    .eq("history_entry_id", entryId)
    .eq("tenant_id", auth.tenantId)

  // Delete entry (attachments cascade via FK)
  const { error } = await supabase
    .from("vehicle_history_entries")
    .delete()
    .eq("id", entryId)
    .eq("vehicle_id", vehicleId)
    .eq("tenant_id", auth.tenantId)

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  // Async storage cleanup (best effort)
  if (attachments && attachments.length > 0) {
    await Promise.all(
      attachments
        .filter((a: { file_path: string }) => isFilesServiceId(a.file_path))
        .map((a: { file_path: string }) => deleteFile(a.file_path, auth.tenantId, auth.userId))
    )
  }

  return new NextResponse(null, { status: 204 })
}
