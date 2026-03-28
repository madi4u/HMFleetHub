"use client"

import { FileText } from "lucide-react"
import type { HistoryAttachment } from "@/types/database"

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

interface AttachmentPreviewProps {
  attachment: HistoryAttachment
}

export function AttachmentPreview({ attachment }: AttachmentPreviewProps) {
  const { attachment_type, signed_url, file_name, file_size } = attachment

  if (!signed_url) {
    return (
      <div className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3">
        <FileText className="h-5 w-5 text-muted-foreground" />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm">{file_name}</p>
          <p className="text-xs text-muted-foreground">Datei nicht verfuegbar</p>
        </div>
      </div>
    )
  }

  if (attachment_type === "IMAGE") {
    return (
      <a href={signed_url} target="_blank" rel="noopener noreferrer">
        <img
          src={signed_url}
          alt={file_name}
          className="max-h-32 rounded-md object-cover transition-opacity hover:opacity-80"
        />
      </a>
    )
  }

  if (attachment_type === "VIDEO") {
    return (
      <video
        controls
        src={signed_url}
        className="max-h-48 rounded-md"
        aria-label={file_name}
      >
        <track kind="captions" />
        Ihr Browser unterstuetzt kein Video-Tag.
      </video>
    )
  }

  // DOCUMENT
  return (
    <a
      href={signed_url}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-2 rounded-md border border-border bg-muted/30 p-3 transition-colors hover:bg-muted/50"
    >
      <FileText className="h-5 w-5 shrink-0 text-muted-foreground" />
      <div className="min-w-0 flex-1">
        <p className="truncate text-sm">{file_name}</p>
        <p className="text-xs text-muted-foreground">{formatFileSize(file_size)}</p>
      </div>
    </a>
  )
}
