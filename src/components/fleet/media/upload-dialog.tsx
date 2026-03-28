"use client"

import { useState, useRef } from "react"
import { Upload, X, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import type { VehicleDocument, VehicleDocumentType } from "@/types/database"

const DOCUMENT_TYPE_OPTIONS: { value: VehicleDocumentType; label: string }[] = [
  { value: "REGISTRATION_CERTIFICATE", label: "Fahrzeugschein" },
  { value: "INSURANCE", label: "Versicherung" },
  { value: "LEASE_CONTRACT", label: "Leasingvertrag" },
  { value: "FINANCING_CONTRACT", label: "Finanzierungsvertrag" },
  { value: "INVOICE", label: "Rechnung" },
  { value: "INSPECTION_REPORT", label: "Pruefbericht" },
  { value: "OTHER", label: "Sonstiges" },
]

const ACCEPTED_FILE_TYPES =
  "image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${(bytes / 1024).toFixed(0)} KB`
}

interface UploadDialogProps {
  vehicleId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onUploaded: (doc: VehicleDocument) => void
}

export function UploadDialog({
  vehicleId,
  open,
  onOpenChange,
  onUploaded,
}: UploadDialogProps) {
  const [file, setFile] = useState<File | null>(null)
  const [documentType, setDocumentType] =
    useState<VehicleDocumentType>("OTHER")
  const [description, setDescription] = useState("")
  const [isUploading, setIsUploading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  function resetForm() {
    setFile(null)
    setDocumentType("OTHER")
    setDescription("")
    setError(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function handleOpenChange(nextOpen: boolean) {
    if (!nextOpen) {
      resetForm()
    }
    onOpenChange(nextOpen)
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files?.[0] ?? null
    setFile(selected)
    setError(null)
  }

  function removeFile() {
    setFile(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()

    if (!file) {
      setError("Bitte eine Datei auswaehlen.")
      return
    }

    // Size validation
    const isVideo = file.type.startsWith("video/")
    const maxSize = isVideo ? 500 * 1024 * 1024 : 50 * 1024 * 1024
    if (file.size > maxSize) {
      setError(
        isVideo
          ? "Video darf maximal 500 MB gross sein."
          : "Datei darf maximal 50 MB gross sein."
      )
      return
    }

    setIsUploading(true)
    setError(null)

    try {
      const formData = new FormData()
      formData.append("file", file)
      formData.append("document_type", documentType)
      if (description.trim()) {
        formData.append("description", description.trim())
      }

      const res = await fetch(`/api/vehicles/${vehicleId}/documents`, {
        method: "POST",
        body: formData,
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(
          body?.error ?? "Upload fehlgeschlagen. Bitte erneut versuchen."
        )
      }

      const doc: VehicleDocument = await res.json()
      onUploaded(doc)
      resetForm()
      onOpenChange(false)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsUploading(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Dokument hochladen</DialogTitle>
          <DialogDescription>
            Fotos/Dokumente max. 50 MB &bull; Videos max. 500 MB
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          {/* File drop zone */}
          {!file ? (
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex w-full cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed border-muted-foreground/25 px-6 py-10 text-center transition-colors hover:border-muted-foreground/50"
              aria-label="Datei auswaehlen"
            >
              <Upload className="h-8 w-8 text-muted-foreground" />
              <span className="text-sm font-medium text-muted-foreground">
                Klicken zum Auswaehlen
              </span>
            </button>
          ) : (
            <div className="flex items-center justify-between rounded-lg border bg-muted/50 px-4 py-3">
              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">{file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatFileSize(file.size)}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={removeFile}
                aria-label="Datei entfernen"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          )}

          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPTED_FILE_TYPES}
            onChange={handleFileChange}
            className="hidden"
            aria-hidden="true"
          />

          {/* Document type */}
          <div className="space-y-2">
            <Label htmlFor="document-type">Dokumenttyp</Label>
            <Select
              value={documentType}
              onValueChange={(val) =>
                setDocumentType(val as VehicleDocumentType)
              }
            >
              <SelectTrigger id="document-type">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                  <SelectItem key={opt.value} value={opt.value}>
                    {opt.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Description */}
          <div className="space-y-2">
            <Label htmlFor="doc-description">Beschreibung (optional)</Label>
            <Input
              id="doc-description"
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder="Kurze Beschreibung..."
              disabled={isUploading}
            />
          </div>

          {/* Error */}
          {error && <p className="text-sm text-destructive">{error}</p>}

          <DialogFooter>
            <Button type="submit" disabled={isUploading || !file}>
              {isUploading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Wird hochgeladen...
                </>
              ) : (
                "Hochladen"
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
