"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { FileText, Upload, Download, ChevronDown, ChevronUp } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import type { VehicleDocument } from "@/types/database"

interface RegistrationDocumentCardProps {
  vehicleId: string
  canUpload: boolean
}

interface RegistrationDocumentResponse {
  current: VehicleDocument | null
  archive: VehicleDocument[]
}

export function RegistrationDocumentCard({
  vehicleId,
  canUpload,
}: RegistrationDocumentCardProps) {
  const [current, setCurrent] = useState<VehicleDocument | null>(null)
  const [archive, setArchive] = useState<VehicleDocument[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [isUploading, setIsUploading] = useState(false)
  const [showArchive, setShowArchive] = useState(false)
  const [uploadError, setUploadError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocument = useCallback(async () => {
    try {
      const res = await fetch(
        `/api/vehicles/${vehicleId}/registration-document`
      )
      if (!res.ok) {
        return
      }
      const data: RegistrationDocumentResponse = await res.json()
      setCurrent(data.current)
      setArchive(data.archive)
    } catch {
      // silently fail on fetch
    } finally {
      setIsLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    fetchDocument()
  }, [fetchDocument])

  async function handleUpload(file: File) {
    setIsUploading(true)
    setUploadError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(
        `/api/vehicles/${vehicleId}/registration-document`,
        {
          method: "POST",
          body: formData,
        }
      )

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(
          body?.error || "Upload fehlgeschlagen. Bitte versuche es erneut."
        )
      }

      const newDoc: VehicleDocument = await res.json()

      // Move old current to archive
      if (current) {
        setArchive((prev) => [current, ...prev])
      }
      setCurrent(newDoc)
    } catch (err) {
      setUploadError(
        err instanceof Error
          ? err.message
          : "Upload fehlgeschlagen. Bitte versuche es erneut."
      )
    } finally {
      setIsUploading(false)
      // Reset the file input
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  function onFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (file) {
      handleUpload(file)
    }
  }

  function triggerFileInput() {
    fileInputRef.current?.click()
  }

  function formatDate(dateStr: string) {
    return new Date(dateStr).toLocaleDateString("de-DE", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
    })
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <Skeleton className="h-6 w-40" />
          </div>
        </CardHeader>
        <CardContent>
          <Skeleton className="h-48 w-full" />
        </CardContent>
      </Card>
    )
  }

  const isImage = current?.attachment_type === "IMAGE"

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileText className="h-5 w-5 text-muted-foreground" />
            <CardTitle className="text-base">Fahrzeugschein</CardTitle>
          </div>
          {canUpload && current && (
            <Button
              variant="outline"
              size="sm"
              onClick={triggerFileInput}
              disabled={isUploading}
              aria-label="Neuen Fahrzeugschein hochladen"
            >
              <Upload className="mr-2 h-4 w-4" />
              {isUploading
                ? "Wird hochgeladen..."
                : "Neuen Fahrzeugschein hochladen"}
            </Button>
          )}
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Hidden file input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="application/pdf,image/jpeg,image/png,image/webp"
          className="hidden"
          onChange={onFileSelect}
          aria-label="Fahrzeugschein-Datei auswaehlen"
        />

        {/* Current document */}
        {current ? (
          <div className="space-y-3">
            {isImage ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={current.signed_url || ""}
                  alt={`Fahrzeugschein - ${current.file_name}`}
                  className="w-full max-h-48 object-contain rounded"
                />
                <a
                  href={current.signed_url || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                >
                  <Download className="h-3.5 w-3.5" />
                  Herunterladen
                </a>
              </div>
            ) : (
              <div className="flex items-center gap-3">
                <FileText className="h-12 w-12 text-muted-foreground shrink-0" />
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium truncate">
                    {current.file_name}
                  </p>
                  <a
                    href={current.signed_url || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-primary hover:underline"
                  >
                    <Download className="h-3.5 w-3.5" />
                    PDF herunterladen
                  </a>
                </div>
              </div>
            )}
            <p className="text-xs text-muted-foreground">
              Hochgeladen am {formatDate(current.created_at)}
            </p>
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center gap-3 rounded-md border border-dashed border-muted-foreground/30 p-8">
            <FileText className="h-10 w-10 text-muted-foreground" />
            <p className="text-sm text-muted-foreground">
              Kein Fahrzeugschein hinterlegt
            </p>
            {canUpload && (
              <Button
                variant="outline"
                size="sm"
                onClick={triggerFileInput}
                disabled={isUploading}
              >
                <Upload className="mr-2 h-4 w-4" />
                {isUploading
                  ? "Wird hochgeladen..."
                  : "Fahrzeugschein hochladen"}
              </Button>
            )}
          </div>
        )}

        {/* Upload error */}
        {uploadError && (
          <Alert variant="destructive">
            <AlertDescription>{uploadError}</AlertDescription>
          </Alert>
        )}

        {/* Archive section */}
        {archive.length > 0 && (
          <div>
            <Button
              variant="ghost"
              size="sm"
              className="px-0 text-muted-foreground hover:text-foreground"
              onClick={() => setShowArchive((prev) => !prev)}
            >
              {showArchive ? (
                <ChevronUp className="mr-1 h-4 w-4" />
              ) : (
                <ChevronDown className="mr-1 h-4 w-4" />
              )}
              Aeltere Versionen ({archive.length})
            </Button>

            {showArchive && (
              <div className="mt-2 space-y-2">
                {archive.map((doc) => (
                  <div
                    key={doc.id}
                    className="flex items-center justify-between rounded-md border border-border px-3 py-2"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="text-sm truncate">{doc.file_name}</p>
                      <p className="text-xs text-muted-foreground">
                        {formatDate(doc.created_at)}
                      </p>
                    </div>
                    <a
                      href={doc.signed_url || "#"}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="ml-2 shrink-0"
                      aria-label={`${doc.file_name} herunterladen`}
                    >
                      <Download className="h-4 w-4 text-muted-foreground hover:text-foreground" />
                    </a>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}
