"use client"

import { useRouter } from "next/navigation"

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { VehicleForm, type VehicleFormValues } from "@/components/fleet/vehicle-form"
import { useUser } from "@/hooks/use-user"
import { hasPermission } from "@/lib/permissions.config"

export default function NewVehiclePage() {
  const router = useRouter()
  const { user, isLoading } = useUser()

  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-96 w-full" />
      </div>
    )
  }

  if (!user) {
    return null
  }

  if (!hasPermission(user.role, "vehicles.create")) {
    return (
      <div className="flex flex-col items-center justify-center py-16">
        <h2 className="text-lg font-semibold">Keine Berechtigung</h2>
        <p className="text-sm text-muted-foreground">
          Sie haben nicht die erforderlichen Rechte, um ein Fahrzeug anzulegen.
        </p>
      </div>
    )
  }

  async function handleSubmit(
    values: VehicleFormValues,
    imageFile: File | null
  ) {
    // Create the vehicle
    const res = await fetch("/api/vehicles", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!res.ok) {
      const json = await res.json().catch(() => ({}))
      throw new Error(
        json.error || "Fahrzeug konnte nicht angelegt werden."
      )
    }

    const vehicle = await res.json()

    // Upload image if selected
    if (imageFile && vehicle.id) {
      const formData = new FormData()
      formData.append("image", imageFile)

      await fetch(`/api/vehicles/${vehicle.id}/upload-image`, {
        method: "POST",
        body: formData,
      })
    }

    router.push(`/fleet/${vehicle.id}`)
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Fahrzeug anlegen
        </h1>
        <p className="text-muted-foreground">
          Erfassen Sie die Stammdaten des neuen Fahrzeugs.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Neues Fahrzeug</CardTitle>
          <CardDescription>
            Pflichtfelder sind mit * markiert.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <VehicleForm
            onSubmit={handleSubmit}
            submitLabel="Fahrzeug anlegen"
            onCancel={() => router.push("/fleet")}
          />
        </CardContent>
      </Card>
    </div>
  )
}
