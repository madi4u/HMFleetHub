"use client"

import { useState, useEffect, useCallback } from "react"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { z } from "zod"
import { Loader2 } from "lucide-react"

import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { HistoryEntry } from "@/components/fleet/history/history-entry"
import { HistoryEntryInput } from "@/components/fleet/history/history-entry-input"
import { ENTRY_TYPE_CONFIG } from "@/components/fleet/history/entry-type-badge"
import { useUser } from "@/hooks/use-user"
import { hasPermission } from "@/lib/permissions.config"
import type {
  HistoryEntry as HistoryEntryT,
  HistoryEntryType,
  PaginatedHistory,
} from "@/types/database"

const QUICK_FILTERS: { label: string; value: HistoryEntryType | null }[] = [
  { label: "Alle", value: null },
  { label: "Reparatur", value: "REPAIR" },
  { label: "Wartung", value: "MAINTENANCE" },
  { label: "Schaden", value: "DAMAGE" },
  { label: "Inspektion", value: "INSPECTION" },
  { label: "TUEV", value: "TUV" },
  { label: "Oelwechsel", value: "OIL_CHANGE" },
  { label: "Notiz", value: "NOTE" },
]

const ENTRY_TYPES = Object.keys(ENTRY_TYPE_CONFIG) as HistoryEntryType[]

const editSchema = z.object({
  entry_type: z.enum([
    "NOTE",
    "REPAIR",
    "MAINTENANCE",
    "OIL_CHANGE",
    "TIRE_CHANGE",
    "DAMAGE",
    "INSPECTION",
    "TUV",
    "MILEAGE_UPDATE",
    "DOCUMENT_UPLOAD",
    "PHOTO_UPLOAD",
    "VIDEO_UPLOAD",
    "OTHER",
  ]),
  title: z.string().max(200).optional(),
  message: z.string().max(5000).optional(),
  mileage: z.number().min(0).optional(),
  cost_net: z.number().min(0).optional(),
  cost_gross: z.number().min(0).optional(),
  currency: z.string().max(3).optional(),
  supplier: z.string().optional(),
  invoice_number: z.string().optional(),
  event_date: z.string().optional(),
})

type EditFormValues = z.infer<typeof editSchema>

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface HistoryTabProps {
  vehicleId: string
  currentMileage: number | null
}

export function HistoryTab({ vehicleId, currentMileage }: HistoryTabProps) {
  const { user, isLoading: userLoading } = useUser()
  const [entries, setEntries] = useState<HistoryEntryT[]>([])
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [typeFilter, setTypeFilter] = useState<HistoryEntryType | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [editEntry, setEditEntry] = useState<HistoryEntryT | null>(null)

  const fetchEntries = useCallback(
    async (pageNum: number, append: boolean) => {
      if (append) {
        setIsLoadingMore(true)
      } else {
        setIsLoading(true)
      }

      try {
        const params = new URLSearchParams({ page: String(pageNum) })
        if (typeFilter) params.set("type", typeFilter)

        const res = await fetch(
          `/api/vehicles/${vehicleId}/history?${params.toString()}`
        )
        if (!res.ok) throw new Error("Fehler beim Laden der Historie.")

        const json: PaginatedHistory = await res.json()

        if (append) {
          setEntries((prev) => [...prev, ...json.data])
        } else {
          setEntries(json.data)
        }
        setHasMore(json.hasMore)
        setPage(pageNum)
      } catch {
        // Silently fail — empty state will show
      } finally {
        setIsLoading(false)
        setIsLoadingMore(false)
      }
    },
    [vehicleId, typeFilter]
  )

  // Fetch on mount and filter change
  useEffect(() => {
    setEntries([])
    setPage(1)
    fetchEntries(1, false)
  }, [fetchEntries])

  function handleLoadMore() {
    fetchEntries(page + 1, true)
  }

  function handleEntryCreated(entry: HistoryEntryT) {
    setEntries((prev) => [...prev, entry])
  }

  async function handleDelete(entryId: string) {
    try {
      const res = await fetch(
        `/api/vehicles/${vehicleId}/history/${entryId}`,
        { method: "DELETE" }
      )
      if (!res.ok) throw new Error()
      setEntries((prev) => prev.filter((e) => e.id !== entryId))
    } catch {
      // Could show toast here
    }
  }

  function handleEdit(entry: HistoryEntryT) {
    setEditEntry(entry)
  }

  function handleEditSaved(updated: HistoryEntryT) {
    setEntries((prev) =>
      prev.map((e) => (e.id === updated.id ? updated : e))
    )
    setEditEntry(null)
  }

  const canCreate =
    user && hasPermission(user.role, "vehicles.history.create")

  if (userLoading || isLoading) {
    return <HistoryTabSkeleton />
  }

  return (
    <div className="flex flex-col">
      {/* Filter bar */}
      <div className="flex flex-wrap gap-2 border-b border-border pb-3">
        {QUICK_FILTERS.map((filter) => (
          <Badge
            key={filter.label}
            variant={typeFilter === filter.value ? "default" : "outline"}
            className="cursor-pointer"
            onClick={() => setTypeFilter(filter.value)}
            role="button"
            tabIndex={0}
            aria-label={`Filter: ${filter.label}`}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault()
                setTypeFilter(filter.value)
              }
            }}
          >
            {filter.label}
          </Badge>
        ))}
      </div>

      {/* Feed */}
      <div className="min-h-[200px]">
        {entries.length === 0 && !isLoading ? (
          <div className="flex flex-col items-center justify-center py-16">
            <p className="text-sm text-muted-foreground">
              Noch keine Historieneintraege vorhanden. Fuege den ersten Eintrag
              hinzu.
            </p>
          </div>
        ) : (
          <div>
            {entries.map((entry) => (
              <HistoryEntry
                key={entry.id}
                entry={entry}
                currentUserId={user?.id || ""}
                userRole={user?.role || "READ_ONLY"}
                vehicleId={vehicleId}
                onDelete={handleDelete}
                onEdit={handleEdit}
              />
            ))}

            {hasMore && (
              <div className="flex justify-center py-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={handleLoadMore}
                  disabled={isLoadingMore}
                >
                  {isLoadingMore && (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  )}
                  Mehr laden
                </Button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Input form */}
      {canCreate && (
        <HistoryEntryInput
          vehicleId={vehicleId}
          currentMileage={currentMileage}
          onEntryCreated={handleEntryCreated}
        />
      )}

      {/* Edit sheet */}
      {editEntry && (
        <EditEntrySheet
          entry={editEntry}
          vehicleId={vehicleId}
          onClose={() => setEditEntry(null)}
          onSaved={handleEditSaved}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Edit Sheet
// ---------------------------------------------------------------------------

interface EditEntrySheetProps {
  entry: HistoryEntryT
  vehicleId: string
  onClose: () => void
  onSaved: (entry: HistoryEntryT) => void
}

function EditEntrySheet({
  entry,
  vehicleId,
  onClose,
  onSaved,
}: EditEntrySheetProps) {
  const [isSubmitting, setIsSubmitting] = useState(false)

  const editResolver: Resolver<EditFormValues> = async (values) => {
    const result = editSchema.safeParse(values)
    if (result.success) return { values: result.data, errors: {} }
    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join(".")
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message }
    }
    return { values: {}, errors }
  }

  const form = useForm<EditFormValues>({
    resolver: editResolver,
    defaultValues: {
      entry_type: entry.entry_type,
      title: entry.title || "",
      message: entry.message || "",
      mileage: entry.mileage ?? undefined,
      cost_net: entry.cost_net ?? undefined,
      cost_gross: entry.cost_gross ?? undefined,
      currency: entry.currency || "EUR",
      supplier: entry.supplier || "",
      invoice_number: entry.invoice_number || "",
      event_date: toLocalDatetimeString(new Date(entry.event_date)),
    },
  })

  async function onSubmit(values: EditFormValues) {
    setIsSubmitting(true)
    try {
      const body: Record<string, unknown> = {
        entry_type: values.entry_type,
        event_date: values.event_date
          ? new Date(values.event_date).toISOString()
          : entry.event_date,
      }
      if (values.title?.trim()) body.title = values.title.trim()
      else body.title = null
      if (values.message?.trim()) body.message = values.message.trim()
      else body.message = null
      if (values.mileage != null) body.mileage = values.mileage
      else body.mileage = null
      if (values.cost_net != null) body.cost_net = values.cost_net
      else body.cost_net = null
      if (values.cost_gross != null) body.cost_gross = values.cost_gross
      else body.cost_gross = null
      if (values.currency?.trim()) body.currency = values.currency.trim()
      if (values.supplier?.trim()) body.supplier = values.supplier.trim()
      else body.supplier = null
      if (values.invoice_number?.trim())
        body.invoice_number = values.invoice_number.trim()
      else body.invoice_number = null

      const res = await fetch(
        `/api/vehicles/${vehicleId}/history/${entry.id}`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      )

      if (!res.ok) throw new Error("Eintrag konnte nicht aktualisiert werden.")

      const updated: HistoryEntryT = await res.json()
      onSaved(updated)
    } catch {
      // Could show toast
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Sheet open onOpenChange={(open) => !open && onClose()}>
      <SheetContent className="overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>Eintrag bearbeiten</SheetTitle>
          <SheetDescription>
            Aendere die Felder und speichere den Eintrag.
          </SheetDescription>
        </SheetHeader>

        <Form {...form}>
          <form
            onSubmit={form.handleSubmit(onSubmit)}
            className="mt-6 space-y-4"
          >
            <FormField
              control={form.control}
              name="entry_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Typ</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {ENTRY_TYPES.map((type) => (
                        <SelectItem key={type} value={type}>
                          {ENTRY_TYPE_CONFIG[type].label}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="title"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Titel</FormLabel>
                  <FormControl>
                    <Input {...field} maxLength={200} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Nachricht</FormLabel>
                  <FormControl>
                    <Textarea {...field} rows={4} maxLength={5000} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="mileage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kilometerstand</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="event_date"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Datum</FormLabel>
                    <FormControl>
                      <Input type="datetime-local" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="cost_net"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kosten netto</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="cost_gross"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kosten brutto</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step={0.01}
                        value={field.value ?? ""}
                        onChange={(e) =>
                          field.onChange(
                            e.target.value === ""
                              ? undefined
                              : Number(e.target.value)
                          )
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Waehrung</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={3} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="supplier"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Lieferant / Werkstatt</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="invoice_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Rechnungsnummer</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="flex justify-end gap-2 pt-4">
              <Button type="button" variant="outline" onClick={onClose}>
                Abbrechen
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                Speichern
              </Button>
            </div>
          </form>
        </Form>
      </SheetContent>
    </Sheet>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function HistoryTabSkeleton() {
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {Array.from({ length: 5 }).map((_, i) => (
          <Skeleton key={i} className="h-6 w-20 rounded-full" />
        ))}
      </div>
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="flex gap-3 border-b border-border py-4">
          <Skeleton className="h-8 w-8 rounded-full" />
          <div className="flex-1 space-y-2">
            <Skeleton className="h-4 w-48" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-2/3" />
          </div>
        </div>
      ))}
    </div>
  )
}
