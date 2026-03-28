# PROJ-3: Mandanten- & Superadmin-Verwaltung

## Status: In Progress
**Created:** 2026-03-27
**Last Updated:** 2026-03-27

## Dependencies
- Requires: PROJ-1 (Authentifizierung) — SUPERADMIN-Session notwendig
- Requires: PROJ-2 (App Shell) — Superadmin-Bereich in der Navigation

## Overview
SUPERADMIN kann neue Mandanten (Firmen/Kunden) anlegen, verwalten und deaktivieren. Jeder Mandant ist vollständig isoliert — Daten verschiedener Mandanten sind niemals gegenseitig sichtbar. Der Superadmin-Bereich bietet eine Übersicht aller Mandanten mit Status, Fahrzeug- und Benutzeranzahl.

## User Stories
- Als SUPERADMIN möchte ich einen neuen Mandanten anlegen (Firmenname, Kontakt, Status), damit neue Kunden die Plattform nutzen können.
- Als SUPERADMIN möchte ich eine Übersicht aller Mandanten sehen mit Anzahl Fahrzeuge, Benutzer und Status.
- Als SUPERADMIN möchte ich einen Mandanten deaktivieren, damit er keinen Zugang mehr hat, ohne die Daten zu löschen.
- Als SUPERADMIN möchte ich einen Mandanten wieder aktivieren können.
- Als SUPERADMIN möchte ich den ersten TENANT_ADMIN eines Mandanten per Einladung anlegen.
- Als TENANT_ADMIN möchte ich nur meine eigenen Mandantendaten sehen und verwalten — keine anderen Mandanten.
- Als Benutzer eines Mandanten darf ich niemals Daten anderer Mandanten sehen, auch nicht durch direkte URL-Manipulation.

## Acceptance Criteria
- [ ] SUPERADMIN-Bereich ist nur für Benutzer mit Rolle SUPERADMIN zugänglich (serverseitig geprüft)
- [ ] Superadmin-Übersicht zeigt: Mandantenname, Status (aktiv/inaktiv), Anzahl Fahrzeuge, Anzahl Benutzer, Erstellungsdatum
- [ ] Neuen Mandanten anlegen: Pflichtfelder Firmenname, Slug/Identifier; optionale Felder Adresse, Kontaktemail
- [ ] Mandant anlegen erstellt automatisch einen Eintrag in `tenants`-Tabelle mit Status `active`
- [ ] SUPERADMIN kann TENANT_ADMIN per E-Mail einladen (Supabase `inviteUserByEmail` + Rollenzuweisung)
- [ ] Mandant deaktivieren setzt Status auf `inactive` und blockiert Login für alle zugehörigen Benutzer
- [ ] Deaktivierter Mandant: bestehende Daten bleiben erhalten, kein Datenverlust
- [ ] Alle Datenbankabfragen erzwingen `tenant_id` — kein Cross-Tenant-Datenleak möglich
- [ ] RLS Policies verhindern Cross-Tenant-Zugriff auf Datenbankebene
- [ ] Superadmin kann Mandantendetails bearbeiten (Name, Kontakt, Status)
- [ ] Tabellenansicht mit Suche und Filter nach Status

## Edge Cases
- Was passiert, wenn ein Mandant mit Fahrzeugen deaktiviert wird? → Deaktivierung möglich, Daten bleiben; Benutzer des Mandanten können sich nicht mehr einloggen
- Was passiert, wenn SUPERADMIN versucht sich selbst oder seinen eigenen Mandanten zu löschen? → Löschen ist nicht erlaubt (nur Deaktivierung); eigenes Konto kann nicht deaktiviert werden
- Was passiert, wenn zwei Mandanten denselben Firmennamen haben? → Firmenname darf doppelt existieren, Slug/ID muss eindeutig sein
- Was passiert, wenn ein TENANT_ADMIN versucht auf den Superadmin-Bereich zuzugreifen? → 403 Forbidden, Redirect zur eigenen Startseite
- Was passiert bei einem URL-Manipulation-Versuch (z. B. `tenant_id` in API-Request manipulieren)? → Serverseitige Prüfung: nur eigene `tenant_id` aus der Session erlaubt; RLS verhindert DB-Zugriff

## Technical Requirements
- Mandantentrennung: Jede Tabelle mit Fahrzeug-/Benutzerbezug hat `tenant_id UUID NOT NULL`
- RLS: Alle mandantenrelevanten Tabellen haben `USING (tenant_id = auth.jwt()->>'tenant_id')` oder equivalent via Membership
- Superadmin-Guard: Middleware + serverseitige Prüfung `role = 'SUPERADMIN'` vor jedem Superadmin-Endpunkt
- Tenant-Status: Beim Login wird geprüft, ob der Mandant des Benutzers `active` ist
- Keine Lösch-Funktion für Mandanten in UI — nur Deaktivierung (Soft-Delete-Prinzip)

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Seitenstruktur

```
/admin/tenants                              (SUPERADMIN only)
└── TenantListPage
    ├── StatsRow (Gesamt / Aktiv / Inaktiv)
    ├── TenantTableToolbar
    │   ├── SearchInput, StatusFilter-Select
    │   └── "Neuen Mandanten anlegen" Button
    └── TenantTable (TanStack Table)
        ├── Spalten: Name, Slug, Status, Benutzer #, Fahrzeuge #, Erstellt, Aktionen
        └── RowActions: Bearbeiten (Sheet), Aktivieren/Deaktivieren (Confirm-Dialog)

/admin/tenants/new
└── TenantForm: Firmenname*, Slug* (auto), Kontakt-E-Mail, Adresse

/admin/tenants/[id]
└── TenantDetailPage
    ├── Tabs: "Übersicht" (Stammdaten + Stats) | "Benutzer" (Liste + Einladen)
    └── InviteAdminDialog: E-Mail, Rolle-Select, Senden
```

### Datenmodell

```
tenants (Erweiterung aus PROJ-1):
  + contact_email   — optionale Kontaktemail
  + address         — optionale Adresse

Übersichtstabelle aggregiert live:
  - Benutzeranzahl aus user_tenant_memberships
  - Fahrzeuganzahl aus vehicles (PROJ-5, vorerst 0)
```

### Sicherheit
- proxy.ts: Eingeloggt? Sonst → /login
- Jede API-Route: Rolle SUPERADMIN? Sonst → 403
- tenant_id kommt immer aus Server-Session, nie aus URL/Body
- Admin-Operationen via Service-Role-Client (bypassed RLS)
- Soft-Delete: status = 'inactive' statt physischem Löschen

### Tech-Entscheidungen
- TanStack Table client-seitig (Mandantenanzahl < 1000)
- Sheet für Bearbeiten (kein Seitenwechsel nötig)
- Slug auto-generiert aus Firmenname, editierbar

### Neue Abhängigkeiten
Keine — alle shadcn/ui-Komponenten bereits installiert

### API-Routes (Backend)
- GET /api/admin/tenants — alle Mandanten mit Zählung
- POST /api/admin/tenants — neuen Mandanten anlegen
- PATCH /api/admin/tenants/[id] — bearbeiten / aktivieren / deaktivieren
- POST /api/admin/tenants/[id]/invite — TENANT_ADMIN einladen

## Frontend Implementation Notes
**Built:** 2026-03-27

### Pages created (all under `src/app/(dashboard)/admin/tenants/`):
- `page.tsx` -- Tenant list with 3 stat cards (Gesamt/Aktiv/Inaktiv), search + status filter toolbar, TanStack Table with sorting/pagination, row actions (edit via Sheet, activate/deactivate via AlertDialog)
- `new/page.tsx` -- Create tenant form with auto-generated slug from company name, react-hook-form + zod validation
- `[id]/page.tsx` -- Tenant detail with two tabs: "Uebersicht" (stats + master data) and "Benutzer" (user list + invite dialog)

### Components created (`src/components/admin/`):
- `tenant-table.tsx` -- TanStack Table with columns: Name (link to detail), Slug, Status Badge, Benutzer #, Fahrzeuge #, Erstellt, Actions dropdown
- `tenant-form.tsx` -- Reusable form for create/edit with zod schema, slug auto-generation from Firmenname
- `tenant-status-badge.tsx` -- Green "Aktiv" / Red "Inaktiv" badge
- `invite-user-dialog.tsx` -- Sheet with email + role select (TENANT_ADMIN default), POST to `/api/admin/tenants/[id]/invite`

### Changes to existing files:
- `src/types/database.ts` -- Added `contact_email`, `address` fields to `Tenant` interface; added `TenantWithCounts` interface
- `src/lib/navigation.ts` -- Updated Superadmin nav hrefs from `/superadmin/*` to `/admin/*`; added "new" route label

### Key decisions:
- All pages check `user.role !== "SUPERADMIN"` client-side and redirect to `/dashboard`; API routes will also enforce this server-side
- Installed `@tanstack/react-table` for client-side table (tenant count < 1000)
- Edit uses Sheet overlay (no separate page), status toggle uses AlertDialog confirmation
- All text in German, all components use shadcn/ui primitives, full dark mode support
- API routes not yet built -- pages fetch from `/api/admin/tenants*` and handle loading/error states

## Backend Implementation Notes
**Built:** 2026-03-27

### DB Migration
- `supabase/migrations/20260327000002_proj3_tenant_extend.sql` -- Adds `contact_email TEXT` and `address TEXT` columns to `public.tenants`
- **NOTE:** Migration must be applied manually via Supabase Dashboard SQL Editor (CLI not linked). The SQL is: `ALTER TABLE public.tenants ADD COLUMN IF NOT EXISTS contact_email TEXT, ADD COLUMN IF NOT EXISTS address TEXT;`

### Shared auth helper
- `src/lib/auth-guard.ts` -- `requireSuperadmin()` and `requireAdminForTenant(tenantId)` functions that verify session + role, returning either a 401/403 NextResponse or an AuthGuardResult object. Uses service role client to bypass RLS for membership lookup.

### API Routes created

**`src/app/api/admin/tenants/route.ts`**
- GET: Returns all tenants with `user_count` (aggregated from `user_tenant_memberships`) and `vehicle_count: 0` (PROJ-5 placeholder). SUPERADMIN only. Uses service role client. Ordered by `created_at DESC`, limit 1000.
- POST: Creates new tenant. Zod-validated body `{ name, slug, contact_email?, address? }`. Checks slug uniqueness before insert. Returns 201 + created tenant.

**`src/app/api/admin/tenants/[id]/route.ts`**
- GET: Returns single tenant with full user list (join memberships + profiles + auth emails). SUPERADMIN only.
- PATCH: Updates tenant fields or toggles status. Zod-validated body `{ name?, slug?, contact_email?, address?, status? }`. Prevents deactivating a tenant where the caller has an active membership. Checks slug uniqueness on change.

**`src/app/api/admin/tenants/[id]/invite/route.ts`**
- POST: Invites user to tenant with role. Zod-validated body `{ email, role }`. SUPERADMIN or TENANT_ADMIN (for own tenant only). Uses `supabase.auth.admin.inviteUserByEmail`. Handles existing user case (reactivates membership or creates new one). Rolls back auth user if membership insert fails.

### Security measures
- All routes verify session via `supabase.auth.getUser()` before any processing
- Role checks use service role client to bypass RLS (avoids circular dependency)
- `tenant_id` always comes from route param `[id]`, never from request body
- All input validated with Zod schemas
- TENANT_ADMIN cannot assign SUPERADMIN role
- Deactivation guard prevents SUPERADMIN from locking themselves out

## QA Test Results

**Tested:** 2026-03-28
**Tester:** QA Engineer (AI) -- Code Review + Build Verification

### Acceptance Criteria Status

#### AC-1: SUPERADMIN-Bereich nur fuer SUPERADMIN zugaenglich (serverseitig)
- [x] All API routes use `requireSuperadmin()` guard
- [x] Frontend pages check `user.role !== "SUPERADMIN"` and redirect

#### AC-2: Superadmin-Uebersicht zeigt Mandantenname, Status, Fahrzeuge, Benutzer, Erstellungsdatum
- [x] GET /api/admin/tenants returns tenants with user_count
- [x] vehicle_count is hardcoded to 0 (placeholder until PROJ-5 vehicles table is queried)
- [ ] BUG: vehicle_count always returns 0 even though vehicles table exists (PROJ-5 implemented)

#### AC-3: Neuen Mandanten anlegen mit Pflichtfeldern
- [x] POST /api/admin/tenants validates with Zod: name, slug required; contact_email, address optional
- [x] Slug uniqueness checked before insert

#### AC-4: Mandant anlegen erstellt Eintrag mit Status active
- [x] Default status is "active" in the insert

#### AC-5: SUPERADMIN kann TENANT_ADMIN per E-Mail einladen
- [x] POST /api/admin/tenants/[id]/invite route exists
- [x] Uses Supabase inviteUserByEmail

#### AC-6: Mandant deaktivieren setzt Status auf inactive
- [x] PATCH /api/admin/tenants/[id] supports status update
- [x] Self-deactivation guard prevents locking self out

#### AC-7: Deaktivierter Mandant: Daten bleiben erhalten
- [x] Soft-delete pattern via status field, no DELETE operations

#### AC-8: Alle Datenbankabfragen erzwingen tenant_id
- [x] RLS policies in migration enforce tenant isolation
- [x] API routes filter by tenant_id

#### AC-9: RLS Policies verhindern Cross-Tenant-Zugriff
- [x] RLS enabled on tenants, profiles, user_tenant_memberships tables
- [x] Service role client used for admin operations (bypasses RLS intentionally)

#### AC-10: Superadmin kann Mandantendetails bearbeiten
- [x] PATCH route supports name, slug, contact_email, address, status updates

#### AC-11: Tabellenansicht mit Suche und Filter nach Status
- [x] Frontend has search input and status filter in toolbar
- [x] TanStack Table with sorting and pagination

### Bugs Found

#### BUG-PROJ3-1: vehicle_count always returns 0 in tenant list
- **Severity:** Medium
- **Steps to Reproduce:**
  1. Open /admin/tenants as SUPERADMIN
  2. Expected: Fahrzeuge column shows actual vehicle count per tenant
  3. Actual: Always shows 0 (hardcoded placeholder in GET /api/admin/tenants)
- **Priority:** Fix before deployment

### Summary
- **Acceptance Criteria:** 10/11 passed
- **Bugs Found:** 1 total (0 critical, 0 high, 1 medium, 0 low)
- **Production Ready:** NO -- vehicle count bug needs fixing

## Deployment
_To be added by /deploy_
