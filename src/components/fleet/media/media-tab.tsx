"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus, FileX } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { DocumentPreview } from "@/components/fleet/media/document-preview"
import { UploadDialog } from "@/components/fleet/media/upload-dialog"
import type { VehicleDocument, VehicleDocumentType } from "@/types/database"

const FILTER_OPTIONS: { value: VehicleDocumentType | null; label: string }[] = [
  { value: null, label: "Alle" },
  { value: "REGISTRATION_CERTIFICATE", label: "Fahrzeugschein" },
  { value: "INSURANCE", label: "Versicherung" },
  { value: "INVOICE", label: "Rechnung" },
  { value: "INSPECTION_REPORT", label: "Pruefbericht" },
  { value: "OTHER", label: "Sonstiges" },
]

interface MediaTabProps {
  vehicleId: string
  canUpload: boolean
}

export function MediaTab({ vehicleId, canUpload }: MediaTabProps) {
  const [docs, setDocs] = useState<VehicleDocument[]>([])
  const [categoryFilter, setCategoryFilter] =
    useState<VehicleDocumentType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [uploadOpen, setUploadOpen] = useState(false)

  const fetchDocuments = useCallback(
    async (category: VehicleDocumentType | null) => {
      setIsLoading(true)
      setError(null)
      try {
        const url = new URL(
          `/api/vehicles/${vehicleId}/documents`,
          window.location.origin
        )
        if (category) {
          url.searchParams.set("category", category)
        }
        const res = await fetch(url.toString())
        if (!res.ok) {
          throw new Error("Dokumente konnten nicht geladen werden.")
        }
        const json = await res.json()
        // Support both array and paginated response
        const data: VehicleDocument[] = Array.isArray(json)
          ? json
          : json.data ?? []
        setDocs(data)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        )
      } finally {
        setIsLoading(false)
      }
    },
    [vehicleId]
  )

  useEffect(() => {
    fetchDocuments(categoryFilter)
  }, [fetchDocuments, categoryFilter])

  function handleFilterChange(value: VehicleDocumentType | null) {
    setCategoryFilter(value)
  }

  function handleDeleted(docId: string) {
    setDocs((prev) => prev.filter((d) => d.id !== docId))
  }

  function handleUploaded(doc: VehicleDocument) {
    setDocs((prev) => [doc, ...prev])
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className="text-lg font-semibold">Dokumente &amp; Medien</h2>
        {canUpload && (
          <Button size="sm" onClick={() => setUploadOpen(true)}>
            <Plus className="mr-2 h-4 w-4" />
            Hochladen
          </Button>
        )}
      </div>

      {/* Filter chips */}
      <div className="flex flex-wrap gap-2" role="group" aria-label="Dokumenttyp-Filter">
        {FILTER_OPTIONS.map((opt) => {
          const isActive = categoryFilter === opt.value
          return (
            <Badge
              key={opt.value ?? "all"}
              variant={isActive ? "default" : "outline"}
              className={`cursor-pointer select-none ${
                isActive ? "" : "hover:bg-muted"
              }`}
              onClick={() => handleFilterChange(opt.value)}
              role="button"
              tabIndex={0}
              aria-pressed={isActive}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault()
                  handleFilterChange(opt.value)
                }
              }}
            >
              {opt.label}
            </Badge>
          )
        })}
      </div>

      {/* Content */}
      {isLoading ? (
        <MediaTabSkeleton />
      ) : error ? (
        <div className="flex flex-col items-center justify-center py-16">
          <p className="text-sm text-destructive">{error}</p>
          <Button
            variant="ghost"
            size="sm"
            className="mt-2"
            onClick={() => fetchDocuments(categoryFilter)}
          >
            Erneut versuchen
          </Button>
        </div>
      ) : docs.length === 0 ? (
        <div className="flex flex-col items-center justify-center py-16 text-muted-foreground">
          <FileX className="mb-3 h-12 w-12" />
          <p className="text-sm font-medium">Keine Dokumente vorhanden</p>
          {canUpload && (
            <Button
              variant="ghost"
              size="sm"
              className="mt-2"
              onClick={() => setUploadOpen(true)}
            >
              Erstes Dokument hochladen
            </Button>
          )}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {docs.map((doc) => (
            <DocumentPreview
              key={doc.id}
              doc={doc}
              canDelete={canUpload}
              onDeleted={handleDeleted}
              vehicleId={vehicleId}
            />
          ))}
        </div>
      )}

      {/* Upload dialog */}
      <UploadDialog
        vehicleId={vehicleId}
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        onUploaded={handleUploaded}
      />
    </div>
  )
}

function MediaTabSkeleton() {
  return (
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="space-y-2">
          <Skeleton className="aspect-video w-full rounded-lg" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-16" />
        </div>
      ))}
    </div>
  )
}
