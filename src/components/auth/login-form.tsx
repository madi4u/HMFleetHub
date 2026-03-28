"use client"

import { useState } from "react"
import Link from "next/link"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { Loader2 } from "lucide-react"

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

const loginSchema = z.object({
  email: z.string().email("Bitte geben Sie eine gueltige E-Mail-Adresse ein."),
  password: z.string().min(1, "Bitte geben Sie Ihr Passwort ein."),
})

type LoginFormValues = z.infer<typeof loginSchema>

export function LoginForm() {
  const [error, setError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(false)

  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
    },
  })

  async function onSubmit(values: LoginFormValues) {
    setIsLoading(true)
    setError(null)

    try {
      const supabase = createClient()

      const { data, error: authError } =
        await supabase.auth.signInWithPassword({
          email: values.email,
          password: values.password,
        })

      if (authError) {
        // Map Supabase error messages to user-friendly German messages
        if (authError.message === "Invalid login credentials") {
          setError("E-Mail oder Passwort ist falsch.")
        } else if (authError.message.includes("Email not confirmed")) {
          setError(
            "Ihre E-Mail-Adresse wurde noch nicht bestaetigt. Bitte pruefen Sie Ihren Posteingang."
          )
        } else if (authError.status === 429) {
          setError(
            "Zu viele Anmeldeversuche. Bitte versuchen Sie es spaeter erneut."
          )
        } else {
          setError(
            "Anmeldung fehlgeschlagen. Bitte versuchen Sie es erneut."
          )
        }
        return
      }

      if (data.session) {
        // Use window.location.href for full page reload to ensure
        // middleware picks up the new session cookies
        window.location.href = "/dashboard"
      }
    } catch {
      setError(
        "Verbindungsfehler. Bitte pruefen Sie Ihre Internetverbindung und versuchen Sie es erneut."
      )
    } finally {
      setIsLoading(false)
    }
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

        <FormField
          control={form.control}
          name="email"
          render={({ field }) => (
            <FormItem>
              <FormLabel>E-Mail</FormLabel>
              <FormControl>
                <Input
                  type="email"
                  placeholder="name@firma.de"
                  autoComplete="email"
                  disabled={isLoading}
                  aria-label="E-Mail-Adresse"
                  {...field}
                />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>Passwort</FormLabel>
              <FormControl>
                <Input
                  type="password"
                  placeholder="Passwort eingeben"
                  autoComplete="current-password"
                  disabled={isLoading}
                  aria-label="Passwort"
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
          aria-label="Anmelden"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              Anmeldung...
            </>
          ) : (
            "Anmelden"
          )}
        </Button>

        <div className="text-center">
          <Link
            href="/auth/forgot-password"
            className="text-sm text-muted-foreground underline-offset-4 hover:text-foreground hover:underline"
          >
            Passwort vergessen?
          </Link>
        </div>
      </form>
    </Form>
  )
}
