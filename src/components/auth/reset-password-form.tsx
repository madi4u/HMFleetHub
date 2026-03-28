"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { z } from "zod"
import { useForm } from "react-hook-form"
import type { Resolver } from "react-hook-form"
import { Loader2, ArrowLeft, CheckCircle2, AlertTriangle } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { createClient } from "@/lib/supabase/client"

const resetPasswordSchema = z
  .object({
    password: z
      .string()
      .min(8, "Das Passwort muss mindestens 8 Zeichen lang sein."),
    confirmPassword: z.string().min(1, "Bitte bestaetigen Sie das Passwort."),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Die Passwoerter stimmen nicht ueberein.",
    path: ["confirmPassword"],
  })

type ResetPasswordFormValues = z.infer<typeof resetPasswordSchema>

export function ResetPasswordForm() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)
  const [isSuccess, setIsSuccess] = useState(false)
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null)

  const resetResolver: Resolver<ResetPasswordFormValues> = async (values) => {
    const result = resetPasswordSchema.safeParse(values)
    if (result.success) return { values: result.data, errors: {} }
    const errors: Record<string, { type: string; message: string }> = {}
    for (const issue of result.error.issues) {
      const path = issue.path.join(".")
      if (!errors[path]) errors[path] = { type: issue.code, message: issue.message }
    }
    return { values: {}, errors }
  }

  const form = useForm<ResetPasswordFormValues>({
    resolver: resetResolver,
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  useEffect(() => {
    // Supabase handles the token exchange via the URL hash fragment.
    // The @supabase/ssr client automatically picks up the token from
    // the URL when the page loads.
    const supabase = createClient()

    supabase.auth.onAuthStateChange((event) => {
      if (event === "PASSWORD_RECOVERY") {
        setIsValidToken(true)
      }
    })

    // Check if we already have a session (token was already exchanged)
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        setIsValidToken(true)
      } else {
        // Give the auth state change listener a moment to fire
        const timeout = setTimeout(() => {
          setIsValidToken((current) => (current === null ? false : current))
        }, 2000)
        return () => clearTimeout(timeout)
      }
    })
  }, [])

  async function onSubmit(values: ResetPasswordFormValues) {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { error: updateError } = await supabase.auth.updateUser({
        password: values.password,
      })

      if (updateError) {
        if (updateError.message.includes("same_password")) {
          setError(
            "Das neue Passwort muss sich vom bisherigen unterscheiden."
          )
        } else {
          setError(
            "Fehler beim Aendern des Passworts. Bitte versuchen Sie es erneut."
          )
        }
        return
      }

      // Sign out after password change so user logs in fresh
      await supabase.auth.signOut()
      setIsSuccess(true)
    } catch {
      setError(
        "Verbindungsfehler. Bitte pruefen Sie Ihre Internetverbindung und versuchen Sie es erneut."
      )
    } finally {
      setIsLoading(false)
    }
  }

  // Loading: waiting for token validation
  if (isValidToken === null) {
    return (
      <div className="flex flex-col items-center gap-4 py-8">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Link wird ueberprueft...
        </p>
      </div>
    )
  }

  // Invalid or expired token
  if (!isValidToken) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <AlertTriangle className="h-12 w-12 text-destructive" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Ungueltiger oder abgelaufener Link
        </h2>
        <p className="text-sm text-muted-foreground">
          Dieser Link zum Zuruecksetzen des Passworts ist ungueltig oder
          abgelaufen. Bitte fordern Sie einen neuen Link an.
        </p>
        <Button variant="outline" className="w-full" asChild>
          <Link href="/auth/forgot-password">Neuen Link anfordern</Link>
        </Button>
        <div className="text-center">
          <Link
            href="/login"
            className="inline-flex items-center text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            <ArrowLeft className="mr-1 h-3 w-3" />
            Zurueck zum Login
          </Link>
        </div>
      </div>
    )
  }

  // Success state
  if (isSuccess) {
    return (
      <div className="space-y-4 text-center">
        <div className="flex justify-center">
          <CheckCircle2 className="h-12 w-12 text-green-500" />
        </div>
        <h2 className="text-lg font-semibold text-foreground">
          Passwort geaendert
        </h2>
        <p className="text-sm text-muted-foreground">
          Ihr Passwort wurde erfolgreich geaendert. Sie koennen sich jetzt mit
          Ihrem neuen Passwort anmelden.
        </p>
        <Button className="w-full" asChild>
          <Link href="/login">Zum Login</Link>
        </Button>
      </div>
    )
  }

  return (
    <Form {...form}>
      <form
        onSubmit={form.handleSubmit(onSubmit)}
        className="space-y-4"
        noValidate
      >
        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <p className="text-sm text-muted-foreground">
          Geben Sie Ihr neues Passwort ein. Es muss mindestens 8 Zeichen lang
          sein.
        </p>

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Neues Passwort</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Mindestens 8 Zeichen"
                  autoComplete="new-password"
                  disabled={isLoading}
                  aria-label="Neues Passwort"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort bestaetigen</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Passwort wiederholen"
                  autoComplete="new-password"
                  disabled={isLoading}
                  aria-label="Passwort bestaetigen"
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
          disabled={isLoading}
          aria-label="Passwort speichern"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Wird gespeichert...
            </>
          ) : (
            "Passwort speichern"
          )}
        </Button>
      </form>
    </Form>
  )
}
