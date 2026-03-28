"use client"

import { useState } from "react"
import { Pencil, Trash2 } from "lucide-react"

import { Avatar, AvatarFallback } from "@/components/ui/avatar"
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
import { EntryTypeBadge } from "@/components/fleet/history/entry-type-badge"
import { AttachmentPreview } from "@/components/fleet/history/attachment-preview"
import { hasPermission } from "@/lib/permissions.config"
import { Badge } from "@/components/ui/badge"
import type { HistoryEntry as HistoryEntryT, UserRole, RepairStatus } from "@/types/database"

function getInitials(name: string | null): string {
  if (!name) return "?"
  return name
    .split(" ")
    .map((part) => part[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase()
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

function formatCurrency(value: number, currency: string | null): string {
  return `${value.toLocaleString("de-DE", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} ${currency || "EUR"}`
}

// ---------------------------------------------------------------------------
// PROJ-9: RepairStatusBadge + DueDate helpers
// ---------------------------------------------------------------------------

const REPAIR_STATUS_CONFIG: Record<RepairStatus, { label: string; className: string }> = {
  OPEN: { label: "Offen", className: "text-yellow-400 border-yellow-400/40" },
  IN_PROGRESS: { label: "In Bearbeitung", className: "text-blue-400 border-blue-400/40" },
  DONE: { label: "Abgeschlossen", className: "text-green-400 border-green-400/40" },
}

function RepairStatusBadge({ status }: { status: RepairStatus | null }) {
  if (!status) return null
  const c = REPAIR_STATUS_CONFIG[status]
  return (
    <Badge variant="outline" className={c.className}>
      {c.label}
    </Badge>
  )
}

function getDueDateStatus(nextDueDate: string | null): "overdue" | "soon" | "ok" | null {
  if (!nextDueDate) return null
  const due = new Date(nextDueDate)
  const now = new Date()
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return "overdue"
  if (diffDays <= 14) return "soon"
  return "ok"
}

function formatDateDE(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function DueDateDisplay({ nextDueDate }: { nextDueDate: string | null }) {
  const status = getDueDateStatus(nextDueDate)
  if (!status || !nextDueDate) return null
  const dateStr = formatDateDE(nextDueDate)
  if (status === "overdue") {
    return <span className="text-xs text-red-400">Ueberfaellig: {dateStr}</span>
  }
  if (status === "soon") {
    return <span className="text-xs text-yellow-400">Bald faellig: {dateStr}</span>
  }
  return <span className="text-xs text-muted-foreground">Folgetermin: {dateStr}</span>
}

interface HistoryEntryProps {
  entry: HistoryEntryT
  currentUserId: string
  userRole: UserRole
  vehicleId: string
  onDelete: (entryId: string) => void
  onEdit: (entry: HistoryEntryT) => void
}

export function HistoryEntry({
  entry,
  currentUserId,
  userRole,
  onDelete,
  onEdit,
}: HistoryEntryProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const canEdit =
    currentUserId === entry.author_user_id ||
    hasPermission(userRole, "vehicles.history.update")

  const canDelete = hasPermission(userRole, "vehicles.history.delete")

  async function handleDelete() {
    setIsDeleting(true)
    onDelete(entry.id)
  }

  const hasMeta =
    entry.mileage != null ||
    entry.cost_net != null ||
    entry.cost_gross != null ||
    entry.supplier ||
    entry.invoice_number

  return (
    <div className="border-b border-border py-4">
      <div className="flex gap-3">
        {/* Avatar */}
        <Avatar className="h-8 w-8 shrink-0">
          <AvatarFallback className="text-xs">
            {getInitials(entry.author_name)}
          </AvatarFallback>
        </Avatar>

        {/* Content */}
        <div className="min-w-0 flex-1 space-y-1">
          {/* Header row */}
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-medium">
              {entry.author_name || "Unbekannt"}
            </span>
            <span className="text-xs text-muted-foreground">
              {formatDate(entry.event_date)}
            </span>
            <EntryTypeBadge type={entry.entry_type} />
            <RepairStatusBadge status={entry.repair_status} />
          </div>

          {/* Title */}
          {entry.title && (
            <p className="text-sm font-semibold">{entry.title}</p>
          )}

          {/* Message */}
          {entry.message && (
            <p className="whitespace-pre-wrap text-sm text-muted-foreground">
              {entry.message}
            </p>
          )}

          {/* Meta row */}
          {hasMeta && (
            <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
              {entry.mileage != null && (
                <span>{entry.mileage.toLocaleString("de-DE")} km</span>
              )}
              {entry.cost_net != null && (
                <span>
                  {formatCurrency(entry.cost_net, entry.currency)} netto
                </span>
              )}
              {entry.cost_gross != null && (
                <span>
                  {formatCurrency(entry.cost_gross, entry.currency)} brutto
                </span>
              )}
              {entry.supplier && <span>{entry.supplier}</span>}
              {entry.invoice_number && (
                <span>Re.-Nr. {entry.invoice_number}</span>
              )}
            </div>
          )}

          {/* PROJ-9: Due date */}
          <DueDateDisplay nextDueDate={entry.next_due_date} />

          {/* Attachments */}
          {entry.attachments && entry.attachments.length > 0 && (
            <div className="grid max-w-lg grid-cols-2 gap-2 pt-1 sm:grid-cols-3">
              {entry.attachments.map((att) => (
                <AttachmentPreview key={att.id} attachment={att} />
              ))}
            </div>
          )}

          {/* Actions */}
          {(canEdit || canDelete) && (
            <div className="flex gap-2 pt-1">
              {canEdit && (
                <Button
                  variant="ghost"
                  size="sm"
                  className="h-7 text-xs"
                  onClick={() => onEdit(entry)}
                >
                  <Pencil className="mr-1 h-3 w-3" />
                  Bearbeiten
                </Button>
              )}
              {canDelete && (
                <AlertDialog>
                  <AlertDialogTrigger asChild>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="h-7 text-xs text-destructive hover:text-destructive"
                      disabled={isDeleting}
                    >
                      <Trash2 className="mr-1 h-3 w-3" />
                      Loeschen
                    </Button>
                  </AlertDialogTrigger>
                  <AlertDialogContent>
                    <AlertDialogHeader>
                      <AlertDialogTitle>Eintrag loeschen?</AlertDialogTitle>
                      <AlertDialogDescription>
                        Dieser Historieneintrag wird unwiderruflich geloescht.
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
          )}
        </div>
      </div>
    </div>
  )
}
