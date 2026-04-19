/**
 * FleetHub: Data migration from Supabase → Hetzner PostgreSQL
 *
 * Usage:
 *   DATABASE_URL="postgresql://..." SUPABASE_URL="https://..." SUPABASE_SERVICE_KEY="..." \
 *   npx ts-node --esm scripts/migrate-from-supabase.ts
 */

import { Pool } from "pg"

const SUPABASE_URL = process.env.SUPABASE_URL ?? "https://jyjygrjqprpuvrebfdtm.supabase.co"
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_KEY ?? "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imp5anlncmpxcHJwdXZyZWJmZHRtIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc3NDY0MzMyMywiZXhwIjoyMDkwMjE5MzIzfQ.8TTfR8dqFFPfONmzJ0eF0Fvbi16vGWOvHkmNmEBiVtU"
const DATABASE_URL = process.env.DATABASE_URL!

if (!DATABASE_URL) {
  console.error("Missing env: DATABASE_URL")
  process.exit(1)
}

const pool = new Pool({ connectionString: DATABASE_URL })

async function supabaseFetch(table: string, select = "*", filter?: string) {
  const url = `${SUPABASE_URL}/rest/v1/${table}?select=${select}${filter ? "&" + filter : ""}`
  const res = await fetch(url, {
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      "Content-Type": "application/json",
      "Range-Unit": "items",
      Range: "0-9999",
    },
  })
  if (!res.ok) throw new Error(`Supabase fetch ${table} failed: ${res.statusText}`)
  return res.json()
}

async function upsertRows(table: string, rows: Record<string, unknown>[], conflictCol = "id") {
  if (rows.length === 0) return
  const keys = Object.keys(rows[0])
  const cols = keys.map((k) => `"${k}"`).join(", ")
  const updates = keys.filter((k) => k !== conflictCol).map((k) => `"${k}" = EXCLUDED."${k}"`).join(", ")

  for (const row of rows) {
    const vals = keys.map((k) => row[k])
    const placeholders = keys.map((_, i) => `$${i + 1}`).join(", ")
    const sql = `INSERT INTO fleethub."${table}" (${cols}) VALUES (${placeholders})
                 ON CONFLICT ("${conflictCol}") DO UPDATE SET ${updates}`
    await pool.query(sql, vals)
  }
}

async function main() {
  console.log("🚀 Starting FleetHub migration: Supabase → Hetzner")
  console.log("")

  // ============================================================
  // 1. Tenants
  // ============================================================
  console.log("📦 Migrating tenants...")
  const tenants = await supabaseFetch("tenants")
  await upsertRows("tenants", tenants.map((t: Record<string, unknown>) => ({
    id: t.id,
    name: t.name,
    slug: t.slug ?? String(t.name).toLowerCase().replace(/\s+/g, "-"),
    status: t.status ?? "active",
    contact_email: t.contact_email ?? null,
    address: t.address ?? null,
    created_at: t.created_at,
    updated_at: t.updated_at,
  })))
  console.log(`  ✅ ${tenants.length} tenants`)

  // ============================================================
  // 2. Profiles / Users
  // ============================================================
  console.log("📦 Migrating profiles...")
  const profiles = await supabaseFetch("profiles")
  let profilesMigrated = 0
  for (const p of profiles) {
    const email = p.email ?? `user-${p.id}@fleethub.local`
    const name = p.full_name ?? email.split("@")[0]

    // Check if identity.users already has this user (by email)
    const { rows: existing } = await pool.query(
      'SELECT id FROM identity.users WHERE email = $1',
      [email]
    )
    if (!existing[0]) {
      await pool.query(
        `INSERT INTO identity.users (id, email, name, is_active, locale, timezone)
         VALUES ($1, $2, $3, true, 'de-DE', 'Europe/Berlin')
         ON CONFLICT (id) DO NOTHING`,
        [p.id, email, name]
      )
    }
    const userId = existing[0]?.id ?? p.id

    await pool.query(`
      INSERT INTO fleethub.profiles (id, user_id, tenant_id, full_name, avatar_url, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
      ON CONFLICT (id) DO UPDATE SET
        user_id = EXCLUDED.user_id,
        tenant_id = EXCLUDED.tenant_id,
        full_name = EXCLUDED.full_name,
        updated_at = EXCLUDED.updated_at
    `, [p.id, userId, p.tenant_id, p.full_name, p.avatar_url, p.created_at, p.updated_at])
    profilesMigrated++
  }
  console.log(`  ✅ ${profilesMigrated} profiles`)

  // ============================================================
  // 3. Memberships
  // ============================================================
  console.log("📦 Migrating user_tenant_memberships...")
  const memberships = await supabaseFetch("user_tenant_memberships")
  await upsertRows("user_tenant_memberships", memberships.map((m: Record<string, unknown>) => ({
    id: m.id,
    user_id: m.user_id,
    tenant_id: m.tenant_id,
    role: m.role ?? "VIEWER",
    is_active: m.is_active ?? true,
    created_at: m.created_at,
    updated_at: m.updated_at,
  })))
  console.log(`  ✅ ${memberships.length} memberships`)

  // ============================================================
  // 4. Vehicles
  // ============================================================
  console.log("📦 Migrating vehicles...")
  const vehicles = await supabaseFetch("vehicles")
  await upsertRows("vehicles", vehicles.map((v: Record<string, unknown>) => ({
    id: v.id,
    tenant_id: v.tenant_id,
    license_plate: v.license_plate,
    image_url: v.image_url ?? null,
    make: v.make,
    model: v.model,
    vehicle_type: v.vehicle_type,
    status: v.status ?? "Aktiv",
    vin: v.vin ?? null,
    first_registration: v.first_registration ?? null,
    year: v.year ?? null,
    color: v.color ?? null,
    current_mileage: v.current_mileage ?? null,
    location: v.location ?? null,
    assigned_to: v.assigned_to ?? null,
    notes: v.notes ?? null,
    tire_size: v.tire_size ?? null,
    engine_oil_spec: v.engine_oil_spec ?? null,
    transmission_oil_spec: v.transmission_oil_spec ?? null,
    fuel_type: v.fuel_type ?? null,
    engine_code: v.engine_code ?? null,
    engine_power: v.engine_power ?? null,
    hsn: v.hsn ?? null,
    tsn: v.tsn ?? null,
    service_interval_notes: v.service_interval_notes ?? null,
    technical_notes: v.technical_notes ?? null,
    tuev_bis: v.tuev_bis ?? null,
    deleted_at: v.deleted_at ?? null,
    created_at: v.created_at,
    updated_at: v.updated_at,
  })))
  console.log(`  ✅ ${vehicles.length} vehicles`)

  // ============================================================
  // 5. Vehicle History
  // ============================================================
  console.log("📦 Migrating vehicle_history_entries...")
  const history = await supabaseFetch("vehicle_history_entries")
  await upsertRows("vehicle_history_entries", history.map((h: Record<string, unknown>) => ({
    id: h.id,
    tenant_id: h.tenant_id,
    vehicle_id: h.vehicle_id,
    author_user_id: h.author_user_id ?? null,
    entry_type: h.entry_type,
    title: h.title ?? null,
    message: h.message ?? null,
    mileage: h.mileage ?? null,
    cost_net: h.cost_net ?? null,
    cost_gross: h.cost_gross ?? null,
    currency: h.currency ?? "EUR",
    supplier: h.supplier ?? null,
    invoice_number: h.invoice_number ?? null,
    cost_category: h.cost_category ?? null,
    event_date: h.event_date,
    created_at: h.created_at,
    updated_at: h.updated_at,
  })))

  const attachments = await supabaseFetch("vehicle_history_attachments")
  await upsertRows("vehicle_history_attachments", attachments)
  console.log(`  ✅ ${history.length} history entries, ${attachments.length} attachments`)

  // ============================================================
  // 6. Mileage Entries
  // ============================================================
  console.log("📦 Migrating mileage_entries...")
  const mileage = await supabaseFetch("mileage_entries")
  await upsertRows("mileage_entries", mileage.map((m: Record<string, unknown>) => ({
    id: m.id,
    tenant_id: m.tenant_id,
    vehicle_id: m.vehicle_id,
    user_id: m.user_id ?? null,
    mileage: m.mileage,
    recorded_at: m.recorded_at,
    source: m.source ?? null,
    notes: m.notes ?? null,
    created_at: m.created_at,
  })))
  console.log(`  ✅ ${mileage.length} mileage entries`)

  await pool.end()
  console.log("")
  console.log("✅ Migration complete!")
  console.log("")
  console.log("Verify with:")
  console.log(`  SELECT COUNT(*) FROM fleethub.vehicles;`)
  console.log(`  SELECT COUNT(*) FROM fleethub.profiles;`)
}

main().catch((err) => {
  console.error("❌ Migration failed:", err)
  process.exit(1)
})
