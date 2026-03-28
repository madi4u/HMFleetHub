"use client"

import { useState, useRef } from "react"
import { FileText, Download, Trash2, Upload, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import type { ContractDocument } from "@/types/database"

interface ContractDocumentListProps {
  contractId: string
  vehicleId: string
  documents: ContractDocument[]
  canEdit: boolean
  onDocumentAdded: (doc: ContractDocument) => void
  onDocumentDeleted: (docId: string) => void
}

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

export function ContractDocumentList({
  contractId,
  vehicleId,
  documents,
  canEdit,
  onDocumentAdded,
  onDocumentDeleted,
}: ContractDocumentListProps) {
  const [uploading, setUploading] = useState(false)
  const [deletingId, setDeletingId] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setUploading(true)
    try {
      const formData = new FormData()
      formData.append("file", file)

      const res = await fetch(
        `/api/vehicles/${vehicleId}/contracts/${contractId}/documents`,
        { method: "POST", body: formData }
      )

      if (!res.ok) {
        throw new Error("Upload fehlgeschlagen")
      }

      const doc: ContractDocument = await res.json()
      onDocumentAdded(doc)
    } catch {
      // Silently fail - could add toast here
    } finally {
      setUploading(false)
      // Reset file input so the same file can be selected again
      if (fileInputRef.current) {
        fileInputRef.current.value = ""
      }
    }
  }

  async function handleDelete(docId: string) {
    setDeletingId(docId)
    try {
      const res = await fetch(
        `/api/vehicles/${vehicleId}/contracts/${contractId}/documents/${docId}`,
        { method: "DELETE" }
      )

      if (!res.ok) {
        throw new Error("Loeschen fehlgeschlagen")
      }

      onDocumentDeleted(docId)
    } catch {
      // Silently fail
    } finally {
      setDeletingId(null)
    }
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-muted-foreground">Dokumente</h4>
        {canEdit && (
          <div>
            <input
              ref={fileInputRef}
              type="file"
              accept="application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={handleUpload}
              aria-label="Vertragsdokument hochladen"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              {uploading ? "Wird hochgeladen..." : "Hochladen"}
            </Button>
            <p className="mt-1 text-xs text-muted-foreground text-right">
              Max. 50 MB
            </p>
          </div>
        )}
      </div>

      {documents.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Keine Dokumente vorhanden.
        </p>
      ) : (
        <ul className="space-y-2">
          {documents.map((doc) => (
            <li
              key={doc.id}
              className="flex items-center justify-between rounded-md border border-border p-2"
            >
              <div className="flex items-center gap-2 min-w-0">
                <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                <span className="truncate text-sm">{doc.file_name}</span>
                <span className="shrink-0 text-xs text-muted-foreground">
                  {formatFileSize(doc.file_size)}
                </span>
              </div>
              <div className="flex items-center gap-1 shrink-0">
                {doc.signed_url && (
                  <Button variant="ghost" size="icon" asChild>
                    <a
                      href={doc.signed_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      aria-label={`${doc.file_name} herunterladen`}
                    >
                      <Download className="h-4 w-4" />
                    </a>
                  </Button>
                )}
                {canEdit && (
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button
                        variant="ghost"
                        size="icon"
                        disabled={deletingId === doc.id}
                        aria-label={`${doc.file_name} loeschen`}
                      >
                        {deletingId === doc.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Trash2 className="h-4 w-4 text-destructive" />
                        )}
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Dokument loeschen?</AlertDialogTitle>
                        <AlertDialogDescription>
                          Moechten Sie &quot;{doc.file_name}&quot; wirklich
                          loeschen? Diese Aktion kann nicht rueckgaengig gemacht
                          werden.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                        <AlertDialogAction
                          onClick={() => handleDelete(doc.id)}
                        >
                          Loeschen
                        </AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                )}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
