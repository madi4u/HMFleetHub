"use client"

import { useState, useRef } from "react"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { z } from "zod"
import { Paperclip, ChevronDown, ChevronUp, Loader2, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { ENTRY_TYPE_CONFIG } from "@/components/fleet/history/entry-type-badge"
import type { HistoryEntry, HistoryEntryType, RepairStatus } from "@/types/database"

const ENTRY_TYPES = Object.keys(ENTRY_TYPE_CONFIG) as HistoryEntryType[]
const MAX_FILES = 10
const MAX_MESSAGE_LENGTH = 5000

const historyEntrySchema = z.object({
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
  message: z.string().max(MAX_MESSAGE_LENGTH).optional(),
  title: z.string().max(200).optional(),
  mileage: z.number().min(0).optional(),
  cost_net: z.number().min(0).optional(),
  cost_gross: z.number().min(0).optional(),
  currency: z.string().max(3).optional(),
  supplier: z.string().optional(),
  invoice_number: z.string().optional(),
  event_date: z.string().optional(),
  repair_status: z.enum(["OPEN", "IN_PROGRESS", "DONE"]).optional().nullable(),
  next_due_date: z.string().optional().nullable(),
})

type HistoryEntryFormValues = z.infer<typeof historyEntrySchema>

function formatFileSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

function toLocalDatetimeString(date: Date): string {
  const pad = (n: number) => n.toString().padStart(2, "0")
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`
}

interface HistoryEntryInputProps {
  vehicleId: string
  currentMileage: number | null
  onEntryCreated: (entry: HistoryEntry) => void
}

export function HistoryEntryInput({
  vehicleId,
  currentMileage,
  onEntryCreated,
}: HistoryEntryInputProps) {
  const [showMore, setShowMore] = useState(false)
  const [files, setFiles] = useState<File[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const historyEntryResolver: Resolver<HistoryEntryFormValues> = async (values) => {
    const result = historyEntrySchema.safeParse(values)
    if (result.success) return { values: result.data, errors: {} }
    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join(".")
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message }
    }
    return { values: {}, errors }
  }

  const form = useForm<HistoryEntryFormValues>({
    resolver: historyEntryResolver,
    defaultValues: {
      entry_type: undefined,
      message: "",
      title: "",
      currency: "EUR",
      supplier: "",
      invoice_number: "",
      event_date: toLocalDatetimeString(new Date()),
    },
  })

  const watchedType = form.watch("entry_type")
  const isRepairType = ["REPAIR", "MAINTENANCE", "DAMAGE"].includes(watchedType ?? "")
  const messageValue = form.watch("message") || ""
  const mileageValue = form.watch("mileage")

  const mileageWarning =
    mileageValue != null &&
    currentMileage != null &&
    mileageValue < currentMileage

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const selected = e.target.files
    if (!selected) return
    const newFiles = [...files, ...Array.from(selected)].slice(0, MAX_FILES)
    setFiles(newFiles)
    // Reset input so the same file can be selected again
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  function removeFile(index: number) {
    setFiles((prev) => prev.filter((_, i) => i !== index))
  }

  async function onSubmit(values: HistoryEntryFormValues) {
    // Validate: need message OR files
    if (!values.message?.trim() && files.length === 0) {
      form.setError("message", {
        message: "Bitte eine Nachricht eingeben oder mindestens eine Datei anhaengen.",
      })
      return
    }

    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // 1. Create the history entry
      const body: Record<string, unknown> = {
        entry_type: values.entry_type,
        event_date: values.event_date
          ? new Date(values.event_date).toISOString()
          : new Date().toISOString(),
      }
      if (values.message?.trim()) body.message = values.message.trim()
      if (values.title?.trim()) body.title = values.title.trim()
      if (values.mileage != null) body.mileage = values.mileage
      if (values.cost_net != null) body.cost_net = values.cost_net
      if (values.cost_gross != null) body.cost_gross = values.cost_gross
      if (values.currency?.trim()) body.currency = values.currency.trim()
      if (values.supplier?.trim()) body.supplier = values.supplier.trim()
      if (values.invoice_number?.trim())
        body.invoice_number = values.invoice_number.trim()
      if (values.repair_status) body.repair_status = values.repair_status
      if (values.next_due_date) body.next_due_date = values.next_due_date

      const entryRes = await fetch(`/api/vehicles/${vehicleId}/history`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (!entryRes.ok) {
        const errData = await entryRes.json().catch(() => null)
        throw new Error(
          errData?.error || "Eintrag konnte nicht erstellt werden."
        )
      }

      let entry: HistoryEntry = await entryRes.json()

      // 2. Upload attachments
      if (files.length > 0) {
        const uploadedAttachments = []
        for (const file of files) {
          const formData = new FormData()
          formData.append("file", file)
          const attRes = await fetch(
            `/api/vehicles/${vehicleId}/history/${entry.id}/attachments`,
            { method: "POST", body: formData }
          )
          if (attRes.ok) {
            const att = await attRes.json()
            uploadedAttachments.push(att)
          }
        }
        entry = { ...entry, attachments: uploadedAttachments }
      }

      // 3. Notify parent and reset
      onEntryCreated(entry)
      form.reset({
        entry_type: undefined,
        message: "",
        title: "",
        currency: "EUR",
        supplier: "",
        invoice_number: "",
        event_date: toLocalDatetimeString(new Date()),
        repair_status: null,
        next_due_date: null,
      })
      setFiles([])
      setShowMore(false)
    } catch (err) {
      setSubmitError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="border-t border-border bg-card p-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-3">
          {/* Row 1: Entry type + message */}
          <div className="flex flex-col gap-3 sm:flex-row">
            <FormField
              control={form.control}
              name="entry_type"
              render={({ field }) => (
                <FormItem className="w-full sm:w-48">
                  <FormLabel>Typ *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value || ""}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Typ waehlen..." />
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
              name="message"
              render={({ field }) => (
                <FormItem className="flex-1">
                  <FormLabel>Nachricht</FormLabel>
                  <FormControl>
                    <Textarea
                      {...field}
                      placeholder="Beschreibung eingeben..."
                      rows={2}
                      maxLength={MAX_MESSAGE_LENGTH}
                    />
                  </FormControl>
                  <div className="flex justify-between">
                    <FormMessage />
                    <span className="text-xs text-muted-foreground">
                      {messageValue.length}/{MAX_MESSAGE_LENGTH}
                    </span>
                  </div>
                </FormItem>
              )}
            />
          </div>

          {/* More fields toggle */}
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-7 text-xs"
            onClick={() => setShowMore(!showMore)}
          >
            {showMore ? (
              <ChevronUp className="mr-1 h-3 w-3" />
            ) : (
              <ChevronDown className="mr-1 h-3 w-3" />
            )}
            Weitere Felder
          </Button>

          {/* Collapsible additional fields */}
          {showMore && (
            <div className="space-y-3 rounded-md border border-border p-3">
              <FormField
                control={form.control}
                name="title"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Titel</FormLabel>
                    <FormControl>
                      <Input {...field} maxLength={200} placeholder="Optionaler Titel" />
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
                          placeholder="z.B. 85000"
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
                      {mileageWarning && (
                        <p className="text-xs text-yellow-400">
                          Eingegebener Kilometerstand (
                          {mileageValue?.toLocaleString("de-DE")} km) ist kleiner
                          als der letzte bekannte Wert (
                          {currentMileage?.toLocaleString("de-DE")} km).
                        </p>
                      )}
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
                          placeholder="0.00"
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
                          placeholder="0.00"
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
                        <Input {...field} maxLength={3} placeholder="EUR" />
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
                        <Input {...field} placeholder="z.B. ATU Muenchen" />
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
                        <Input {...field} placeholder="z.B. RE-2026-001" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              {/* PROJ-9: Repair-specific fields */}
              {isRepairType && (
                <div className="grid gap-3 sm:grid-cols-2">
                  <FormField
                    control={form.control}
                    name="repair_status"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Status</FormLabel>
                        <Select
                          onValueChange={(v) => field.onChange(v as RepairStatus)}
                          value={field.value || ""}
                        >
                          <FormControl>
                            <SelectTrigger>
                              <SelectValue placeholder="Status waehlen..." />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="OPEN">Offen</SelectItem>
                            <SelectItem value="IN_PROGRESS">In Bearbeitung</SelectItem>
                            <SelectItem value="DONE">Abgeschlossen</SelectItem>
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />

                  <FormField
                    control={form.control}
                    name="next_due_date"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Folgetermin</FormLabel>
                        <FormControl>
                          <Input
                            type="date"
                            value={field.value || ""}
                            onChange={field.onChange}
                          />
                        </FormControl>
                        {field.value && new Date(field.value) < new Date() && (
                          <p className="text-xs text-yellow-400">
                            Das Datum liegt in der Vergangenheit.
                          </p>
                        )}
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>
              )}
            </div>
          )}

          {/* File upload */}
          <div className="space-y-2">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              accept="image/*,video/*,application/pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx"
              className="hidden"
              onChange={handleFileSelect}
              aria-label="Anhaenge auswaehlen"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="h-8 text-xs"
              onClick={() => fileInputRef.current?.click()}
            >
              <Paperclip className="mr-1 h-3 w-3" />
              Anhaenge hinzufuegen
            </Button>

            {files.length > 0 && (
              <div className="space-y-1">
                {files.map((file, i) => (
                  <div
                    key={`${file.name}-${i}`}
                    className="flex items-center gap-2 text-xs text-muted-foreground"
                  >
                    <span className="truncate">{file.name}</span>
                    <span className="shrink-0">
                      ({formatFileSize(file.size)})
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      className="h-5 w-5 p-0"
                      onClick={() => removeFile(i)}
                      aria-label={`${file.name} entfernen`}
                    >
                      <X className="h-3 w-3" />
                    </Button>
                  </div>
                ))}
                {files.length >= MAX_FILES && (
                  <p className="text-xs text-yellow-400">
                    Maximal {MAX_FILES} Dateien erlaubt.
                  </p>
                )}
              </div>
            )}
          </div>

          {/* Submit error */}
          {submitError && (
            <p className="text-sm text-destructive">{submitError}</p>
          )}

          {/* Submit */}
          <div className="flex justify-end">
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Eintrag erstellen
            </Button>
          </div>
        </form>
      </Form>
    </div>
  )
}
