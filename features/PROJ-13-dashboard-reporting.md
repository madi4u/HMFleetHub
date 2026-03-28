# PROJ-13: Dashboard & Reporting

## Status: In Progress
**Created:** 2026-03-27
**Last Updated:** 2026-03-28

## Dependencies
- Requires: PROJ-5 (Fahrzeugstammdaten) — Fahrzeugzahlen und Status
- Requires: PROJ-6 (Historienmodul) — letzte Aktivitäten, Reparaturen
- Requires: PROJ-7 (Werkstattansicht) — WORKSHOP_MECHANIC sieht kein Dashboard
- Requires: PROJ-8 (Kilometerstand- & Kosten) — Kostenauswertungen
- Requires: PROJ-9 (Reparaturen & Wartungen) — Folgetermine, offene Reparaturen
- Requires: PROJ-10 (Vertragsverwaltung) — bald endende Verträge
- Requires: PROJ-11 (DMS) — Aktivitäten
- Requires: PROJ-12 (Fahrzeugschein) — Vollständigkeit

## Overview
Das Dashboard bietet eine rollenbasierte Übersicht aller operativen und finanziellen Kennzahlen des Fuhrparks. WORKSHOP_MECHANIC hat kein Dashboard (wird direkt zur Werkstattansicht weitergeleitet). Alle Finanz-Widgets sind nur für berechtigte Rollen sichtbar.

## User Stories
- Als FLEET_MANAGER möchte ich auf dem Dashboard sofort sehen: Gesamtfahrzeuge, aktive Fahrzeuge, Fahrzeuge in Werkstatt.
- Als FLEET_MANAGER möchte ich sehen, welche Fahrzeuge in den nächsten 30 Tagen Wartungstermine haben.
- Als FLEET_MANAGER möchte ich die letzten Aktivitäten und zuletzt bearbeiteten Fahrzeuge sehen.
- Als FLEET_MANAGER möchte ich die Kostenentwicklung nach Monat als Diagramm sehen.
- Als FLEET_MANAGER möchte ich die Gesamtkosten je Fahrzeug im laufenden Monat, Jahr und über die gesamte Laufzeit sehen.
- Als FLEET_MANAGER möchte ich sehen, welche Verträge in den nächsten 60 Tagen auslaufen.
- Als TENANT_ADMIN möchte ich alle Dashboard-Kennzahlen meines Mandanten sehen.
- Als OFFICE_USER möchte ich operative Kennzahlen sehen, aber keine Finanzdaten.
- Als WORKSHOP_MECHANIC werde ich vom Dashboard direkt zur Werkstattansicht weitergeleitet.

## Acceptance Criteria

### Operative Widgets (für alle berechtigten Rollen)
- [ ] Gesamtzahl aller Fahrzeuge
- [ ] Anzahl aktiver Fahrzeuge
- [ ] Anzahl Fahrzeuge in Werkstatt
- [ ] Fahrzeuge mit bald fälligen Terminen (nächste 30 Tage)
- [ ] Letzte 10 Aktivitäten (Historienfeed-Einträge)
- [ ] Zuletzt bearbeitete 5 Fahrzeuge
- [ ] Letzte 5 Kilometerstands-Einträge

### Finanz-Widgets (nur `dashboard.financials.view`)
- [ ] Kosten pro Fahrzeug — aktueller Monat
- [ ] Kosten pro Fahrzeug — aktuelles Jahr
- [ ] Gesamtkosten je Fahrzeug über gesamte Historie
- [ ] Kostenentwicklung nach Monat (Liniendiagramm)
- [ ] Kostenentwicklung nach Kategorie (Balken- oder Donut-Diagramm)
- [ ] Top 5 Fahrzeuge mit höchsten Reparaturkosten
- [ ] Bald endende Verträge (nächste 60 Tage) mit monatlichen Kosten

### Rollenbasierte Sichtbarkeit
- [ ] WORKSHOP_MECHANIC: kein Dashboard — Redirect zur Werkstattansicht bei Login
- [ ] READ_ONLY: operative Widgets sichtbar, keine Finanz-Widgets
- [ ] OFFICE_USER: operative Widgets sichtbar, keine Finanz-Widgets (konfigurierbar)
- [ ] FLEET_MANAGER, TENANT_ADMIN, SUPERADMIN: alle Widgets

### Technische Anforderungen
- [ ] Dashboard-Daten werden server-seitig geladen (keine Client-seitigen Aggregationen über alle Datensätze)
- [ ] Alle Widgets sind mandantenisoliert
- [ ] Lade-Zustände (Skeleton) für alle Widgets

## Edge Cases
- Was passiert, wenn ein Mandant keine Fahrzeuge hat? → Widgets zeigen 0-Werte mit Hinweis "Noch keine Fahrzeuge angelegt"
- Was passiert, wenn die Datenbank-Query für Kostenauswertungen zu langsam ist? → Materialized View oder Index-optimierte Aggregations-Query; ggf. asynchrones Laden
- Was passiert, wenn ein WORKSHOP_MECHANIC die Dashboard-URL direkt aufruft? → Redirect zu `/workshop`
- Was passiert, wenn ein Benutzer kein `dashboard.financials.view`-Recht hat? → Finanz-Widgets werden nicht gerendert und auch nicht vom Server geladen

## Technical Requirements
- Views/Aggregationen: `vehicle_cost_summary` — aggregiert Kosten nach Fahrzeug, Monat, Jahr, Kategorie
- Performance: Dashboard-Endpunkte nutzen DB-Views oder materialized Views, keine N+1-Queries
- Charts: Recharts oder Chart.js, Dark-Mode-kompatibel konfiguriert
- SSR: Dashboard-Seite wird server-seitig gerendert mit rollenbasierter Datenauswahl

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Komponentenstruktur

```
/dashboard
└── DashboardPage (Client Component, lädt Daten nach Mount)
    ├── StatCards Row
    │   ├── Gesamtfahrzeuge | Aktiv | In Werkstatt | Bald fällig
    ├── OperativeSection
    │   ├── UpcomingMaintenanceList (nächste 30 Tage, aus next_due_date)
    │   ├── RecentActivityList (letzte 10 Historieneinträge)
    │   └── RecentMileageList (letzte 5 KM-Einträge)
    └── FinancialSection (nur dashboard.financials.view)
        ├── MonthlyCostChart (Recharts LineChart, letzte 12 Monate)
        ├── CostByCategoryChart (Recharts BarChart)
        ├── TopVehiclesCostTable (Top 5 nach Reparaturkosten)
        └── ExpiringContractsList (nächste 60 Tage)
```

### API-Design

```
GET /api/dashboard
  → Response-Struktur:
    operative: {
      fleet_stats: { total, active, in_workshop, due_soon }
      upcoming_maintenance: HistoryEntry[]  (next_due_date <= +30d)
      recent_activities: HistoryEntry[]     (letzte 10, mit Fahrzeug-Info)
      recent_mileage: MileageEntry[]        (letzte 5, mit Fahrzeug-Info)
    }
    financial?: {                           (nur wenn dashboard.financials.view)
      cost_this_month: number
      cost_this_year: number
      cost_total: number
      monthly_trend: { year, month, total_gross }[]  (12 Monate)
      by_category: { category, total_gross }[]
      top_vehicles: { vehicle_id, license_plate, make, model, total_gross }[]
      expiring_contracts: Contract[]        (contract_end <= +60d, mit Fahrzeug)
    }
```

### Tech-Entscheidungen
- Ein API-Endpunkt statt N Widget-Requests — ein DB-Round-Trip pro Pageload
- Recharts: Dark-Mode-kompatibel via `stroke` und `fill` CSS-Variablen (keine Tailwind-Klassen in SVG nötig)
- Client Component: Daten nach Mount geladen, Skeletons während Loading
- Keine materialized Views — Aggregationen via Supabase `rpc` oder direkte Queries sind für MVP ausreichend
- WORKSHOP_MECHANIC: wird bereits via `getDefaultRouteForRole` zu `/workshop` geleitet — kein extra Redirect nötig

### Charts
- `npm install recharts` — Recharts v2+, TypeScript-kompatibel
- LineChart für monatliche Kostenentwicklung (12 Monate x-Achse)
- BarChart für Kosten nach Kategorie
- Dark-Mode: Achsenfarben via `hsl(var(--muted-foreground))`, Grid via `hsl(var(--border))`

## Frontend Implementation Notes
- **Built:** 2026-03-28
- All 7 dashboard components created in `src/components/dashboard/`
- `StatCard` — reusable stat card with icon and variant coloring (default/warning/danger)
- `MonthlyCostChart` — Recharts LineChart with dark-mode CSS variable colors
- `CostByCategoryChart` — Recharts BarChart with German category labels
- `UpcomingMaintenanceList` — color-coded by urgency (red overdue, yellow <=14d)
- `RecentActivityList` — links to vehicle, shows time ago via date-fns German locale
- `ExpiringContractsList` — responsive table with red highlight for contracts ending <=14d
- `DashboardSkeleton` — skeleton matching full dashboard grid layout
- Dashboard page (`src/app/(dashboard)/dashboard/page.tsx`) fetches from `GET /api/dashboard`
- Financial section gated by `hasPermission(role, "dashboard.financials.view")`
- Error state and empty state implemented
- Pre-existing build error in `mileage-section.tsx` fixed (z.coerce type mismatch with standardSchemaResolver)

## Backend Implementation Notes (2026-03-28)
- Added dashboard types to `src/types/database.ts`: `FleetStats`, `DashboardRecentActivity`, `DashboardRecentMileage`, `DashboardTopVehicle`, `DashboardExpiringContract`, `DashboardData`
- Created `GET /api/dashboard` route at `src/app/api/dashboard/route.ts`
- Auth: uses `requirePermissionGuard("dashboard.view")` -- WORKSHOP_MECHANIC lacks this permission and receives 403
- Financial section: conditionally loaded only when `hasPermission(role, "dashboard.financials.view")` returns true
- All queries scoped by `tenant_id` via admin client (bypasses RLS, filters manually)
- Author names resolved from `profiles` table via admin client
- Cost aggregations (monthly trend, by category, top vehicles) computed in TypeScript from raw cost entries
- Expiring contracts query filters `contract_status = 'ACTIVE'` and `contract_end` within next 60 days
- No new DB tables or migrations required
- Fixed pre-existing Recharts `formatter` type errors in `cost-by-category-chart.tsx` and `monthly-cost-chart.tsx`

## QA Test Results

**Tested:** 2026-03-28
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI) -- Code Review + Build Verification

### Acceptance Criteria Status

### Operative Widgets

#### AC-OP-1: Gesamtzahl aller Fahrzeuge
- [x] fleet_stats.total from vehicles table

#### AC-OP-2: Anzahl aktiver Fahrzeuge
- [x] fleet_stats.active filters by status === "Aktiv"

#### AC-OP-3: Anzahl Fahrzeuge in Werkstatt
- [x] fleet_stats.in_workshop filters by status === "In Werkstatt"

#### AC-OP-4: Fahrzeuge mit bald faelligen Terminen (naechste 30 Tage)
- [x] fleet_stats.due_soon counts entries with next_due_date within 30 days and repair_status != DONE
- [ ] BUG: Queries next_due_date and repair_status columns which do not exist in DB (missing PROJ-9 migration). Will return 0 or error silently.

#### AC-OP-5: Letzte 10 Aktivitaeten
- [x] recent_activities fetches last 10 history entries with vehicle joins and author names

#### AC-OP-6: Zuletzt bearbeitete 5 Fahrzeuge
- [ ] BUG: Not implemented. The spec requires "Zuletzt bearbeitete 5 Fahrzeuge" but the dashboard API does not return this data. The tech design also omits it in favor of recent_activities and recent_mileage.

#### AC-OP-7: Letzte 5 Kilometerstand-Eintraege
- [x] recent_mileage fetches last 5 from mileage_entries with vehicle joins

### Finanz-Widgets

#### AC-FIN-1: Kosten pro Fahrzeug aktueller Monat
- [x] cost_this_month calculated from cost entries

#### AC-FIN-2: Kosten pro Fahrzeug aktuelles Jahr
- [x] cost_this_year calculated from cost entries

#### AC-FIN-3: Gesamtkosten je Fahrzeug gesamte Historie
- [x] cost_total calculated from all cost entries

#### AC-FIN-4: Kostenentwicklung nach Monat (Liniendiagramm)
- [x] monthly_trend returns last 12 months
- [x] MonthlyCostChart uses Recharts LineChart

#### AC-FIN-5: Kostenentwicklung nach Kategorie
- [x] by_category from cost entries
- [x] CostByCategoryChart uses Recharts BarChart

#### AC-FIN-6: Top 5 Fahrzeuge mit hoechsten Reparaturkosten
- [x] top_vehicles sorted by total_gross, top 5

#### AC-FIN-7: Bald endende Vertraege (naechste 60 Tage)
- [x] Dashboard queries contracts table for ACTIVE with contract_end in next 60 days
- [x] ExpiringContractsList component
- [ ] BUG: contracts table does not exist in DB (missing PROJ-10 migration). Query will fail or be silently empty.

### Rollenbasierte Sichtbarkeit

#### AC-ROLE-1: WORKSHOP_MECHANIC kein Dashboard
- [x] Dashboard API uses `requirePermissionGuard("dashboard.view")` -- WORKSHOP_MECHANIC lacks this permission (403)
- [x] getDefaultRouteForRole redirects mechanic to /workshop

#### AC-ROLE-2: READ_ONLY keine Finanz-Widgets
- [x] READ_ONLY lacks dashboard.financials.view -- financial section not loaded

#### AC-ROLE-3: OFFICE_USER keine Finanz-Widgets
- [x] OFFICE_USER lacks dashboard.financials.view

#### AC-ROLE-4: FLEET_MANAGER, TENANT_ADMIN, SUPERADMIN alle Widgets
- [x] These roles have both dashboard.view and dashboard.financials.view

### Technische Anforderungen

#### AC-TECH-1: Server-seitig geladen
- [x] Dashboard page is client component that fetches from single GET /api/dashboard endpoint
- [x] All aggregations done server-side in TypeScript (no client-side aggregation over all records)

#### AC-TECH-2: Mandantenisoliert
- [x] All queries scoped by tenant_id

#### AC-TECH-3: Lade-Zustaende (Skeleton)
- [x] DashboardSkeleton component matches full grid layout

### Edge Cases Status

#### EC-1: Mandant ohne Fahrzeuge
- [x] Widgets show 0 values, empty lists

#### EC-2: Langsame Kostenabfragen
- [x] All aggregation in TypeScript from raw entries -- acceptable for MVP volume. No materialized views.

#### EC-3: WORKSHOP_MECHANIC Dashboard-URL
- [x] Gets 403 from API. Navigation redirects to /workshop.
- [ ] NOTE: If mechanic navigates to /dashboard directly, the page shell loads but API returns 403 and error state shows.

#### EC-4: Kein dashboard.financials.view Recht
- [x] Financial section not rendered; API does not load financial data

### Security Audit Results
- [x] Authentication: requirePermissionGuard("dashboard.view")
- [x] Authorization: Financial data gated by dashboard.financials.view
- [x] Tenant isolation: All queries scoped by tenant_id
- [x] No cross-tenant data leakage
- [ ] NOTE: Dashboard uses adminClient which bypasses RLS -- this is acceptable because tenant_id filtering is done manually in every query

### Bugs Found

#### BUG-PROJ13-1: Dashboard fails on next_due_date/repair_status queries (missing PROJ-9 migration)
- **Severity:** High
- **Steps to Reproduce:**
  1. Navigate to /dashboard as FLEET_MANAGER
  2. Expected: Dashboard loads with all widgets including "bald faellige Termine"
  3. Actual: The due_soon count and upcoming_maintenance queries reference next_due_date and repair_status columns that do not exist. Depending on Supabase error handling, this either returns 0/empty or causes a 500 for the entire dashboard.
- **Priority:** Blocked by BUG-PROJ9-1 (missing migration). Fix PROJ-9 migration first.

#### BUG-PROJ13-2: Dashboard contract widget fails (missing PROJ-10 migration)
- **Severity:** High
- **Steps to Reproduce:**
  1. Navigate to /dashboard as FLEET_MANAGER with dashboard.financials.view
  2. Expected: Expiring contracts widget shows contracts ending within 60 days
  3. Actual: contracts table does not exist -- query fails or returns empty
- **Priority:** Blocked by BUG-PROJ10-1. Fix PROJ-10 migration first.

#### BUG-PROJ13-3: "Zuletzt bearbeitete 5 Fahrzeuge" widget missing
- **Severity:** Low
- **Steps to Reproduce:**
  1. Open dashboard
  2. Expected: Widget showing 5 recently edited vehicles
  3. Actual: Not implemented in API or frontend
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria:** 17/22 passed (code review)
- **Bugs Found:** 3 total (0 critical, 2 high, 0 medium, 1 low)
- **Security:** Good -- proper role gating
- **Production Ready:** NO -- dashboard partially broken due to missing PROJ-9 and PROJ-10 migrations

## Deployment
_To be added by /deploy_
