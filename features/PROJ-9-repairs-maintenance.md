# PROJ-9: Reparaturen, Wartungen & Schäden

## Status: In Progress
**Created:** 2026-03-27
**Last Updated:** 2026-03-27

## Dependencies
- Requires: PROJ-5 (Fahrzeugstammdaten) — Fahrzeug-Kontext
- Requires: PROJ-6 (Historienmodul) — Reparaturen/Wartungen als Historieneinträge mit Typ REPAIR/MAINTENANCE/DAMAGE

## Overview
Reparaturen, Wartungen und Schäden werden als strukturierte Historieneinträge mit spezifischen Typen erfasst. Sie sind sowohl im zentralen Historienfeed sichtbar als auch separat auswertbar. Jeder Eintrag kann mit Status, Folgeterm, Werkstatt und Anhängen versehen werden.

## User Stories
- Als WORKSHOP_MECHANIC möchte ich eine Reparatur dokumentieren: Beschreibung, Kilometerstand, Fotos, Kosten, Werkstatt.
- Als FLEET_MANAGER möchte ich alle Reparaturen eines Fahrzeugs strukturiert auswerten (Anzahl, Kosten, Datum).
- Als FLEET_MANAGER möchte ich Wartungen mit Folgeterminen erfassen, damit nichts vergessen wird.
- Als FLEET_MANAGER möchte ich Schäden dokumentieren mit Fotos als Nachweis.
- Als FLEET_MANAGER möchte ich offene Reparaturen (Status: Offen) von abgeschlossenen unterscheiden.
- Als Benutzer möchte ich aus dem Historienfeed direkt zu einem strukturierten Reparatureintrag navigieren.

## Acceptance Criteria
- [ ] Reparaturerfassung: Typ (REPAIR/MAINTENANCE/DAMAGE), Beschreibung, Datum, Werkstatt/Dienstleister, Kosten, Rechnungsnummer, Anhänge, Status, nächster Folgetermin
- [ ] Status-Werte: Offen, In Bearbeitung, Abgeschlossen
- [ ] Folgetermin-Feld: Datum für nächste Wartung oder Wiedervorstellung
- [ ] Reparaturen erscheinen im Historienfeed mit Typ-Badge REPAIR/MAINTENANCE/DAMAGE
- [ ] Fahrzeugdetail-Tab "Auswertungen": Liste aller Reparaturen und Wartungen sortiert nach Datum
- [ ] Offene Reparaturen / bald fällige Wartungen im Dashboard hervorgehoben (PROJ-13)
- [ ] Kosten aus Reparaturen fließen in die Kostenauswertung ein (PROJ-8)
- [ ] Schadensdokumentation: Pflichtfeld Foto, optionales Feld Schadenshergang-Text
- [ ] Anhänge: Fotos vom Schaden, Reparaturrechnung als PDF
- [ ] Alle Einträge sind mandantenisoliert

## Edge Cases
- Was passiert, wenn ein Folgetermin in der Vergangenheit liegt? → Warnung: "Folgetermin liegt in der Vergangenheit", kein Blocking
- Was passiert, wenn kein Foto bei einer Schadensmeldung hochgeladen wird? → Erlaubt, aber empfohlene Warnung: "Foto empfohlen für Schadensdokumentation"
- Was passiert, wenn Kosten ohne Berechtigung abgefragt werden? → Felder werden im Response nicht ausgeliefert

## Technical Requirements
- Kein separates Tabellen-Modell für Reparaturen — werden als `vehicle_history_entries` mit `entry_type = 'REPAIR' | 'MAINTENANCE' | 'DAMAGE'` gespeichert
- Zusätzliche strukturierte Felder in `vehicle_history_entries`: `status`, `next_due_date`, `workshop_name`
- Folgetermin-Index für Dashboard-Abfragen: `INDEX ON vehicle_history_entries(next_due_date) WHERE next_due_date IS NOT NULL`
- Auswertungs-View: `vehicle_repairs_summary` — aggregiert nach Fahrzeug, Typ, Monat

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Kein neues Datenmodell — Erweiterung bestehender Tabelle

PROJ-9 baut vollständig auf `vehicle_history_entries` aus PROJ-6 auf. Keine neuen Tabellen erforderlich.

```
vehicle_history_entries (ALTER TABLE):
  + repair_status TEXT  CHECK ('OPEN','IN_PROGRESS','DONE')  -- NULL = kein Status relevant
  + next_due_date DATE                                        -- nächster Folgetermin
  workshop_name → bereits als "supplier"-Feld vorhanden (wiederverwendet)

INDEX ON vehicle_history_entries(next_due_date) WHERE next_due_date IS NOT NULL
```

### Komponentenstruktur

```
/fleet/[id]  →  Tab "Auswertungen"
└── CostSummaryTab (PROJ-8, bestehend)
└── RepairsMaintenanceSection (neu, PROJ-9)
    ├── Filter-Tabs: Alle | Reparaturen | Wartungen | Schäden
    ├── RepairEntryRow × N (sortiert nach event_date DESC)
    │   ├── EntryTypeBadge + repair_status Badge
    │   ├── Datum, Titel/Beschreibung, Werkstatt
    │   ├── Kilometerstand, Kosten (wenn berechtigt)
    │   └── Folgetermin (hervorgehoben wenn nahe/überfällig)
    └── EmptyState

history-entry-input.tsx (PROJ-6, Erweiterung):
    └── OptionalFieldsExpander + Felder für REPAIR/MAINTENANCE/DAMAGE:
        ├── repair_status Select (Offen | In Bearbeitung | Abgeschlossen)
        ├── next_due_date DateInput (Folgetermin)
        └── supplier/Werkstatt-Feld ist bereits vorhanden
```

### Tech-Entscheidungen
- `workshop_name` wird auf vorhandenes `supplier`-Feld gemappt — kein Datenbankduplizierung
- `repair_status` NULL bedeutet "kein Status" (z.B. bei NOTE/MILEAGE_UPDATE irrelevant)
- GET `/api/vehicles/[id]/history` erhält optionalen `types`-Parameter (kommagetrennt) für Multi-Typ-Filter
- RepairsMaintenanceSection holt Daten via `?types=REPAIR,MAINTENANCE,DAMAGE` — kein separater Endpoint nötig
- Folgetermin-Warnung: Eintrag `next_due_date` <= heute + 14 Tage → gelber Badge; überfällig → roter Badge

### API-Änderungen
- GET /api/vehicles/[id]/history: `type`-Parameter erweitern auf `types` (kommagetrennt, rückwärtskompatibel)
- POST/PATCH Schemas: `repair_status` + `next_due_date` hinzufügen

## QA Test Results

**Tested:** 2026-03-28
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI) -- Code Review + Build Verification

### Acceptance Criteria Status

#### AC-1: Reparaturerfassung mit erweiterten Feldern
- [x] Zod schema includes repair_status (OPEN, IN_PROGRESS, DONE), next_due_date
- [x] supplier field already exists in history entries (reused as workshop_name)
- [ ] BUG (CRITICAL): No database migration exists for `repair_status` and `next_due_date` columns. The PROJ-6 migration creates vehicle_history_entries WITHOUT these columns. The PROJ-8 migration adds `cost_category` but not `repair_status` or `next_due_date`. There is NO PROJ-9 migration file. The API Zod schema accepts these fields and tries to insert them, but the DB columns do not exist. This will cause runtime errors (500) on any entry that includes repair_status or next_due_date.

#### AC-2: Status-Werte (Offen, In Bearbeitung, Abgeschlossen)
- [x] Zod enum: OPEN, IN_PROGRESS, DONE
- [ ] BUG: DB column does not exist (see AC-1)

#### AC-3: Folgetermin-Feld
- [x] next_due_date in Zod schema as optional string
- [ ] BUG: DB column does not exist (see AC-1)

#### AC-4: Reparaturen im Historienfeed mit Typ-Badge
- [x] EntryTypeBadge handles REPAIR, MAINTENANCE, DAMAGE types

#### AC-5: Fahrzeugdetail-Tab Auswertungen zeigt Reparaturen/Wartungen
- [x] RepairsMaintenanceSection component exists
- [x] Fetches via `?types=REPAIR,MAINTENANCE,DAMAGE`
- [x] Includes filter tabs (Alle, Reparaturen, Wartungen, Schaeden)

#### AC-6: Offene Reparaturen / bald faellige Wartungen im Dashboard
- [x] Dashboard queries vehicle_history_entries for next_due_date within 30 days
- [ ] BUG: Dashboard query references next_due_date and repair_status columns that do not exist in the DB. This will cause the dashboard to error or return empty results.

#### AC-7: Kosten aus Reparaturen fliessen in Kostenauswertung
- [x] Cost aggregation in /api/vehicles/[id]/costs includes all history entries with cost_gross != null

#### AC-8: Schadensdokumentation mit Foto
- [x] History entries support attachments
- [ ] NOTE: Spec says "Pflichtfeld Foto" for DAMAGE type, but there is no backend validation that DAMAGE entries must have an attachment. Frontend shows recommendation only.

#### AC-9: Anhaenge (Fotos, Reparaturrechnung PDF)
- [x] Attachment upload supports image/* and application/pdf

#### AC-10: Alle Eintraege mandantenisoliert
- [x] All queries scoped by tenant_id

### Edge Cases Status

#### EC-1: Folgetermin in Vergangenheit
- [x] Frontend DueDateDisplay shows "Ueberfaellig" for past dates (red badge)
- [x] No blocking -- entry is saved

#### EC-2: Kein Foto bei Schadensmeldung
- [x] Allowed -- no backend enforcement
- [ ] NOTE: Missing recommended warning in UI for DAMAGE without photo

#### EC-3: Kosten ohne Berechtigung
- [x] Cost fields gated by canViewFinancials prop in RepairsMaintenanceSection

### Security Audit Results
- [x] Authentication: Uses existing history API routes with permission guards
- [x] Authorization: Proper permission checks
- [x] Tenant isolation: Maintained

### Bugs Found

#### BUG-PROJ9-1: Missing database migration for repair_status and next_due_date columns
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Try to create a history entry with repair_status: "OPEN" or next_due_date: "2026-04-15"
  2. Expected: Entry saved with these fields
  3. Actual: Supabase returns 500 error because columns do not exist in vehicle_history_entries table
- **Root Cause:** No migration file for PROJ-9. Only 5 migrations exist: PROJ-1, PROJ-3, PROJ-5, PROJ-6, PROJ-8. The PROJ-9 spec requires ALTER TABLE to add repair_status and next_due_date.
- **Impact:** All PROJ-9 functionality is broken. Dashboard upcoming maintenance widget (PROJ-13) also fails because it queries next_due_date.
- **Priority:** Must fix immediately -- blocks all PROJ-9 functionality

#### BUG-PROJ9-2: No enforcement that DAMAGE entries should have a photo
- **Severity:** Low
- **Steps to Reproduce:** Create a DAMAGE entry without any attachments
- **Expected:** Warning message (spec says "Pflichtfeld Foto")
- **Actual:** No warning shown
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria:** 6/10 passed (4 fail due to missing migration)
- **Bugs Found:** 2 total (1 critical, 0 high, 0 medium, 1 low)
- **Security:** Good at code level, but DB schema incomplete
- **Production Ready:** NO -- CRITICAL: missing database migration blocks all repair/maintenance functionality

## Deployment
**Deployed:** 2026-03-28
**Production URL:** https://hm-fleethub.vercel.app
**Platform:** Vercel (project: hm-fleethub)
**Release:** v1.0.0
