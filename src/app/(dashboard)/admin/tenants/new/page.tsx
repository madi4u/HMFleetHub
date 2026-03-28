"use client"

import { useRouter } from "next/navigation"
import { ArrowLeft, Loader2 } from "lucide-react"
import Link from "next/link"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  TenantForm,
  type TenantFormValues,
} from "@/components/admin/tenant-form"
import { useUser } from "@/hooks/use-user"

export default function NewTenantPage() {
  const { user, isLoading } = useUser()
  const router = useRouter()

  // Auth loading
  if (isLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not SUPERADMIN guard
  if (!user || user.role !== "SUPERADMIN") {
    router.push("/dashboard")
    return null
  }

  async function handleSubmit(values: TenantFormValues) {
    const response = await fetch("/api/admin/tenants", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(
        data?.error ?? "Mandant konnte nicht erstellt werden."
      )
    }

    toast.success(`Mandant "${values.name}" wurde erfolgreich erstellt.`)
    router.push("/admin/tenants")
  }

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/admin/tenants">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurück zur Übersicht
        </Link>
      </Button>

      <Card className="mx-auto max-w-2xl">
        <CardHeader>
          <CardTitle>Neuen Mandanten anlegen</CardTitle>
          <CardDescription>
            Erstellen Sie einen neuen Mandanten auf der Plattform. Mit * markierte
            Felder sind Pflichtfelder.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <TenantForm
            onSubmit={handleSubmit}
            submitLabel="Mandant erstellen"
            onCancel={() => router.push("/admin/tenants")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
