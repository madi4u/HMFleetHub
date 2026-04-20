import { NextResponse, type NextRequest } from "next/server"
import { requirePermissionGuard } from "@/lib/auth-guard"
import { db } from "@/lib/db"
import { getSignedUrl, isFilesServiceId } from "@/lib/files-service"

export async function GET(request: NextRequest) {
  const auth = await requirePermissionGuard("vehicles.list")
  if (auth instanceof NextResponse) return auth

  const url = new URL(request.url)
  const search = url.searchParams.get("search")?.trim() ?? ""
  const typeFilter = url.searchParams.get("type") ?? ""

  const values: unknown[] = [auth.tenantId]
  const conditions: string[] = ["d.tenant_id = $1"]

  if (typeFilter) {
    values.push(typeFilter)
    conditions.push(`d.document_type = $${values.length}`)
  }

  if (search) {
    values.push(`%${search}%`)
    const ph = `$${values.length}`
    conditions.push(`(d.file_name ILIKE ${ph} OR d.document_type ILIKE ${ph})`)
  }

  const where = conditions.length ? `WHERE ${conditions.join(" AND ")}` : ""

  const sql = `
    SELECT
      d.id, d.vehicle_id, d.document_type, d.file_name, d.file_size,
      d.file_path, d.mime_type, d.description, d.created_at,
      json_build_object(
        'id', v.id,
        'license_plate', v.license_plate,
        'make', v.make,
        'model', v.model
      ) AS vehicle
    FROM fleethub.vehicle_documents d
    JOIN fleethub.vehicles v ON v.id = d.vehicle_id AND v.tenant_id = d.tenant_id
    ${where}
    ORDER BY d.created_at DESC
    LIMIT 200
  `

  try {
    const result = await db.query(sql, values)
    const docs = result.rows

    const enriched = await Promise.all(
      docs.map(async (doc) => {
        const signedUrl = isFilesServiceId(doc.file_path)
          ? await getSignedUrl(doc.file_path, auth.tenantId, auth.userId)
          : null
        return {
          id: doc.id,
          vehicle_id: doc.vehicle_id,
          document_type: doc.document_type,
          file_name: doc.file_name,
          file_size: doc.file_size,
          mime_type: doc.mime_type,
          description: doc.description,
          created_at: doc.created_at,
          signed_url: signedUrl,
          vehicle: doc.vehicle,
        }
      })
    )

    return NextResponse.json({ documents: enriched, total: enriched.length })
  } catch (err) {
    console.error("documents GET error:", err)
    return NextResponse.json({ error: "Fehler beim Laden der Dokumente." }, { status: 500 })
  }
}
