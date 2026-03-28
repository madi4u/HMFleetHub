"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import { ArrowLeft, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { VehicleForm, type VehicleFormValues } from "@/components/fleet/vehicle-form"
import { useUser } from "@/hooks/use-user"
import { hasPermission } from "@/lib/permissions.config"
import type { Vehicle } from "@/types/database"

export default function EditVehiclePage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)

  useEffect(() => {
    if (!userLoading && user && params.id) {
      fetchVehicle()
    }
  }, [userLoading, user, params.id])

  async function fetchVehicle() {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vehicles/${params.id}`)
      if (res.status === 404) {
        setError("Fahrzeug nicht gefunden.")
        return
      }
      if (!res.ok) {
        throw new Error("Fahrzeug konnte nicht geladen werden.")
      }
      const json = await res.json()
      setVehicle(json)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsLoading(false)
    }
  }

  async function handleSubmit(
    values: VehicleFormValues,
    imageFile: File | null
  ) {
    const res = await fetch(`/api/vehicles/${params.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(
        json.error || "Fahrzeug konnte nicht gespeichert werden."
      )
    }

    // Upload image if new one selected
    if (imageFile) {
      const formData = new FormData()
      formData.append("image", imageFile)

      await fetch(`/api/vehicles/${params.id}/upload-image`, {
        method: "POST",
        body: formData,
      })
    }

    router.push(`/fleet/${params.id}`)
  }

  async function handleDelete() {
    setIsDeleting(true)
    try {
      const res = await fetch(`/api/vehicles/${params.id}`, {
        method: "DELETE",
      })

      if (!res.ok) {
        const json = await res.json().catch(() => ({}))
        throw new Error(
          json.error || "Fahrzeug konnte nicht geloescht werden."
        )
      }

      router.push("/fleet")
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
      setIsDeleting(false)
    }
  }

  if (userLoading || isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href="/fleet">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurueck zur Fahrzeugliste
          </Link>
        </Button>
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-lg font-semibold">Fehler</h2>
          <p className="text-sm text-muted-foreground">{error}</p>
        </div>
      </div>
    )
  }

  if (!vehicle || !user) {
    return null
  }

  if (!hasPermission(user.role, "vehicles.edit")) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild>
          <Link href={`/fleet/${vehicle.id}`}>
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurueck zum Fahrzeug
          </Link>
        </Button>
        <div className="flex flex-col items-center justify-center py-16">
          <h2 className="text-lg font-semibold">Keine Berechtigung</h2>
          <p className="text-sm text-muted-foreground">
            Sie haben nicht die erforderlichen Rechte, um dieses Fahrzeug zu
            bearbeiten.
          </p>
        </div>
      </div>
    )
  }

  const canDelete =
    user.role === "SUPERADMIN" || user.role === "TENANT_ADMIN"

  return (
    <div className="space-y-6">
      <Button variant="ghost" size="sm" asChild>
        <Link href={`/fleet/${vehicle.id}`}>
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurueck zum Fahrzeug
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Fahrzeug bearbeiten
          </h1>
          <p className="text-muted-foreground">
            <span className="uppercase font-medium">
              {vehicle.license_plate}
            </span>{" "}
            &mdash; {vehicle.make} {vehicle.model}
          </p>
        </div>

        {canDelete && (
          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button variant="destructive" disabled={isDeleting}>
                <Trash2 className="mr-2 h-4 w-4" />
                Fahrzeug loeschen
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>
                  Fahrzeug wirklich loeschen?
                </AlertDialogTitle>
                <AlertDialogDescription>
                  Das Fahrzeug{" "}
                  <span className="font-semibold uppercase">
                    {vehicle.license_plate}
                  </span>{" "}
                  ({vehicle.make} {vehicle.model}) wird als geloescht markiert
                  und ist nicht mehr in der Fahrzeugliste sichtbar. Diese Aktion
                  kann von einem Administrator rueckgaengig gemacht werden.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                <AlertDialogAction
                  onClick={handleDelete}
                  className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
                >
                  Endgueltig loeschen
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        )}
      </div>

      <Separator />

      <Card>
        <CardHeader>
          <CardTitle>Fahrzeugdaten bearbeiten</CardTitle>
          <CardDescription>
            Pflichtfelder sind mit * markiert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VehicleForm
            vehicle={vehicle}
            onSubmit={handleSubmit}
            submitLabel="Aenderungen speichern"
            onCancel={() => router.push(`/fleet/${vehicle.id}`)}
          />
        </CardContent>
      </Card>
    </div>
  )
}
