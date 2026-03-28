"use client"

import { useEffect, useState } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { ScrollArea } from "@/components/ui/scroll-area"
import type { Contract } from "@/types/database"

const contractFormSchema = z
  .object({
    contract_type: z.enum(["LEASING", "FINANCING", "PURCHASE"], {
      message: "Vertragsart ist erforderlich.",
    }),
    contract_status: z.enum(["ACTIVE", "EXPIRED", "CANCELLED", "PLANNED"], {
      message: "Status ist erforderlich.",
    }),
    provider: z.string().min(1, "Anbieter ist erforderlich."),
    contract_start: z.string().min(1, "Vertragsbeginn ist erforderlich."),
    contract_end: z.string().optional(),
    contract_number: z.string().optional(),
    notice_period_days: z.string().optional(),
    monthly_cost: z.string().optional(),
    purchase_price: z.string().optional(),
    financing_amount: z.string().optional(),
    residual_value: z.string().optional(),
    currency: z.string().max(3).optional(),
    notes: z.string().optional(),
  })
  .refine(
    (data) => {
      if (data.contract_end && data.contract_start) {
        return data.contract_end >= data.contract_start
      }
      return true
    },
    {
      message: "Vertragsende muss nach Vertragsbeginn liegen.",
      path: ["contract_end"],
    }
  )

type FormValues = z.infer<typeof contractFormSchema>

interface ContractSheetProps {
  vehicleId: string
  contract?: Contract | null
  open: boolean
  onOpenChange: (open: boolean) => void
  onSaved: (contract: Contract) => void
}

function toFormValues(contract: Contract | null | undefined): FormValues {
  if (!contract) {
    return {
      contract_type: "LEASING",
      contract_status: "ACTIVE",
      provider: "",
      contract_start: "",
      contract_end: "",
      contract_number: "",
      notice_period_days: "",
      monthly_cost: "",
      purchase_price: "",
      financing_amount: "",
      residual_value: "",
      currency: "EUR",
      notes: "",
    }
  }

  return {
    contract_type: contract.contract_type,
    contract_status: contract.contract_status,
    provider: contract.provider,
    contract_start: contract.contract_start,
    contract_end: contract.contract_end || "",
    contract_number: contract.contract_number || "",
    notice_period_days:
      contract.notice_period_days != null
        ? String(contract.notice_period_days)
        : "",
    monthly_cost:
      contract.monthly_cost != null ? String(contract.monthly_cost) : "",
    purchase_price:
      contract.purchase_price != null ? String(contract.purchase_price) : "",
    financing_amount:
      contract.financing_amount != null
        ? String(contract.financing_amount)
        : "",
    residual_value:
      contract.residual_value != null ? String(contract.residual_value) : "",
    currency: contract.currency || "EUR",
    notes: contract.notes || "",
  }
}

function formToPayload(values: FormValues) {
  return {
    contract_type: values.contract_type,
    contract_status: values.contract_status,
    provider: values.provider,
    contract_start: values.contract_start,
    contract_end: values.contract_end || null,
    contract_number: values.contract_number || null,
    notice_period_days: values.notice_period_days
      ? parseInt(values.notice_period_days, 10)
      : null,
    monthly_cost: values.monthly_cost
      ? parseFloat(values.monthly_cost)
      : null,
    purchase_price: values.purchase_price
      ? parseFloat(values.purchase_price)
      : null,
    financing_amount: values.financing_amount
      ? parseFloat(values.financing_amount)
      : null,
    residual_value: values.residual_value
      ? parseFloat(values.residual_value)
      : null,
    currency: values.currency || "EUR",
    notes: values.notes || null,
  }
}

export function ContractSheet({
  vehicleId,
  contract,
  open,
  onOpenChange,
  onSaved,
}: ContractSheetProps) {
  const isEdit = !!contract
  const [serverError, setServerError] = useState<string | null>(null)

  const contractResolver: Resolver<FormValues> = async (values) => {
    const result = contractFormSchema.safeParse(values)
    if (result.success) return { values: result.data, errors: {} }
    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join(".")
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message }
    }
    return { values: {}, errors }
  }

  const form = useForm<FormValues>({
    resolver: contractResolver,
    defaultValues: toFormValues(contract),
  })

  // Reset form when contract prop changes (e.g., switching between edit/create)
  useEffect(() => {
    if (open) {
      form.reset(toFormValues(contract))
      setServerError(null)
    }
  }, [open, contract, form])

  async function onSubmit(values: FormValues) {
    setServerError(null)

    const payload = formToPayload(values)
    const url = isEdit
      ? `/api/vehicles/${vehicleId}/contracts/${contract!.id}`
      : `/api/vehicles/${vehicleId}/contracts`
    const method = isEdit ? "PATCH" : "POST"

    try {
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => null)
        throw new Error(
          body?.error || "Vertrag konnte nicht gespeichert werden."
        )
      }

      const saved: Contract = await res.json()
      onSaved(saved)
      onOpenChange(false)
    } catch (err) {
      setServerError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    }
  }

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="right" className="w-full sm:max-w-lg">
        <SheetHeader>
          <SheetTitle>
            {isEdit ? "Vertrag bearbeiten" : "Neuen Vertrag anlegen"}
          </SheetTitle>
          <SheetDescription>
            {isEdit
              ? "Vertragsdaten aktualisieren."
              : "Erstellen Sie einen neuen Vertrag für dieses Fahrzeug."}
          </SheetDescription>
        </SheetHeader>

        <ScrollArea className="h-[calc(100vh-10rem)] pr-4 mt-4">
          <Form {...form}>
            <form
              onSubmit={form.handleSubmit(onSubmit)}
              className="space-y-4 pb-8"
            >
              {serverError && (
                <Alert variant="destructive">
                  <AlertDescription>{serverError}</AlertDescription>
                </Alert>
              )}

              {/* Contract Type */}
              <FormField
                control={form.control}
                name="contract_type"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vertragsart</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Vertragsart wählen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="LEASING">Leasing</SelectItem>
                        <SelectItem value="FINANCING">Finanzierung</SelectItem>
                        <SelectItem value="PURCHASE">Barkauf</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contract Status */}
              <FormField
                control={form.control}
                name="contract_status"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Status</FormLabel>
                    <Select
                      onValueChange={field.onChange}
                      value={field.value}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Status waehlen" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="ACTIVE">Aktiv</SelectItem>
                        <SelectItem value="EXPIRED">Abgelaufen</SelectItem>
                        <SelectItem value="CANCELLED">Gekündigt</SelectItem>
                        <SelectItem value="PLANNED">Geplant</SelectItem>
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Provider */}
              <FormField
                control={form.control}
                name="provider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Anbieter / Bank</FormLabel>
                    <FormControl>
                      <Input placeholder="z.B. Mercedes-Benz Bank" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contract Start */}
              <FormField
                control={form.control}
                name="contract_start"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vertragsbeginn</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contract End */}
              <FormField
                control={form.control}
                name="contract_end"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vertragsende</FormLabel>
                    <FormControl>
                      <Input type="date" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Contract Number */}
              <FormField
                control={form.control}
                name="contract_number"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Vertragsnummer</FormLabel>
                    <FormControl>
                      <Input placeholder="Optional" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notice Period */}
              <FormField
                control={form.control}
                name="notice_period_days"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kündigungsfrist (Tage)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        placeholder="z.B. 90"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Monthly Cost */}
              <FormField
                control={form.control}
                name="monthly_cost"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Monatliche Rate (EUR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Purchase Price */}
              <FormField
                control={form.control}
                name="purchase_price"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Kaufpreis (EUR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Financing Amount */}
              <FormField
                control={form.control}
                name="financing_amount"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Finanzierungssumme (EUR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Residual Value */}
              <FormField
                control={form.control}
                name="residual_value"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Restwert (EUR)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        step="0.01"
                        placeholder="0.00"
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Currency */}
              <FormField
                control={form.control}
                name="currency"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Währung</FormLabel>
                    <FormControl>
                      <Input maxLength={3} placeholder="EUR" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              {/* Notes */}
              <FormField
                control={form.control}
                name="notes"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Notizen</FormLabel>
                    <FormControl>
                      <Textarea
                        placeholder="Optionale Anmerkungen zum Vertrag..."
                        rows={3}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button
                type="submit"
                className="w-full"
                disabled={form.formState.isSubmitting}
              >
                {form.formState.isSubmitting && (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                )}
                {isEdit ? "Speichern" : "Vertrag anlegen"}
              </Button>
            </form>
          </Form>
        </ScrollArea>
      </SheetContent>
    </Sheet>
  )
}
