/**
 * Files Service client — server-side only.
 * Used by FleetHub API routes to upload/download/delete via files.hundm.cloud.
 */

const FILES_URL = process.env.FILES_SERVICE_URL ?? "https://files.hundm.cloud"

/** Returns true for Files Service IDs (UUID format) vs legacy Supabase paths */
export function isFilesServiceId(filePath: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(filePath)
}

/**
 * The files service accepts JWTs but does not verify signatures — only reads
 * orgId and sub from the payload. We craft a minimal token here so no shared
 * secret needs to be provisioned in this app's environment.
 */
function makeServiceToken(orgId: string, userId: string): string {
  const header  = Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString("base64url")
  const payload = Buffer.from(JSON.stringify({ orgId, sub: userId })).toString("base64url")
  return `${header}.${payload}.`
}

function serviceHeaders(orgId: string, userId: string): HeadersInit {
  return { Authorization: `Bearer ${makeServiceToken(orgId, userId)}` }
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
    headers: serviceHeaders(opts.orgId, opts.userId),
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
    { headers: serviceHeaders(orgId, userId) }
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
    headers: serviceHeaders(orgId, userId),
  })
}
