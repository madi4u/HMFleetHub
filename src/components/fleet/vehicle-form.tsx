"use client"

import { useState, useRef } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { standardSchemaResolver } from "@hookform/resolvers/standard-schema"
import { Loader2, Upload, X } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Separator } from "@/components/ui/separator"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { VehiclePhoto } from "@/components/fleet/vehicle-photo"
import type { Vehicle } from "@/types/database"

const vehicleFormSchema = z.object({
  license_plate: z.string().min(1, "Kennzeichen ist erforderlich."),
  make: z.string().min(1, "Marke ist erforderlich."),
  model: z.string().min(1, "Modell ist erforderlich."),
  vehicle_type: z.enum(
    ["PKW", "LKW", "Transporter", "Motorrad", "Anh\u00e4nger", "Sonstige"],
    { message: "Fahrzeugtyp ist erforderlich." }
  ),
  status: z.enum(
    ["Aktiv", "Inaktiv", "In Werkstatt", "Verkauft", "Abgemeldet"],
    { message: "Status ist erforderlich." }
  ),
  vin: z.string().optional(),
  first_registration: z.string().optional(),
  year: z.string().optional(),
  color: z.string().optional(),
  current_mileage: z.string().optional(),
  location: z.string().optional(),
  assigned_to: z.string().optional(),
  notes: z.string().optional(),
  tire_size: z.string().optional(),
  engine_oil_spec: z.string().optional(),
  transmission_oil_spec: z.string().optional(),
  fuel_type: z.string().optional(),
  engine_code: z.string().optional(),
  engine_power: z.string().optional(),
  hsn: z.string().optional(),
  tsn: z.string().optional(),
  service_interval_notes: z.string().optional(),
  technical_notes: z.string().optional(),
})

type FormValues = z.infer<typeof vehicleFormSchema>

/**
 * Converts form string values to the API-ready payload.
 * Numeric fields are parsed; empty strings become undefined.
 */
function formToPayload(values: FormValues) {
  return {
    license_plate: values.license_plate.toUpperCase(),
    make: values.make,
    model: values.model,
    vehicle_type: values.vehicle_type,
    status: values.status,
    vin: values.vin || undefined,
    first_registration: values.first_registration || undefined,
    year: values.year ? parseInt(values.year, 10) : undefined,
    color: values.color || undefined,
    current_mileage: values.current_mileage
      ? parseInt(values.current_mileage, 10)
      : undefined,
    location: values.location || undefined,
    assigned_to: values.assigned_to || undefined,
    notes: values.notes || undefined,
    tire_size: values.tire_size || undefined,
    engine_oil_spec: values.engine_oil_spec || undefined,
    transmission_oil_spec: values.transmission_oil_spec || undefined,
    fuel_type: values.fuel_type || undefined,
    engine_code: values.engine_code || undefined,
    engine_power: values.engine_power
      ? parseInt(values.engine_power, 10)
      : undefined,
    hsn: values.hsn || undefined,
    tsn: values.tsn || undefined,
    service_interval_notes: values.service_interval_notes || undefined,
    technical_notes: values.technical_notes || undefined,
  }
}

export type VehicleFormValues = ReturnType<typeof formToPayload>

interface VehicleFormProps {
  vehicle?: Vehicle | null
  onSubmit: (values: VehicleFormValues, imageFile: File | null) => Promise<void>
  submitLabel?: string
  onCancel?: () => void
}

export function VehicleForm({
  vehicle,
  onSubmit,
  submitLabel = "Speichern",
  onCancel,
}: VehicleFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [imageFile, setImageFile] = useState<File | null>(null)
  const [imagePreview, setImagePreview] = useState<string | null>(
    vehicle?.image_url ?? null
  )
  const fileInputRef = useRef<HTMLInputElement>(null)

  const form = useForm<FormValues>({
    resolver: standardSchemaResolver(vehicleFormSchema),
    defaultValues: {
      license_plate: vehicle?.license_plate ?? "",
      make: vehicle?.make ?? "",
      model: vehicle?.model ?? "",
      vehicle_type: vehicle?.vehicle_type ?? undefined,
      status: vehicle?.status ?? "Aktiv",
      vin: vehicle?.vin ?? "",
      first_registration: vehicle?.first_registration ?? "",
      year: vehicle?.year != null ? String(vehicle.year) : "",
      color: vehicle?.color ?? "",
      current_mileage:
        vehicle?.current_mileage != null
          ? String(vehicle.current_mileage)
          : "",
      location: vehicle?.location ?? "",
      assigned_to: vehicle?.assigned_to ?? "",
      notes: vehicle?.notes ?? "",
      tire_size: vehicle?.tire_size ?? "",
      engine_oil_spec: vehicle?.engine_oil_spec ?? "",
      transmission_oil_spec: vehicle?.transmission_oil_spec ?? "",
      fuel_type: vehicle?.fuel_type ?? "",
      engine_code: vehicle?.engine_code ?? "",
      engine_power:
        vehicle?.engine_power != null ? String(vehicle.engine_power) : "",
      hsn: vehicle?.hsn ?? "",
      tsn: vehicle?.tsn ?? "",
      service_interval_notes: vehicle?.service_interval_notes ?? "",
      technical_notes: vehicle?.technical_notes ?? "",
    },
  })

  function handleImageChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return

    setImageFile(file)
    const reader = new FileReader()
    reader.onload = (ev) => {
      setImagePreview(ev.target?.result as string)
    }
    reader.readAsDataURL(file)
  }

  function removeImage() {
    setImageFile(null)
    setImagePreview(null)
    if (fileInputRef.current) {
      fileInputRef.current.value = ""
    }
  }

  async function handleSubmit(values: FormValues) {
    setIsSubmitting(true)
    setError(null)

    try {
      const payload = formToPayload(values)
      await onSubmit(payload, imageFile)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ein Fehler ist aufgetreten. Bitte versuchen Sie es erneut."
      )
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(handleSubmit)}
        className="space-y-8"
        noValidate
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {/* Section: Stammdaten */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Stammdaten</h2>
          <Separator />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="license_plate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kennzeichen *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. M-AB 1234"
                      disabled={isSubmitting}
                      aria-label="Kennzeichen"
                      className="uppercase"
                      {...field}
                      onChange={(e) =>
                        field.onChange(e.target.value.toUpperCase())
                      }
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="make"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Marke *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. Mercedes-Benz"
                      disabled={isSubmitting}
                      aria-label="Marke"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="model"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Modell *</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. Sprinter 316 CDI"
                      disabled={isSubmitting}
                      aria-label="Modell"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="vehicle_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fahrzeugtyp *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Fahrzeugtyp">
                        <SelectValue placeholder="Fahrzeugtyp waehlen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="PKW">PKW</SelectItem>
                      <SelectItem value="LKW">LKW</SelectItem>
                      <SelectItem value="Transporter">Transporter</SelectItem>
                      <SelectItem value="Motorrad">Motorrad</SelectItem>
                      <SelectItem value="Anhänger">Anhaenger</SelectItem>
                      <SelectItem value="Sonstige">Sonstige</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="status"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Status *</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Status">
                        <SelectValue placeholder="Status waehlen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Aktiv">Aktiv</SelectItem>
                      <SelectItem value="Inaktiv">Inaktiv</SelectItem>
                      <SelectItem value="In Werkstatt">In Werkstatt</SelectItem>
                      <SelectItem value="Verkauft">Verkauft</SelectItem>
                      <SelectItem value="Abgemeldet">Abgemeldet</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Photo upload */}
          <div className="space-y-2">
            <FormLabel>Fahrzeugfoto</FormLabel>
            <div className="flex items-center gap-4">
              <VehiclePhoto
                imageUrl={imagePreview}
                licensePlate={form.getValues("license_plate") || "Fahrzeug"}
                size="md"
              />
              <div className="flex flex-col gap-2">
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => fileInputRef.current?.click()}
                  disabled={isSubmitting}
                >
                  <Upload className="mr-2 h-4 w-4" />
                  Bild waehlen
                </Button>
                {imagePreview && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={removeImage}
                    disabled={isSubmitting}
                  >
                    <X className="mr-2 h-4 w-4" />
                    Bild entfernen
                  </Button>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/*"
                  className="hidden"
                  onChange={handleImageChange}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section: Weitere Daten */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Weitere Daten</h2>
          <Separator />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="vin"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Fahrgestellnummer (VIN)</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. WDB9066351S123456"
                      disabled={isSubmitting}
                      aria-label="Fahrgestellnummer"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="first_registration"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Erstzulassung</FormLabel>
                  <FormControl>
                    <Input
                      type="date"
                      disabled={isSubmitting}
                      aria-label="Erstzulassung"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="year"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Baujahr</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="z. B. 2022"
                      disabled={isSubmitting}
                      aria-label="Baujahr"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="color"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Farbe</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. Weiss"
                      disabled={isSubmitting}
                      aria-label="Farbe"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="current_mileage"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kilometerstand</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="z. B. 45000"
                      disabled={isSubmitting}
                      aria-label="Kilometerstand"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="location"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Standort</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. Muenchen Zentrale"
                      disabled={isSubmitting}
                      aria-label="Standort"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="assigned_to"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Zugewiesen an</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. Max Mustermann"
                      disabled={isSubmitting}
                      aria-label="Zugewiesen an"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Notizen</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Allgemeine Notizen zum Fahrzeug..."
                    disabled={isSubmitting}
                    aria-label="Notizen"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Section: Technische Daten */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold">Technische Daten</h2>
          <Separator />

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            <FormField
              control={form.control}
              name="tire_size"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Reifengroesse</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. 225/65 R16C"
                      disabled={isSubmitting}
                      aria-label="Reifengroesse"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="engine_oil_spec"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motoroel-Spezifikation</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. 5W-30 MB 229.52"
                      disabled={isSubmitting}
                      aria-label="Motoroel-Spezifikation"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="transmission_oil_spec"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Getriebeoel-Spezifikation</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. MB 236.14"
                      disabled={isSubmitting}
                      aria-label="Getriebeoel-Spezifikation"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="fuel_type"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Kraftstoffart</FormLabel>
                  <Select
                    onValueChange={field.onChange}
                    value={field.value ?? ""}
                    disabled={isSubmitting}
                  >
                    <FormControl>
                      <SelectTrigger aria-label="Kraftstoffart">
                        <SelectValue placeholder="Kraftstoffart waehlen" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="Benzin">Benzin</SelectItem>
                      <SelectItem value="Diesel">Diesel</SelectItem>
                      <SelectItem value="Elektro">Elektro</SelectItem>
                      <SelectItem value="Hybrid">Hybrid</SelectItem>
                      <SelectItem value="Gas">Gas</SelectItem>
                      <SelectItem value="Sonstige">Sonstige</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="engine_code"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Motorisierung</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. OM 651 DE 22 LA"
                      disabled={isSubmitting}
                      aria-label="Motorisierung"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="engine_power"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Leistung (kW)</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      placeholder="z. B. 120"
                      disabled={isSubmitting}
                      aria-label="Leistung in kW"
                      {...field}
                      value={field.value ?? ""}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="hsn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>HSN</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. 0710"
                      disabled={isSubmitting}
                      aria-label="Herstellerschluesselnummer"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tsn"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>TSN</FormLabel>
                  <FormControl>
                    <Input
                      placeholder="z. B. BAI"
                      disabled={isSubmitting}
                      aria-label="Typschluesselnummer"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <FormField
            control={form.control}
            name="service_interval_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Servicehinweise</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Serviceintervall-Hinweise..."
                    disabled={isSubmitting}
                    aria-label="Servicehinweise"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />

          <FormField
            control={form.control}
            name="technical_notes"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Technische Bemerkungen</FormLabel>
                <FormControl>
                  <Textarea
                    placeholder="Technische Bemerkungen zum Fahrzeug..."
                    disabled={isSubmitting}
                    aria-label="Technische Bemerkungen"
                    rows={3}
                    {...field}
                  />
                </FormControl>
                <FormMessage />
              </FormItem>
            )}
          />
        </div>

        {/* Actions */}
        <div className="flex gap-3 pt-2">
          <Button type="submit" disabled={isSubmitting}>
            {isSubmitting ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Speichern...
              </>
            ) : (
              submitLabel
            )}
          </Button>
          {onCancel && (
            <Button
              type="button"
              variant="outline"
              onClick={onCancel}
              disabled={isSubmitting}
            >
              Abbrechen
            </Button>
          )}
        </div>
      </form>
    </Form>
  )
}
