# PROJ-8: Kilometerstand- & Kostenerfassung

## Status: In Progress
**Created:** 2026-03-27
**Last Updated:** 2026-03-27

## Dependencies
- Requires: PROJ-5 (Fahrzeugstammdaten) — Fahrzeug-Kontext
- Requires: PROJ-6 (Historienmodul) — Kosten und Kilometerstand als Teil von Historieneinträgen

## Overview
Kilometerstände können sowohl direkt als auch über Historieneinträge erfasst werden. Kosten werden an kostenrelevanten Historieneinträgen erfasst und sind nach Monat, Jahr, Fahrzeug und Kategorie auswertbar. Nur berechtigte Rollen sehen Finanzdaten.

## User Stories
- Als WORKSHOP_MECHANIC möchte ich beim Erstellen eines Historieneintrags den aktuellen Kilometerstand eingeben.
- Als FLEET_MANAGER möchte ich den Kilometerstand direkt am Fahrzeug aktualisieren ohne einen Historieneintrag zu erstellen.
- Als FLEET_MANAGER möchte ich die Kilometerstand-Historie eines Fahrzeugs als Liste sehen.
- Als FLEET_MANAGER möchte ich Kosten an einem Historieneintrag erfassen (netto, brutto, Währung, Lieferant, Rechnungsnummer).
- Als FLEET_MANAGER möchte ich Kosten nach Kategorie erfassen (Reparatur, Wartung, Öl, Reifen, etc.).
- Als FLEET_MANAGER möchte ich Kosten pro Fahrzeug monatlich, jährlich und über die gesamte Laufzeit auswerten.
- Als OFFICE_USER möchte ich Kosten einsehen, aber keine Fahrzeugdaten bearbeiten.
- Als WORKSHOP_MECHANIC kann ich Kosten erfassen, wenn die Berechtigung `vehicles.financials.view` für mich aktiviert ist.

## Acceptance Criteria
- [ ] Kilometerstand-Eintrag: Datum, Kilometerstand, Quelle/Bemerkung, Benutzer werden gespeichert
- [ ] Mehrere Kilometerstände pro Fahrzeug möglich; Chronologie wird angezeigt
- [ ] Neuer Kilometerstand < vorheriger → Warnung wird angezeigt; Eintrag trotzdem speicherbar mit Bestätigung
- [ ] `current_mileage` auf `vehicles`-Tabelle wird automatisch aktualisiert, wenn neuer Kilometerstand gespeichert wird
- [ ] Kilometerstand kann über Historieneintrag (Feld `mileage`) oder direkt als separaten Eintrag erfasst werden
- [ ] Kostenerfassung: `cost_net`, `cost_gross`, `currency` (default EUR), `supplier`, `invoice_number`, `cost_category`
- [ ] Kostenkategorien: REPAIR, MAINTENANCE, OIL, TIRES, INSPECTION, BODYWORK, ELECTRICAL, OTHER
- [ ] Kosten-Felder sind optional — nicht jeder Historieneintrag hat Kosten
- [ ] Kosten nur sichtbar für Rollen mit `vehicles.financials.view`-Berechtigung
- [ ] Auswertung: Gesamtkosten pro Fahrzeug (monatlich, jährlich, kumuliert)
- [ ] Auswertung: Kosten nach Kategorie pro Fahrzeug
- [ ] Auswertung-Daten werden nur an berechtigte Rollen ausgeliefert (serverseitig)

## Edge Cases
- Was passiert, wenn cost_gross kleiner als cost_net eingegeben wird? → Validierungsfehler: "Brutto darf nicht kleiner als Netto sein"
- Was passiert, wenn ein Kilometerstand deutlich zu hoch erscheint (z. B. Zahlendreher 999999)? → Keine automatische Blockierung; Benutzer ist verantwortlich — optionale Warnung bei Sprüngen > 50.000 km
- Was passiert, wenn die Währung nicht EUR ist? → Währungsfeld frei wählbar; Auswertungen zeigen Währung je Eintrag; keine automatische Umrechnung
- Was passiert, wenn Kosten ohne Benutzer-Berechtigung über die API abgerufen werden? → API gibt diese Felder nicht zurück (null/nicht vorhanden in Response)

## Technical Requirements
- Tabelle: `mileage_entries` mit `vehicle_id`, `tenant_id`, `mileage`, `recorded_at`, `source`, `notes`, `user_id`
- Kostenfelder direkt in `vehicle_history_entries`: `cost_net`, `cost_gross`, `currency`, `supplier`, `invoice_number`, `cost_category`
- Trigger: Nach neuem Kilometerstand-Eintrag → Update `vehicles.current_mileage` automatisch
- Auswertungen: Views oder aggregierte Queries für Dashboard (PROJ-13)
- Zugriffsschutz: Response-Builder filtert `cost_*`-Felder bei fehlendem `vehicles.financials.view`-Recht

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponenten & Seitenstruktur

```
/fleet/[id]  →  Tab "Stammdaten"
└── (bestehend) + MileageSection
    ├── Aktueller Kilometerstand + "Kilometerstand aktualisieren" Button
    └── MileageHistoryList (chronologisch, neueste zuerst)

/fleet/[id]  →  Tab "Auswertungen"  (bisher Placeholder)
└── CostSummaryTab
    ├── CostTotalCard (Gesamtkosten kumuliert)
    ├── CostByCategoryChart (Balken je Kategorie)
    └── CostByMonthList (monatliche Aufschlüsselung, neueste zuerst)
```

### Datenmodell

```
mileage_entries (neu):
  id, tenant_id, vehicle_id, user_id
  mileage (INTEGER), recorded_at (TIMESTAMPTZ), source, notes
  created_at

vehicle_history_entries (Spalte ergänzen):
  + cost_category TEXT (REPAIR|MAINTENANCE|OIL|TIRES|INSPECTION|BODYWORK|ELECTRICAL|OTHER)

Trigger:
  Nach INSERT in mileage_entries → UPDATE vehicles SET current_mileage = new.mileage
  WHERE new.mileage > current_mileage (oder immer, da Warnung in UI)

  Nach INSERT/UPDATE in vehicle_history_entries mit mileage IS NOT NULL
  → UPDATE vehicles SET current_mileage = new.mileage WHERE new.mileage > current_mileage
```

### Tech-Entscheidungen
- `mileage_entries` trennt direkte KM-Einträge von Historieneinträgen — beide aktualisieren `vehicles.current_mileage`
- `cost_category` als ALTER TABLE auf bestehender `vehicle_history_entries` (kein neues Datenmodell)
- Kosten-Aggregation: Server-seitige SQL-Aggregation — kein Client-Download aller Einträge
- Feldrecht: `vehicles.financials.view` schützt alle Kosten-Endpunkte — 403 für WORKSHOP_MECHANIC
- Auswertungen: Auswertungen-Tab im Fahrzeugdetail wird mit CostSummaryTab befüllt (nicht mehr Placeholder)

### API-Routes
- GET  /api/vehicles/[id]/mileage — Kilometerstand-Verlauf (paginiert)
- POST /api/vehicles/[id]/mileage — Neuen Kilometerstand erfassen
- GET  /api/vehicles/[id]/costs   — Aggregierte Kosten (Rollen-Check vehicles.financials.view)

## QA Test Results

**Tested:** 2026-03-28
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI) -- Code Review + Build Verification

### Acceptance Criteria Status

#### AC-1: Kilometerstand-Eintrag speichert Datum, KM, Quelle, Benutzer
- [x] POST /api/vehicles/[id]/mileage: Zod schema validates mileage (int, min 0), recorded_at, source, notes
- [x] user_id set from auth guard

#### AC-2: Mehrere Kilometerstaende pro Fahrzeug, Chronologie
- [x] GET /api/vehicles/[id]/mileage returns paginated list ordered by recorded_at DESC

#### AC-3: Neuer KM < vorheriger zeigt Warnung
- [x] POST response includes `previousMileage` field for frontend comparison
- [x] Frontend MileageSection shows alert when entered mileage < currentMileage

#### AC-4: current_mileage auf vehicles wird automatisch aktualisiert
- [x] DB trigger `trg_update_vehicle_mileage` fires AFTER INSERT on mileage_entries
- [x] DB trigger `trg_update_vehicle_mileage_from_history` fires AFTER INSERT/UPDATE on vehicle_history_entries
- [x] Both triggers only update if new mileage >= current_mileage

#### AC-5: KM ueber Historieneintrag oder separaten Eintrag
- [x] History entry has `mileage` field (PROJ-6)
- [x] Separate mileage_entries table with own endpoint

#### AC-6: Kostenerfassung Felder
- [x] History entry schema includes cost_net, cost_gross, currency, supplier, invoice_number
- [x] cost_category added via migration

#### AC-7: Kostenkategorien
- [x] 8 categories in Zod enum: REPAIR, MAINTENANCE, OIL, TIRES, INSPECTION, BODYWORK, ELECTRICAL, OTHER
- [x] DB CHECK constraint matches

#### AC-8: Kosten-Felder sind optional
- [x] All cost fields are `.optional().nullable()` in Zod schema

#### AC-9: Kosten nur sichtbar fuer Rollen mit vehicles.financials.view
- [x] GET /api/vehicles/[id]/costs uses `requirePermissionGuard("vehicles.financials.view")`
- [x] WORKSHOP_MECHANIC gets 403

#### AC-10: Auswertung: Gesamtkosten pro Fahrzeug (monatlich, jaehrlich, kumuliert)
- [x] GET /api/vehicles/[id]/costs returns total_net, total_gross, by_month array

#### AC-11: Auswertung: Kosten nach Kategorie
- [x] GET /api/vehicles/[id]/costs returns by_category array

#### AC-12: Auswertung-Daten nur an berechtigte Rollen
- [x] requirePermissionGuard("vehicles.financials.view") on costs endpoint
- [x] CostSummaryTab component on frontend

### Edge Cases Status

#### EC-1: cost_gross < cost_net
- [ ] BUG: No validation that cost_gross >= cost_net. The Zod schema only validates min(0) for both fields. Spec says "Brutto darf nicht kleiner als Netto sein."

#### EC-2: Extrem hoher Kilometerstand (Zahlendreher)
- [x] No automatic blocking -- user responsibility. Frontend mileage warning for large jumps.

#### EC-3: Waehrung nicht EUR
- [x] Currency field is freetext (3 chars), no automatic conversion

#### EC-4: Kosten ohne Berechtigung via API
- [x] Costs endpoint returns 403 for unauthorized roles

### Security Audit Results
- [x] Authentication: All routes require auth
- [x] Authorization: Mileage read uses vehicles.list, write uses vehicles.edit; costs uses vehicles.financials.view
- [x] Tenant isolation: All queries scoped by tenant_id
- [x] Input validation: Zod schemas on all inputs
- [ ] NOTE: POST /api/vehicles/[id]/mileage requires `vehicles.edit` permission -- WORKSHOP_MECHANIC lacks this. Mechanic can only add mileage via history entries, not the direct mileage endpoint. This may be intentional but conflicts with the user story "WORKSHOP_MECHANIC moechte beim Erstellen eines Historieneintrags den aktuellen Kilometerstand eingeben."

### Bugs Found

#### BUG-PROJ8-1: No validation that cost_gross >= cost_net
- **Severity:** Low
- **Steps to Reproduce:**
  1. Create history entry with cost_net: 100, cost_gross: 50
  2. Expected: Validation error "Brutto darf nicht kleiner als Netto sein"
  3. Actual: Entry saved without error
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria:** 12/12 passed
- **Bugs Found:** 1 total (0 critical, 0 high, 0 medium, 1 low)
- **Security:** Good -- proper permission checks
- **Production Ready:** YES (conditionally) -- no blocking bugs

## Deployment
**Deployed:** 2026-03-28
**Production URL:** https://hm-fleethub.vercel.app
**Platform:** Vercel (project: hm-fleethub)
**Release:** v1.0.0
