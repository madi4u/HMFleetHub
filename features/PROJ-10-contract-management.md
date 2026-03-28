# PROJ-10: Vertragsverwaltung

## Status: In Progress
**Created:** 2026-03-27
**Last Updated:** 2026-03-27

## Dependencies
- Requires: PROJ-5 (Fahrzeugstammdaten) — Verträge sind einem Fahrzeug zugeordnet
- Requires: PROJ-4 (Rollen & Rechte) — vehicles.contracts.view / edit

## Overview
Pro Fahrzeug können Leasing-, Finanzierungs- und Kaufverträge erfasst werden. Verträge beinhalten alle relevanten kaufmännischen Felder, können Dokumente anhängen und sind nur für berechtigte Rollen sichtbar. Bald endende Verträge erscheinen im Dashboard.

## User Stories
- Als FLEET_MANAGER möchte ich einen Leasingvertrag zu einem Fahrzeug anlegen mit allen relevanten Feldern.
- Als FLEET_MANAGER möchte ich Vertragsunterlagen (PDF) zum Vertrag hochladen.
- Als FLEET_MANAGER möchte ich alle Verträge eines Fahrzeugs in einem Tab der Fahrzeugakte sehen.
- Als FLEET_MANAGER möchte ich im Dashboard sehen, welche Verträge in den nächsten 60 Tagen auslaufen.
- Als WORKSHOP_MECHANIC darf ich keine Vertragsdaten sehen — weder über UI noch über API.
- Als OFFICE_USER möchte ich Verträge lesen aber nicht bearbeiten (konfigurierbar per Recht).

## Acceptance Criteria
- [ ] Vertragstypen: Leasing, Finanzierung, Barkauf
- [ ] Pflichtfelder: Vertragsart, Vertragsbeginn, Anbieter/Bank
- [ ] Optionale Felder: Vertragsende, monatliche Kosten, Kaufpreis, Finanzierungssumme, Restwert, Vertragsnummer, Kündigungsfrist, Status, Notizen
- [ ] Vertrag-Status-Werte: Aktiv, Abgelaufen, Gekündigt, Geplant
- [ ] Dokument-Upload: Vertragsunterlagen (PDF) anhängbar
- [ ] Fahrzeugakte Tab "Verträge": Zeigt alle Verträge des Fahrzeugs
- [ ] Vertragsdetail-Ansicht: Alle Felder + angehängte Dokumente
- [ ] Verträge sind nur sichtbar für Rollen mit `vehicles.contracts.view`
- [ ] API liefert Vertragsdaten nicht aus ohne das Recht (serverseitig geprüft)
- [ ] Dashboard-Widget: Verträge mit Vertragsende in den nächsten 60 Tagen
- [ ] Vertrag bearbeiten und löschen mit entsprechendem Recht
- [ ] Alle Verträge sind mandantenisoliert via `tenant_id`

## Edge Cases
- Was passiert, wenn Vertragsbeginn nach Vertragsende liegt? → Validierungsfehler im Formular
- Was passiert, wenn ein WORKSHOP_MECHANIC direkt die Vertrags-API aufruft? → 403 Forbidden
- Was passiert, wenn mehrere aktive Verträge für ein Fahrzeug existieren? → Erlaubt; Benutzer wird informiert
- Was passiert, wenn ein Vertragsdokument gelöscht wird? → Bestätigungsdialog; Storage-Datei wird ebenfalls gelöscht

## Technical Requirements
- Tabelle: `contracts` mit allen Pflichtfeldern (siehe PRD Abschnitt W)
- Storage-Pfad für Vertragsdokumente: `tenant/{tenantId}/contracts/{contractId}/{filename}`
- RLS: Nur Benutzer des eigenen Mandanten können Verträge lesen; zusätzlich App-seitige Rollenprüfung
- Index: `(vehicle_id, tenant_id)`, `(contract_end, tenant_id)` für Dashboard-Abfragen

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/fleet/[id]  →  Tab "Verträge"  (bisher Placeholder)
└── ContractsTab
    ├── Header: "Verträge" + "Vertrag hinzufügen" Button (mit vehicles.contracts.view+edit)
    ├── ContractCard × N
    │   ├── Vertragsart-Badge (Leasing/Finanzierung/Barkauf)
    │   ├── Status-Badge (Aktiv/Abgelaufen/Gekündigt/Geplant)
    │   ├── Kernfelder: Anbieter, Laufzeit, monatliche Kosten, Vertragsnummer
    │   ├── DocumentList: angehängte PDFs als Download-Links (+ Upload-Button)
    │   └── Aktionen: Bearbeiten (Sheet) | Löschen (AlertDialog)
    └── EmptyState: "Noch keine Verträge erfasst."

ContractSheet (create + edit):
    ├── Pflicht: Vertragsart*, Vertragsbeginn*, Anbieter/Bank*
    └── Optional: Vertragsende, monatl. Kosten, Kaufpreis, Finanzierungssumme,
                  Restwert, Vertragsnummer, Kündigungsfrist, Status, Notizen
```

### Datenmodell

```
contracts:
  id, tenant_id, vehicle_id
  contract_type (LEASING|FINANCING|PURCHASE)
  contract_status (ACTIVE|EXPIRED|CANCELLED|PLANNED) default ACTIVE
  provider TEXT NOT NULL
  contract_start DATE NOT NULL
  contract_end DATE
  monthly_cost NUMERIC(12,2)
  purchase_price NUMERIC(12,2)
  financing_amount NUMERIC(12,2)
  residual_value NUMERIC(12,2)
  currency TEXT default 'EUR'
  contract_number TEXT
  notice_period_days INTEGER
  notes TEXT
  created_at, updated_at

contract_documents:
  id, tenant_id, contract_id
  file_path, file_name, mime_type, file_size
  signed_url (generiert bei Abruf, 1h)
  created_at

Storage: vehicle-media bucket, Pfad tenant/{tenantId}/contracts/{contractId}/{filename}
Indexes: (vehicle_id, tenant_id), (contract_end, tenant_id)
```

### Tech-Entscheidungen
- Dokumente in separater `contract_documents` Tabelle (analog zu `vehicle_history_attachments`)
- Gleicher Storage-Bucket `vehicle-media` — separater Pfad reicht aus
- Bestehende `vehicles.contracts.view` Permission schützt alle Endpunkte (WORKSHOP_MECHANIC hat sie nicht)
- ContractSheet für Create + Edit (kein separates Formular)
- Löschen eines Vertrags: cascade auf Dokumente in DB + Storage-Cleanup

### API-Routes
- GET  /api/vehicles/[id]/contracts — Liste mit Dokumenten + signierten URLs
- POST /api/vehicles/[id]/contracts — Vertrag anlegen
- PATCH /api/vehicles/[id]/contracts/[contractId] — Bearbeiten
- DELETE /api/vehicles/[id]/contracts/[contractId] — Löschen + Storage-Cleanup
- POST /api/vehicles/[id]/contracts/[contractId]/documents — Dokument hochladen
- DELETE /api/vehicles/[id]/contracts/[contractId]/documents/[docId] — Dokument löschen

## QA Test Results

**Tested:** 2026-03-28
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI) -- Code Review + Build Verification

### Acceptance Criteria Status

#### AC-1: Vertragstypen (Leasing, Finanzierung, Barkauf)
- [x] Zod enum: LEASING, FINANCING, PURCHASE
- [ ] BUG (CRITICAL): No database migration exists for `contracts` or `contract_documents` tables. There is no migration file for PROJ-10. The API routes reference these tables but they do not exist in the database. All contract operations will fail with 500 errors.

#### AC-2: Pflichtfelder (Vertragsart, Vertragsbeginn, Anbieter)
- [x] Zod schema requires: contract_type, provider, contract_start
- [ ] BUG: DB table does not exist (see AC-1)

#### AC-3: Optionale Felder
- [x] All optional fields in Zod schema: contract_end, monthly_cost, purchase_price, financing_amount, residual_value, contract_number, notice_period_days, notes, currency
- [ ] BUG: DB table does not exist (see AC-1)

#### AC-4: Vertrag-Status-Werte
- [x] Zod enum: ACTIVE, EXPIRED, CANCELLED, PLANNED (default ACTIVE)

#### AC-5: Dokument-Upload
- [x] POST /api/vehicles/[id]/contracts/[contractId]/documents endpoint exists
- [ ] BUG: contract_documents DB table does not exist

#### AC-6: Fahrzeugakte Tab Vertraege
- [x] ContractsTab component exists in fleet/[id]/page.tsx
- [x] Fetches from /api/vehicles/[id]/contracts

#### AC-7: Vertragsdetail-Ansicht
- [x] ContractCard shows all fields + attached documents

#### AC-8: Vertraege nur sichtbar fuer vehicles.contracts.view
- [x] GET /api/vehicles/[id]/contracts uses `requirePermissionGuard("vehicles.contracts.view")`
- [x] WORKSHOP_MECHANIC lacks this permission -- gets 403

#### AC-9: API liefert Vertragsdaten nicht aus ohne Recht
- [x] Server-side permission check returns 403

#### AC-10: Dashboard-Widget fuer ablaufende Vertraege
- [x] Dashboard API queries contracts table for ACTIVE contracts with contract_end in next 60 days
- [ ] BUG: contracts table does not exist in DB -- dashboard contract widget will silently fail

#### AC-11: Vertrag bearbeiten und loeschen
- [x] PATCH and DELETE routes exist with vehicles.contracts.edit permission
- [x] DELETE includes storage cleanup for attached documents

#### AC-12: Mandantenisoliert via tenant_id
- [x] All queries filter by tenant_id from auth guard

### Edge Cases Status

#### EC-1: Vertragsbeginn nach Vertragsende
- [ ] BUG: No validation that contract_start < contract_end. Zod schema does not have cross-field validation.

#### EC-2: WORKSHOP_MECHANIC direkte API-Abfrage
- [x] Returns 403 -- vehicles.contracts.view required

#### EC-3: Mehrere aktive Vertraege pro Fahrzeug
- [x] Allowed -- no uniqueness constraint

#### EC-4: Vertragsdokument loeschen
- [x] DELETE /api/vehicles/[id]/contracts/[contractId]/documents/[docId] with AlertDialog confirmation
- [x] Storage cleanup on delete

### Security Audit Results
- [x] Authentication: All routes use requirePermissionGuard
- [x] Authorization: vehicles.contracts.view for GET, vehicles.contracts.edit for POST/PATCH/DELETE
- [x] Input validation: Zod schemas on all inputs
- [x] Tenant isolation: tenant_id always from session
- [ ] NOTE: Contract creation uses adminClient (bypasses RLS) but correctly sets tenant_id from auth guard

### Bugs Found

#### BUG-PROJ10-1: Missing database migration for contracts and contract_documents tables
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Navigate to /fleet/{id} -> Vertraege tab
  2. Click "Vertrag hinzufuegen"
  3. Fill form and submit
  4. Expected: Contract saved
  5. Actual: 500 error -- table "contracts" does not exist
- **Root Cause:** No migration file for PROJ-10 exists in supabase/migrations/
- **Impact:** ALL contract management functionality is broken. Dashboard expiring-contracts widget also fails.
- **Priority:** Must fix immediately

#### BUG-PROJ10-2: No cross-field validation for contract_start < contract_end
- **Severity:** Low
- **Steps to Reproduce:**
  1. Create contract with start date 2026-12-01 and end date 2026-01-01
  2. Expected: Validation error
  3. Actual: Accepted without error
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria:** 5/12 passed (7 fail due to missing migration)
- **Bugs Found:** 2 total (1 critical, 0 high, 0 medium, 1 low)
- **Security:** Good at code level, but DB schema missing entirely
- **Production Ready:** NO -- CRITICAL: missing database migration blocks all contract functionality

## Deployment
**Deployed:** 2026-03-28
**Production URL:** https://hm-fleethub.vercel.app
**Platform:** Vercel (project: hm-fleethub)
**Release:** v1.0.0
