"use client"

import { useState } from "react"
import { FileText, Video, Trash2, Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Card, CardContent } from "@/components/ui/card"
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
import { DocumentTypeBadge } from "@/components/fleet/media/document-type-badge"
import type { VehicleDocument } from "@/types/database"

function formatFileSize(bytes: number): string {
  if (bytes >= 1024 * 1024) {
    return `${(bytes / 1024 / 1024).toFixed(1)} MB`
  }
  return `${(bytes / 1024).toFixed(0)} KB`
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

interface DocumentPreviewProps {
  doc: VehicleDocument
  canDelete: boolean
  onDeleted: (docId: string) => void
  vehicleId: string
}

export function DocumentPreview({
  doc,
  canDelete,
  onDeleted,
  vehicleId,
}: DocumentPreviewProps) {
  const [isDeleting, setIsDeleting] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)

  async function handleDelete() {
    setIsDeleting(true)
    setDeleteError(null)
    try {
      const res = await fetch(
        `/api/vehicles/${vehicleId}/documents/${doc.id}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        throw new Error("Loeschen fehlgeschlagen.")
      }
      onDeleted(doc.id)
    } catch (err) {
      setDeleteError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-0">
        {/* Preview area */}
        {doc.attachment_type === "IMAGE" && doc.signed_url ? (
          <a
            href={doc.signed_url}
            target="_blank"
            rel="noopener noreferrer"
            className="block"
            aria-label={`${doc.file_name} in neuem Tab oeffnen`}
          >
            <img
              src={doc.signed_url}
              alt={doc.file_name}
              className="aspect-video w-full object-cover"
            />
          </a>
        ) : doc.attachment_type === "VIDEO" ? (
          <a
            href={doc.signed_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex aspect-video w-full items-center justify-center bg-muted/50"
            aria-label={`Video ${doc.file_name} abspielen`}
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <Video className="h-10 w-10" />
              <span className="text-sm font-medium">{doc.file_name}</span>
              <span className="text-xs">{formatFileSize(doc.file_size)}</span>
            </div>
          </a>
        ) : (
          <a
            href={doc.signed_url ?? "#"}
            target="_blank"
            rel="noopener noreferrer"
            className="flex aspect-video w-full items-center justify-center bg-muted/50"
            aria-label={`Dokument ${doc.file_name} herunterladen`}
          >
            <div className="flex flex-col items-center gap-2 text-muted-foreground">
              <FileText className="h-10 w-10" />
              <span className="max-w-[90%] truncate text-sm font-medium">
                {doc.file_name}
              </span>
              <span className="text-xs">{formatFileSize(doc.file_size)}</span>
            </div>
          </a>
        )}

        {/* Info area */}
        <div className="space-y-2 p-3">
          <div className="flex items-center justify-between gap-2">
            <DocumentTypeBadge type={doc.document_type} />
            <span className="text-xs text-muted-foreground">
              {formatDate(doc.created_at)}
            </span>
          </div>

          {doc.description && (
            <p className="text-sm text-muted-foreground line-clamp-2">
              {doc.description}
            </p>
          )}

          {deleteError && (
            <p className="text-xs text-destructive">{deleteError}</p>
          )}

          {canDelete && (
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-8 w-full text-destructive hover:text-destructive"
                  disabled={isDeleting}
                >
                  {isDeleting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Trash2 className="mr-2 h-4 w-4" />
                  )}
                  Loeschen
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Dokument loeschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    &quot;{doc.file_name}&quot; wird unwiderruflich geloescht.
                    Diese Aktion kann nicht rueckgaengig gemacht werden.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction
                    onClick={handleDelete}
                    className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  >
                    Loeschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  )
}
