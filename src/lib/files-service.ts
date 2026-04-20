/**
 * Files Service client — server-side only.
 * Used by FleetHub API routes to upload/download/delete via files.hundm.cloud.
 */

const FILES_URL    = process.env.FILES_SERVICE_URL    ?? "https://files.hundm.cloud"
const FILES_SECRET = process.env.FILES_SERVICE_INTERNAL_SECRET ?? ""

/** Returns true for Files Service IDs (UUID format) vs legacy Supabase paths */
export function isFilesServiceId(filePath: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filePath)
}

function internalHeaders(orgId: string, userId: string, service = "fleethub"): HeadersInit {
  return {
    Authorization: `Bearer ${FILES_SECRET}`,
    "x-org-id":    orgId,
    "x-user-id":   userId,
    "x-service":   service,
  }
}

export async function uploadFile(opts: {
  body:        ArrayBuffer
  fileName:    string
  mimeType:    string
  orgId:       string
  userId:      string
  sourceEntity?:   string
  sourceEntityId?: string
}): Promise<string> {
  const form = new FormData()
  form.append("file", new Blob([opts.body], { type: opts.mimeType }), opts.fileName)
  form.append("meta", JSON.stringify({
    sourceService:  "fleethub",
    sourceEntity:   opts.sourceEntity,
    sourceEntityId: opts.sourceEntityId,
  }))

  const res = await fetch(`${FILES_URL}/api/upload`, {
    method:  "POST",
    headers: internalHeaders(opts.orgId, opts.userId),
    body:    form,
  })
  if (!res.ok) {
    const err = await res.text().catch(() => res.statusText)
    throw new Error(`Files Service upload failed: ${err}`)
  }
  const json = await res.json() as { id: string }
  return json.id
}

export async function getSignedUrl(
  fileId: string,
  orgId:  string,
  userId: string,
  expiresIn = 3600
): Promise<string | null> {
  const res = await fetch(
    `${FILES_URL}/api/file/${fileId}/url?expires=${expiresIn}`,
    { headers: internalHeaders(orgId, userId) }
  )
  if (!res.ok) return null
  const json = await res.json() as { url: string }
  return json.url
}

export async function deleteFile(
  fileId: string,
  orgId:  string,
  userId: string
): Promise<void> {
  await fetch(`${FILES_URL}/api/file/${fileId}`, {
    method:  "DELETE",
    headers: internalHeaders(orgId, userId),
  })
}
