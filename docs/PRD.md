# Product Requirements Document — H+M FleetHub

## Vision
H+M FleetHub ist eine mandantenfähige Fuhrparkmanagement-Web-App für Unternehmen, die ihre Fahrzeuge, Dokumente, Historien, Verträge und Werkstattprozesse digital verwalten möchten. Die Anwendung löst das Problem verteilter, papierbasierter Fahrzeugakten durch ein zentrales, rollenbasiertes System mit einem chronologischen Historienfeed als operativem Herzstück.

## Target Users

| Rolle | Beschreibung | Hauptbedarf |
|-------|-------------|-------------|
| SUPERADMIN | Globaler Plattform-Administrator | Mandanten anlegen, verwalten, System überwachen |
| TENANT_ADMIN | Admin innerhalb eines Mandanten | Benutzer verwalten, Fuhrpark konfigurieren |
| FLEET_MANAGER | Fuhrparkverantwortlicher | Fahrzeuge, Verträge, Kosten, Berichte |
| OFFICE_USER | Büro-/Sachbearbeitung | Fahrzeugdaten pflegen, Dokumente verwalten |
| WORKSHOP_MECHANIC | Werkstattmitarbeiter | Kennzeichen-Suche, Historieneintrag, Fotos, technische Daten |
| READ_ONLY | Lesender Zugriff | Übersichten ohne Schreibrechte |

**Pain Points:**
- Fahrzeughistorien liegen verteilt in Excel, Papier oder E-Mails
- Kein zentraler Nachweis für Reparaturen, Wartungen, Schäden
- Mechaniker haben keinen strukturierten Zugang zu technischen Fahrzeugdaten
- Vertragslaufzeiten und Kosten werden manuell überwacht

## Core Features (Roadmap)

| Priority | ID | Feature | Status |
|----------|----|---------|--------|
| P0 (MVP) | PROJ-1 | Authentifizierung & Session-Management | Planned |
| P0 (MVP) | PROJ-2 | App Shell, Dark Mode & Navigation | Planned |
| P0 (MVP) | PROJ-3 | Mandanten- & Superadmin-Verwaltung | Planned |
| P0 (MVP) | PROJ-4 | Benutzer-, Rollen- & Rechteverwaltung | Planned |
| P0 (MVP) | PROJ-5 | Fahrzeugstammdaten & Fuhrparkübersicht | Planned |
| P0 (MVP) | PROJ-6 | Historienmodul (Chat-/Feed-Verlauf) | Planned |
| P0 (MVP) | PROJ-7 | Werkstattansicht (WORKSHOP_MECHANIC) | Planned |
| P1 | PROJ-8 | Kilometerstand- & Kostenerfassung | Planned |
| P1 | PROJ-9 | Reparaturen, Wartungen & Schäden | Planned |
| P1 | PROJ-10 | Vertragsverwaltung | Planned |
| P1 | PROJ-11 | DMS / Dokumente & Medien | Planned |
| P1 | PROJ-12 | Fahrzeugschein-Modul | Planned |
| P2 | PROJ-13 | Dashboard & Reporting | Planned |

## Success Metrics
- Mechaniker kann Fahrzeug per Kennzeichen in unter 10 Sekunden finden und Historieneintrag anlegen
- Datentrennung zwischen Mandanten ist technisch erzwungen (0 Cross-Tenant-Leaks)
- WORKSHOP_MECHANIC hat keinen Zugang zu Finanz-/Vertragsdaten
- Dashboard zeigt Kosten monatlich, jährlich und kumuliert je Fahrzeug
- Vollständige Fahrzeugakte mit Geschichte, Verträgen, Medien und Auswertungen

## Constraints
- Solo-Entwickler
- Stack: Next.js 16 (App Router) + TypeScript + Tailwind CSS + shadcn/ui + Supabase + Hostinger VPS
- Deployment: Hostinger VPS (Linux, Node.js, Nginx, PM2 oder Docker)
- Komplette App im Dark Mode (kein Light Theme)
- Supabase MCP aktiv nutzen
- Produktname: H+M FleetHub (verbindlich)

## Non-Goals
- Native Mobile App (iOS/Android) — responsive Web reicht
- Eigene Map-/GPS-Integration in MVP
- Fahrtenbuch / Kilometerprotokoll automatisch per OBD
- Buchhaltungsintegration (DATEV, SAP) in MVP
- Automatisierte Schadensmeldung via Versicherungs-API
- Light Theme / Theme-Switch

---

Use `/requirements` to create detailed feature specifications for each item in the roadmap above.
