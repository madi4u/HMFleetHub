"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { FileText, Image, File, Download, FolderOpen, Search } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { DocumentTypeBadge } from "@/components/fleet/media/document-type-badge"
import { useUser } from "@/hooks/use-user"
import type { VehicleDocumentType } from "@/types/database"

interface DocumentWithVehicle {
  id: string
  vehicle_id: string
  document_type: VehicleDocumentType
  file_name: string
  file_size: number
  mime_type: string
  created_at: string
  signed_url: string | null
  vehicles: { id: string; license_plate: string; make: string; model: string }
}

interface DocumentsResponse {
  documents: DocumentWithVehicle[]
  total: number
}

const DOCUMENT_TYPE_OPTIONS: { value: VehicleDocumentType; label: string }[] = [
  { value: "REGISTRATION_CERTIFICATE", label: "Fahrzeugschein" },
  { value: "INSURANCE", label: "Versicherung" },
  { value: "LEASE_CONTRACT", label: "Leasingvertrag" },
  { value: "FINANCING_CONTRACT", label: "Finanzierungsvertrag" },
  { value: "INVOICE", label: "Rechnung" },
  { value: "INSPECTION_REPORT", label: "Pruefbericht" },
  { value: "OTHER", label: "Sonstiges" },
]

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function getFileIcon(mimeType: string) {
  if (mimeType === "application/pdf") {
    return <FileText className="h-5 w-5 text-red-400" />
  }
  if (mimeType.startsWith("image/")) {
    return <Image className="h-5 w-5 text-blue-400" />
  }
  return <File className="h-5 w-5 text-muted-foreground" />
}

export default function DocumentsPage() {
  const { user, isLoading: userLoading } = useUser()
  const [documents, setDocuments] = useState<DocumentWithVehicle[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchDocuments = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (typeFilter && typeFilter !== "all") params.set("type", typeFilter)

      const res = await fetch(`/api/documents?${params.toString()}`)
      if (!res.ok) {
        throw new Error("Dokumente konnten nicht geladen werden.")
      }
      const json: DocumentsResponse = await res.json()
      setDocuments(json.documents)
      setTotal(json.total)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsLoading(false)
    }
  }, [search, typeFilter])

  useEffect(() => {
    if (!userLoading && user) {
      fetchDocuments()
    }
  }, [fetchDocuments, userLoading, user])

  if (userLoading) {
    return <DocumentsPageSkeleton />
  }

  if (!user) {
    return null
  }

  // Compute stats by document type
  const typeCounts = documents.reduce<Record<string, number>>((acc, doc) => {
    acc[doc.document_type] = (acc[doc.document_type] || 0) + 1
    return acc
  }, {})

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Dokumente & Medien
        </h1>
        <p className="text-muted-foreground">
          Alle Fahrzeugdokumente im Ueberblick
        </p>
      </div>

      {/* Stats row */}
      {!isLoading && !error && total > 0 && (
        <div className="flex flex-wrap gap-3">
          <div className="rounded-md border bg-card px-4 py-2">
            <span className="text-sm text-muted-foreground">Gesamt</span>
            <p className="text-lg font-semibold">{total}</p>
          </div>
          {DOCUMENT_TYPE_OPTIONS.map((opt) => {
            const count = typeCounts[opt.value] ?? 0
            if (count === 0) return null
            return (
              <div key={opt.value} className="rounded-md border bg-card px-4 py-2">
                <span className="text-sm text-muted-foreground">
                  {opt.label}
                </span>
                <p className="text-lg font-semibold">{count}</p>
              </div>
            )
          })}
        </div>
      )}

      {/* Filter bar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Dateiname oder Dokumenttyp suchen..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Dokumente durchsuchen"
          />
        </div>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            className="w-full sm:w-52"
            aria-label="Dokumenttyp filtern"
          >
            <SelectValue placeholder="Dokumenttyp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            {DOCUMENT_TYPE_OPTIONS.map((opt) => (
              <SelectItem key={opt.value} value={opt.value}>
                {opt.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && <DocumentsListSkeleton />}

      {/* Empty state */}
      {!isLoading && !error && documents.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <FolderOpen className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Keine Dokumente gefunden</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || typeFilter !== "all"
              ? "Versuchen Sie andere Suchbegriffe oder Filter."
              : "Es wurden noch keine Dokumente hochgeladen."}
          </p>
        </div>
      )}

      {/* Document list */}
      {!isLoading && !error && documents.length > 0 && (
        <div className="grid gap-3">
          {documents.map((doc) => (
            <Card key={doc.id}>
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex items-start gap-3 sm:items-center">
                  <div className="mt-0.5 flex-shrink-0 sm:mt-0">
                    {getFileIcon(doc.mime_type)}
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="truncate font-medium leading-tight">
                      {doc.file_name}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
                      <DocumentTypeBadge type={doc.document_type} />
                      <span>{formatFileSize(doc.file_size)}</span>
                      <span className="hidden sm:inline">|</span>
                      <span>{formatDate(doc.created_at)}</span>
                    </div>
                    <div className="text-sm">
                      <Link
                        href={`/fleet/${doc.vehicle_id}`}
                        className="hover:underline"
                      >
                        <span className="font-semibold">
                          {doc.vehicles.license_plate}
                        </span>{" "}
                        <span className="text-muted-foreground">
                          {doc.vehicles.make} {doc.vehicles.model}
                        </span>
                      </Link>
                    </div>
                  </div>
                </div>

                <div className="flex-shrink-0">
                  {doc.signed_url ? (
                    <Button variant="outline" size="sm" asChild>
                      <a
                        href={doc.signed_url}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label={`${doc.file_name} herunterladen`}
                      >
                        <Download className="mr-2 h-4 w-4" />
                        Download
                      </a>
                    </Button>
                  ) : (
                    <Button variant="outline" size="sm" disabled>
                      <Download className="mr-2 h-4 w-4" />
                      Nicht verfuegbar
                    </Button>
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}

function DocumentsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-72" />
      </div>
      <div className="flex gap-3">
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-12 w-24" />
        <Skeleton className="h-12 w-24" />
      </div>
      <DocumentsListSkeleton />
    </div>
  )
}

function DocumentsListSkeleton() {
  return (
    <div className="grid gap-3">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="rounded-md border p-4">
          <div className="flex items-center gap-3">
            <Skeleton className="h-5 w-5 rounded" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-4 w-48" />
              <div className="flex gap-2">
                <Skeleton className="h-5 w-20 rounded-full" />
                <Skeleton className="h-4 w-16" />
                <Skeleton className="h-4 w-28" />
              </div>
              <Skeleton className="h-4 w-36" />
            </div>
            <Skeleton className="h-8 w-28" />
          </div>
        </div>
      ))}
    </div>
  )
}
