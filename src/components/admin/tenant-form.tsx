"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { Loader2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
  FormDescription,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { Tenant } from "@/types/database"

const tenantFormSchema = z.object({
  name: z.string().min(1, "Firmenname ist erforderlich."),
  slug: z
    .string()
    .min(1, "Slug ist erforderlich.")
    .regex(
      /^[a-z0-9]+(?:-[a-z0-9]+)*$/,
      "Slug darf nur Kleinbuchstaben, Zahlen und Bindestriche enthalten."
    ),
  contact_email: z
    .string()
    .email("Bitte geben Sie eine gültige E-Mail-Adresse ein.")
    .or(z.literal(""))
    .optional(),
  address: z.string().optional(),
})

export type TenantFormValues = z.infer<typeof tenantFormSchema>

/**
 * Generate a URL-friendly slug from a name.
 */
function generateSlug(name: string): string {
  return name
    .toLowerCase()
    .replace(/[aä]/g, "ae")
    .replace(/[oö]/g, "oe")
    .replace(/[uü]/g, "ue")
    .replace(/ß/g, "ss")
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "")
}

interface TenantFormProps {
  /** Existing tenant data for editing. If null, form is in create mode. */
  tenant?: Tenant | null
  /** Called when the form is submitted with valid data. */
  onSubmit: (values: TenantFormValues) => Promise<void>
  /** Text for the submit button. */
  submitLabel?: string
  /** Called when the user cancels. */
  onCancel?: () => void
}

export function TenantForm({
  tenant,
  onSubmit,
  submitLabel = "Speichern",
  onCancel,
}: TenantFormProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const tenantResolver: Resolver<TenantFormValues> = async (values) => {
    const result = tenantFormSchema.safeParse(values)
    if (result.success) return { values: result.data, errors: {} }
    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join(".")
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message }
    }
    return { values: {}, errors }
  }

  const form = useForm<TenantFormValues>({
    resolver: tenantResolver,
    defaultValues: {
      name: tenant?.name ?? "",
      slug: tenant?.slug ?? "",
      contact_email: tenant?.contact_email ?? "",
      address: tenant?.address ?? "",
    },
  })

  // Auto-generate slug from name in create mode
  const nameValue = form.watch("name")
  useEffect(() => {
    if (!tenant) {
      const slug = generateSlug(nameValue)
      form.setValue("slug", slug, { shouldValidate: nameValue.length > 0 })
    }
  }, [nameValue, tenant, form])

  async function handleSubmit(values: TenantFormValues) {
    setIsSubmitting(true)
    setError(null)

    try {
      await onSubmit(values)
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
        className="space-y-6"
        noValidate
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <FormField
          control={form.control}
          name="name"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Firmenname *</FormLabel>
              <FormControl>
                <Input
                  placeholder="z. B. Mustermann GmbH"
                  disabled={isSubmitting}
                  aria-label="Firmenname"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="slug"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Slug *</FormLabel>
              <FormControl>
                <Input
                  placeholder="z. B. mustermann-gmbh"
                  disabled={isSubmitting}
                  aria-label="Slug"
                  {...field}
                />
              </FormControl>
              <FormDescription>
                Eindeutiger Bezeichner. Wird automatisch aus dem Firmennamen
                generiert.
              </FormDescription>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="contact_email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Kontakt-E-Mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="kontakt@firma.de"
                  disabled={isSubmitting}
                  aria-label="Kontakt-E-Mail"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="address"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Adresse</FormLabel>
              <FormControl>
                <Textarea
                  placeholder="Straße, PLZ Ort"
                  disabled={isSubmitting}
                  aria-label="Adresse"
                  rows={3}
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

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
