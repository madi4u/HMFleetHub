# PROJ-11: DMS / Dokumente & Medien

## Status: In Progress
**Created:** 2026-03-27
**Last Updated:** 2026-03-27

## Dependencies
- Requires: PROJ-5 (Fahrzeugstammdaten) — Dokumente sind einem Fahrzeug zugeordnet
- Requires: PROJ-6 (Historienmodul) — Anhänge an Historieneinträgen
- Requires: PROJ-10 (Vertragsverwaltung) — Vertragsdokumente

## Overview
Jedes Fahrzeug hat ein zentrales DMS für Fotos, Videos, PDFs, Rechnungen, Prüfberichte und sonstige Dokumente. Dokumente können kategorisiert, in der Vorschau angezeigt, heruntergeladen und gelöscht werden. Zuordnung zu Fahrzeug, Vertrag oder Historieneintrag ist möglich.

## User Stories
- Als FLEET_MANAGER möchte ich beliebige Dokumente zu einem Fahrzeug hochladen und kategorisieren.
- Als Benutzer möchte ich Bilder direkt in der App als Vorschau sehen ohne herunterladen zu müssen.
- Als Benutzer möchte ich PDFs in der App anzeigen oder herunterladen.
- Als FLEET_MANAGER möchte ich Dokumente einem Vertrag oder einem Historieneintrag zuordnen.
- Als FLEET_MANAGER möchte ich Dokumente löschen, wenn sie nicht mehr benötigt werden.
- Als WORKSHOP_MECHANIC möchte ich Fotos und Videos zu einem Fahrzeug hochladen (über den Historieneintrag).

## Acceptance Criteria
- [ ] Upload unterstützt: image/* (Fotos), video/* (Videos), application/pdf, gängige Dokumentformate (DOCX, XLSX)
- [ ] Max. Dateigröße: 50 MB für Fotos/Dokumente, 500 MB für Videos
- [ ] Dateityp-Validierung: Nur erlaubte MIME-Types werden akzeptiert
- [ ] Sichere Dateinamen: Sonderzeichen und Leerzeichen werden sanitiert
- [ ] Dokumentkategorien (document_type): REGISTRATION_CERTIFICATE, INSURANCE, LEASE_CONTRACT, FINANCING_CONTRACT, INVOICE, INSPECTION_REPORT, OTHER
- [ ] Vorschau: Bilder als Inline-Preview, PDFs mit PDF-Viewer oder Browser-Darstellung, Videos mit HTML5-Player
- [ ] Download: Signierte, temporäre Supabase Storage URL (kein dauerhaft öffentlicher Link)
- [ ] Zuordnung: Dokument kann Fahrzeug, Vertrag oder Historieneintrag zugeordnet sein
- [ ] Dokumente-Tab in Fahrzeugakte zeigt alle Dokumente des Fahrzeugs gefiltert nach Kategorie
- [ ] Löschen: Bestätigungsdialog; Datei wird aus Supabase Storage entfernt
- [ ] Alle Uploads sind mandantenisoliert (Storage-Pfad enthält `tenant_id`)
- [ ] Zugriffsrechte: Nur berechtigte Benutzer des eigenen Mandanten können Dokumente lesen/schreiben/löschen
- [ ] Upload-Fortschrittsanzeige für große Dateien

## Edge Cases
- Was passiert, wenn ein nicht erlaubter Dateityp hochgeladen wird? → Sofortige Fehlermeldung, Datei wird nicht verarbeitet
- Was passiert, wenn der Storage-Upload fehlschlägt (Netzwerkfehler)? → Fehler wird angezeigt; Datenbankzeile wird nicht erstellt
- Was passiert, wenn ein Dokument gelöscht wird, das noch einem Historieneintrag zugeordnet ist? → Warnung anzeigen: "Dieses Dokument ist einem Historieneintrag zugeordnet"; trotzdem löschbar mit Bestätigung
- Was passiert, wenn eine signierte URL abläuft? → Beim Klick wird eine neue signierte URL generiert (keine dauerhaft gültigen URLs)

## Technical Requirements
- Tabellen: `vehicle_documents`, `vehicle_media`, `vehicle_history_attachments`
- Storage: Supabase Storage, private Buckets, signierte URLs mit Ablaufzeit (z. B. 1 Stunde)
- Storage-Pfade: `tenant/{tenantId}/vehicles/{vehicleId}/documents/`, `.../history/{entryId}/`, `.../registration/`
- Storage-Policies: Nur authentifizierte Benutzer des eigenen Mandanten können lesen/schreiben
- Dateinamen-Sanitierung: Server-seitig vor dem Upload

---
<!-- Sections below are added by subsequent skills -->

## Tech Design (Solution Architect)

### Abgrenzung zu anderen Modulen
- `vehicle_history_attachments` (PROJ-6): Anhänge an Historieneinträgen — bleiben dort
- `contract_documents` (PROJ-10): Vertragsdokumente — bleiben dort
- `vehicle_documents` (PROJ-11): **Fahrzeugbezogene Dokumente ohne spezifischen Kontext** — neu

### Komponentenstruktur

```
/fleet/[id]  →  Tab "Medien"  (bisher Placeholder)
└── MediaTab
    ├── Toolbar: "Dokument hochladen" Button + Kategorie-Filter-Chips
    ├── DocumentGrid (Kacheln)
    │   ├── IMAGE → Thumbnail (inline Preview bei Klick)
    │   ├── VIDEO → Video-Icon + Name + Player bei Klick
    │   └── DOCUMENT → Datei-Icon + Name + Kategorie-Badge + Download-Link
    └── EmptyState: "Noch keine Dokumente hochgeladen."

UploadDialog:
    ├── Dateiauswahl (Drag & Drop oder Klick)
    ├── Kategorie-Select (document_type)
    ├── Beschreibung (optional)
    └── Upload-Button mit Fortschrittsanzeige
```

### Datenmodell

```
vehicle_documents (neu):
  id, tenant_id, vehicle_id
  file_path, file_name, mime_type, file_size
  document_type: REGISTRATION_CERTIFICATE | INSURANCE | LEASE_CONTRACT |
                 FINANCING_CONTRACT | INVOICE | INSPECTION_REPORT | OTHER
  attachment_type: IMAGE | VIDEO | DOCUMENT  (für Preview-Logik)
  description TEXT (optional)
  created_at

Storage: vehicle-media bucket, Pfad tenant/{tenantId}/vehicles/{vehicleId}/documents/{filename}
Signierte URLs (1h Ablaufzeit)
```

### Tech-Entscheidungen
- Gleicher Bucket `vehicle-media` — Pfad-Trennung reicht
- `attachment_type` aus MIME-Type abgeleitet (server-seitig)
- Dateinamen-Sanitierung server-seitig: Sonderzeichen → Underscore, Leerzeichen → Bindestrich
- Kategorie-Filter via URL-State (?category=INVOICE) — teilbar und reload-fest
- Kein separater Viewer: Bilder als `<img>`, Videos als `<video>`, PDFs via `window.open(signedUrl)` (Browser-nativer PDF-Viewer)
- Permission: `vehicles.media.upload` für Upload/Löschen (WORKSHOP_MECHANIC hat es), `vehicles.list` für Lesen

### API-Routes
- GET  /api/vehicles/[id]/documents — Liste mit signierten URLs, optional ?category=X
- POST /api/vehicles/[id]/documents — Upload (multipart)
- DELETE /api/vehicles/[id]/documents/[docId] — Löschen + Storage-Cleanup

## QA Test Results

**Tested:** 2026-03-28
**App URL:** http://localhost:3000
**Tester:** QA Engineer (AI) -- Code Review + Build Verification

### Acceptance Criteria Status

#### AC-1: Upload unterstuetzt image/*, video/*, PDF, DOCX, XLSX
- [x] getAttachmentType in documents/route.ts handles image/*, video/*, pdf, document, msword, spreadsheet, presentation, text/plain

#### AC-2: Max. Dateigroesse (50 MB Fotos/Docs, 500 MB Videos)
- [x] MAX_IMAGE_SIZE = 50 MB, MAX_VIDEO_SIZE = 500 MB, MAX_DOC_SIZE = 50 MB

#### AC-3: Dateityp-Validierung
- [x] getAttachmentType returns null for unsupported types -> 400 error

#### AC-4: Sichere Dateinamen
- [x] sanitizeFilename replaces non-alphanumeric characters with underscore, truncates to 200 chars

#### AC-5: Dokumentkategorien
- [x] VALID_DOCUMENT_TYPES: REGISTRATION_CERTIFICATE, INSURANCE, LEASE_CONTRACT, FINANCING_CONTRACT, INVOICE, INSPECTION_REPORT, OTHER

#### AC-6: Vorschau (Bilder, PDFs, Videos)
- [x] document-preview.tsx handles IMAGE (inline img), VIDEO (player), DOCUMENT (file card + download)

#### AC-7: Download ueber signierte URLs
- [x] Signed URLs generated with 1h expiry via adminClient.storage.createSignedUrl

#### AC-8: Zuordnung (Fahrzeug, Vertrag, Historieneintrag)
- [x] vehicle_documents table links to vehicle_id
- [x] contract_documents table links to contract_id (PROJ-10)
- [x] vehicle_history_attachments table links to history_entry_id (PROJ-6)
- [ ] NOTE: No unified cross-entity document linking. Each relation uses separate tables.

#### AC-9: Dokumente-Tab in Fahrzeugakte zeigt Dokumente nach Kategorie
- [x] MediaTab component with category filter chips
- [x] API supports ?category= parameter

#### AC-10: Loeschen mit Bestaetigung + Storage-Cleanup
- [x] DELETE /api/vehicles/[id]/documents/[docId] removes DB row + storage file
- [x] Frontend uses AlertDialog for confirmation (in MediaTab)

#### AC-11: Alle Uploads mandantenisoliert
- [x] Storage path contains tenant_id: `tenant/{tenantId}/vehicles/{vehicleId}/documents/`
- [x] DB queries filter by tenant_id

#### AC-12: Zugriffsrechte
- [x] GET uses vehicles.list permission, POST/DELETE use vehicles.media.upload

#### AC-13: Upload-Fortschrittsanzeige
- [ ] BUG: No upload progress indicator implemented. The upload-dialog.tsx uses standard fetch which does not provide progress events. For large video files (up to 500 MB), the user has no feedback during upload.

### Edge Cases Status

#### EC-1: Nicht erlaubter Dateityp
- [x] Immediate 400 error with "Nicht unterstuetzter Dateityp"

#### EC-2: Storage-Upload fehlschlaegt
- [x] 500 error returned; no orphaned DB rows (upload happens before DB insert)

#### EC-3: Dokument loeschen das einem Historieneintrag zugeordnet ist
- [x] vehicle_documents are separate from vehicle_history_attachments. Deleting a vehicle_document does not affect history attachments (different tables).

#### EC-4: Signierte URL abgelaufen
- [x] New signed URL generated on each page load / API call

### Security Audit Results
- [x] Authentication: All routes require auth
- [x] Authorization: vehicles.list for read, vehicles.media.upload for write
- [x] File type validation: Server-side MIME check
- [x] File size validation: Server-side size limit
- [x] Filename sanitization: Server-side
- [x] Tenant isolation: Storage paths include tenant_id
- [ ] BUG (CRITICAL): No database migration exists for `vehicle_documents` table. There is no PROJ-11 migration file. The API routes reference this table but it does not exist in the database. All document operations will fail with 500 errors.

### Bugs Found

#### BUG-PROJ11-1: Missing database migration for vehicle_documents table
- **Severity:** Critical
- **Steps to Reproduce:**
  1. Navigate to /fleet/{id} -> Medien tab
  2. Upload a document
  3. Expected: Document saved and displayed
  4. Actual: 500 error -- table "vehicle_documents" does not exist
- **Root Cause:** No migration file for PROJ-11. Only 5 migrations exist.
- **Impact:** ALL DMS functionality is broken. PROJ-12 (Fahrzeugschein) also depends on this table.
- **Priority:** Must fix immediately

#### BUG-PROJ11-2: No upload progress indicator for large files
- **Severity:** Low
- **Steps to Reproduce:**
  1. Upload a 200 MB video file
  2. Expected: Progress bar showing upload %
  3. Actual: No feedback until upload completes or fails
- **Priority:** Fix in next sprint

### Summary
- **Acceptance Criteria:** 11/13 passed (code review), but ALL fail at runtime due to missing DB table
- **Bugs Found:** 2 total (1 critical, 0 high, 0 medium, 1 low)
- **Security:** Good at code level, but DB schema missing
- **Production Ready:** NO -- CRITICAL: missing database migration blocks all DMS functionality

## Deployment
_To be added by /deploy_
