"use client"

import { useState, useEffect, useCallback } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { Loader2, Plus, Clock, User, MapPin } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Skeleton } from "@/components/ui/skeleton"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import type { MileageEntry } from "@/types/database"

// ---------------------------------------------------------------------------
// Schema
// ---------------------------------------------------------------------------

const mileageSchema = z.object({
  mileage: z.coerce.number().int().min(0, "Kilometerstand muss mindestens 0 sein"),
  recorded_at: z.string().min(1, "Datum ist erforderlich"),
  source: z.string().optional(),
})

type MileageFormValues = z.infer<typeof mileageSchema>

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function toDatetimeLocalValue(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface MileageSectionProps {
  vehicleId: string
  currentMileage: number | null
  canEdit: boolean
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function MileageSection({
  vehicleId,
  currentMileage,
  canEdit,
}: MileageSectionProps) {
  const [entries, setEntries] = useState<MileageEntry[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [page, setPage] = useState(1)
  const [hasMore, setHasMore] = useState(false)
  const [loadingMore, setLoadingMore] = useState(false)
  const [dialogOpen, setDialogOpen] = useState(false)

  const fetchEntries = useCallback(
    async (pageNum: number, append = false) => {
      if (pageNum === 1) setIsLoading(true)
      else setLoadingMore(true)
      setError(null)

      try {
        const res = await fetch(
          `/api/vehicles/${vehicleId}/mileage?page=${pageNum}`
        )
        if (!res.ok) throw new Error("Kilometerstand-Daten konnten nicht geladen werden.")
        const json = await res.json()
        const newEntries: MileageEntry[] = json.data ?? []
        setEntries((prev) => (append ? [...prev, ...newEntries] : newEntries))
        setHasMore(json.hasMore ?? false)
        setPage(pageNum)
      } catch (err) {
        setError(
          err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
        )
      } finally {
        setIsLoading(false)
        setLoadingMore(false)
      }
    },
    [vehicleId]
  )

  useEffect(() => {
    fetchEntries(1)
  }, [fetchEntries])

  function handleNewEntry(entry: MileageEntry) {
    setEntries((prev) => [entry, ...prev])
    setDialogOpen(false)
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between gap-4">
          <CardTitle>Kilometerstand-Verlauf</CardTitle>
          {canEdit && (
            <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogTrigger asChild>
                <Button size="sm">
                  <Plus className="mr-2 h-4 w-4" />
                  Aktualisieren
                </Button>
              </DialogTrigger>
              <MileageDialog
                vehicleId={vehicleId}
                currentMileage={currentMileage}
                onSuccess={handleNewEntry}
              />
            </Dialog>
          )}
        </div>
      </CardHeader>
      <CardContent>
        {isLoading ? (
          <MileageListSkeleton />
        ) : error ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : entries.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Noch keine Kilometerstand-Eintraege vorhanden.
          </p>
        ) : (
          <div className="space-y-3">
            {entries.map((entry) => (
              <MileageRow key={entry.id} entry={entry} />
            ))}
            {hasMore && (
              <Button
                variant="outline"
                size="sm"
                className="w-full"
                disabled={loadingMore}
                onClick={() => fetchEntries(page + 1, true)}
              >
                {loadingMore ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Laden...
                  </>
                ) : (
                  "Mehr laden"
                )}
              </Button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ---------------------------------------------------------------------------
// Mileage Row
// ---------------------------------------------------------------------------

function MileageRow({ entry }: { entry: MileageEntry }) {
  const dateStr = new Date(entry.recorded_at).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })

  return (
    <div className="flex items-start justify-between gap-4 rounded-md border border-border p-3">
      <div className="space-y-1">
        <p className="text-sm font-semibold">
          {entry.mileage.toLocaleString("de-DE")} km
        </p>
        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            {dateStr}
          </span>
          {entry.author_name && (
            <span className="inline-flex items-center gap-1">
              <User className="h-3 w-3" />
              {entry.author_name}
            </span>
          )}
          {entry.source && (
            <span className="inline-flex items-center gap-1">
              <MapPin className="h-3 w-3" />
              {entry.source}
            </span>
          )}
        </div>
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// Mileage Dialog (Form)
// ---------------------------------------------------------------------------

function MileageDialog({
  vehicleId,
  currentMileage,
  onSuccess,
}: {
  vehicleId: string
  currentMileage: number | null
  onSuccess: (entry: MileageEntry) => void
}) {
  const [submitting, setSubmitting] = useState(false)
  const [apiError, setApiError] = useState<string | null>(null)

  const form = useForm<MileageFormValues>({
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    resolver: standardSchemaResolver(mileageSchema) as any,
    defaultValues: {
      mileage: undefined as unknown as number,
      recorded_at: toDatetimeLocalValue(new Date()),
      source: "",
    },
  })

  const watchedMileage = form.watch("mileage")

  const isLowerThanCurrent =
    currentMileage != null &&
    watchedMileage != null &&
    !isNaN(watchedMileage) &&
    watchedMileage < currentMileage

  const isLargeJump =
    currentMileage != null &&
    watchedMileage != null &&
    !isNaN(watchedMileage) &&
    watchedMileage - currentMileage > 50000

  async function onSubmit(values: MileageFormValues) {
    setSubmitting(true)
    setApiError(null)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/mileage`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          mileage: values.mileage,
          recorded_at: new Date(values.recorded_at).toISOString(),
          source: values.source || null,
        }),
      })
      if (!res.ok) {
        const json = await res.json().catch(() => null)
        throw new Error(
          json?.error ?? "Kilometerstand konnte nicht gespeichert werden."
        )
      }
      const entry: MileageEntry = await res.json()
      onSuccess(entry)
      form.reset()
    } catch (err) {
      setApiError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Kilometerstand aktualisieren</DialogTitle>
        <DialogDescription>
          Aktuellen Kilometerstand fuer dieses Fahrzeug erfassen.
        </DialogDescription>
      </DialogHeader>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          <FormField
            control={form.control}
            name="mileage"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Neuer Kilometerstand (km)</FormLabel>
                <FormControl>
                  <Input
                    type="number"
                    placeholder="z.B. 85000"
                    {...field}
                    onChange={(e) => field.onChange(e.target.valueAsNumber)}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {isLowerThanCurrent && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10 text-yellow-500">
              <AlertDescription>
                Eingegebener Kilometerstand (
                {watchedMileage.toLocaleString("de-DE")} km) ist kleiner als der
                letzte bekannte Wert (
                {currentMileage!.toLocaleString("de-DE")} km). Moechtest du
                trotzdem speichern?
              </AlertDescription>
            </Alert>
          )}

          {isLargeJump && (
            <Alert className="border-yellow-500/50 bg-yellow-500/10 text-yellow-500">
              <AlertDescription>
                Grosser Sprung erkannt: +
                {(watchedMileage - currentMileage!).toLocaleString("de-DE")} km.
                Bitte pruefen.
              </AlertDescription>
            </Alert>
          )}

          <FormField
            control={form.control}
            name="recorded_at"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Datum/Uhrzeit</FormLabel>
                <FormControl>
                  <Input type="datetime-local" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="source"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Quelle/Bemerkung (optional)</FormLabel>
                <FormControl>
                  <Input placeholder="z.B. Werkstattbesuch" {...field} />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          {apiError && (
            <Alert variant="destructive">
              <AlertDescription>{apiError}</AlertDescription>
            </Alert>
          )}

          <DialogFooter>
            <Button type="submit" disabled={submitting}>
              {submitting && (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              )}
              Speichern
            </Button>
          </DialogFooter>
        </form>
      </Form>
    </DialogContent>
  )
}

// ---------------------------------------------------------------------------
// Skeleton
// ---------------------------------------------------------------------------

function MileageListSkeleton() {
  return (
    <div className="space-y-3">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="rounded-md border border-border p-3 space-y-2">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-3 w-48" />
        </div>
      ))}
    </div>
  )
}
