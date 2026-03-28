"use client"

import { useState, useEffect } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { Loader2 } from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
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
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import type { TenantUser } from "@/types/database"

const editSchema = z.object({
  role: z.enum([
    "FLEET_MANAGER",
    "OFFICE_USER",
    "WORKSHOP_MECHANIC",
    "READ_ONLY",
  ]),
  is_active: z.boolean(),
})

type EditFormValues = z.infer<typeof editSchema>

interface EditUserSheetProps {
  user: TenantUser | null
  currentUserId: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function EditUserSheet({
  user,
  currentUserId,
  open,
  onOpenChange,
  onSuccess,
}: EditUserSheetProps) {
  const [error, setError] = useState<string | null>(null)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const isSelf = user?.id === currentUserId

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
      role: "FLEET_MANAGER",
      is_active: true,
    },
  })

  // Reset form when user changes
  useEffect(() => {
    if (user) {
      const role = (
        ["FLEET_MANAGER", "OFFICE_USER", "WORKSHOP_MECHANIC", "READ_ONLY"] as const
      ).includes(user.role as "FLEET_MANAGER" | "OFFICE_USER" | "WORKSHOP_MECHANIC" | "READ_ONLY")
        ? (user.role as "FLEET_MANAGER" | "OFFICE_USER" | "WORKSHOP_MECHANIC" | "READ_ONLY")
        : "FLEET_MANAGER"

      form.reset({
        role,
        is_active: user.is_active,
      })
      setError(null)
    }
  }, [user, form])

  async function onSubmit(values: EditFormValues) {
    if (!user) return

    // Guard: cannot deactivate yourself
    if (isSelf && !values.is_active) {
      setError("Sie koennen sich nicht selbst deaktivieren.")
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/users/${user.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })

      if (!response.ok) {
        const data = await response.json().catch(() => null)
        throw new Error(
          data?.error ?? "Benutzer konnte nicht aktualisiert werden."
        )
      }

      toast.success(
        `Benutzer "${user.full_name ?? user.email}" wurde aktualisiert.`
      )
      onOpenChange(false)
      onSuccess?.()
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
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent>
        <SheetHeader>
          <SheetTitle>Benutzer bearbeiten</SheetTitle>
          <SheetDescription>
            Rolle und Status von {user?.full_name ?? user?.email ?? "Benutzer"}{" "}
            aendern.
          </SheetDescription>
        </SheetHeader>

        <div className="mt-6">
          {user && (
            <Form {...form}>
              <form
                onSubmit={form.handleSubmit(onSubmit)}
                className="space-y-6"
                noValidate
              >
                {error && (
                  <Alert variant="destructive">
                    <AlertDescription>{error}</AlertDescription>
                  </Alert>
                )}

                {/* Read-only fields */}
                <div className="space-y-4">
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      Name
                    </label>
                    <Input
                      value={user.full_name ?? "-"}
                      disabled
                      aria-label="Name (nicht aenderbar)"
                    />
                  </div>
                  <div>
                    <label className="text-sm font-medium text-muted-foreground">
                      E-Mail
                    </label>
                    <Input
                      value={user.email}
                      disabled
                      aria-label="E-Mail (nicht aenderbar)"
                    />
                  </div>
                </div>

                <FormField
                  control={form.control}
                  name="role"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Rolle</FormLabel>
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                        disabled={isSubmitting}
                      >
                        <FormControl>
                          <SelectTrigger aria-label="Rolle auswaehlen">
                            <SelectValue placeholder="Rolle auswaehlen" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          <SelectItem value="FLEET_MANAGER">
                            Fuhrparkleiter
                          </SelectItem>
                          <SelectItem value="OFFICE_USER">
                            Bueroanwender
                          </SelectItem>
                          <SelectItem value="WORKSHOP_MECHANIC">
                            Werkstatt
                          </SelectItem>
                          <SelectItem value="READ_ONLY">Nur Lesen</SelectItem>
                        </SelectContent>
                      </Select>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="is_active"
                  render={({ field }) => (
                    <FormItem className="flex flex-row items-center justify-between rounded-lg border p-4">
                      <div className="space-y-0.5">
                        <FormLabel className="text-base">
                          Benutzer aktiv
                        </FormLabel>
                        <FormDescription>
                          {isSelf
                            ? "Sie koennen sich nicht selbst deaktivieren."
                            : "Deaktivierte Benutzer koennen sich nicht anmelden."}
                        </FormDescription>
                      </div>
                      <FormControl>
                        <Switch
                          checked={field.value}
                          onCheckedChange={field.onChange}
                          disabled={isSubmitting || isSelf}
                          aria-label="Benutzer aktivieren oder deaktivieren"
                        />
                      </FormControl>
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
                      "Aenderungen speichern"
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => onOpenChange(false)}
                    disabled={isSubmitting}
                  >
                    Abbrechen
                  </Button>
                </div>
              </form>
            </Form>
          )}
        </div>
      </SheetContent>
    </Sheet>
  )
}
