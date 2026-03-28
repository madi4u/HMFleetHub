"use client"

import { useState, useEffect } from "react"
import { useParams, useRouter } from "next/navigation"
import { ArrowLeft, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { VehiclePhoto } from "@/components/fleet/vehicle-photo"
import { VehicleStatusBadge } from "@/components/fleet/vehicle-status-badge"
import { WorkshopTechCard } from "@/components/workshop/workshop-tech-card"
import { HistoryTab } from "@/components/fleet/history/history-tab"
import { RegistrationDocumentCard } from "@/components/fleet/registration-document-card"
import { useUser } from "@/hooks/use-user"
import { hasPermission } from "@/lib/permissions.config"
import type { VehicleWorkshopView } from "@/types/database"

export default function WorkshopVehicleDetailPage() {
  const params = useParams<{ id: string }>()
  const router = useRouter()
  const { user } = useUser()
  const [vehicle, setVehicle] = useState<VehicleWorkshopView | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function loadVehicle() {
      setIsLoading(true)
      setError(null)

      try {
        const res = await fetch(`/api/vehicles/workshop-view/${params.id}`)
        if (res.status === 404) {
          setError("Fahrzeug nicht gefunden.")
          return
        }
        if (!res.ok) {
          setError("Fehler beim Laden der Fahrzeugdaten.")
          return
        }
        const data: VehicleWorkshopView = await res.json()
        setVehicle(data)
      } catch {
        setError("Verbindungsfehler. Bitte versuche es erneut.")
      } finally {
        setIsLoading(false)
      }
    }

    if (params.id) {
      loadVehicle()
    }
  }, [params.id])

  if (isLoading) {
    return <WorkshopDetailSkeleton />
  }

  if (error || !vehicle) {
    return (
      <div className="space-y-4 px-4 pt-6">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => router.push("/workshop")}
        >
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurueck
        </Button>
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertTitle>Fehler</AlertTitle>
          <AlertDescription>
            {error || "Fahrzeug nicht gefunden."}
          </AlertDescription>
        </Alert>
      </div>
    )
  }

  return (
    <div className="space-y-6 px-4 pb-8 pt-6">
      {/* Back button */}
      <Button
        variant="ghost"
        size="sm"
        onClick={() => router.push("/workshop")}
      >
        <ArrowLeft className="mr-2 h-4 w-4" />
        Zurueck
      </Button>

      {/* Vehicle header */}
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <VehiclePhoto
          imageUrl={vehicle.image_url}
          licensePlate={vehicle.license_plate}
          size="lg"
        />
        <div className="text-center sm:text-left">
          <h1 className="text-2xl font-bold uppercase tracking-wide">
            {vehicle.license_plate}
          </h1>
          <p className="text-lg text-muted-foreground">
            {vehicle.make} {vehicle.model}
          </p>
          <div className="mt-2">
            <VehicleStatusBadge status={vehicle.status} />
          </div>
        </div>
      </div>

      {/* Tech card */}
      <WorkshopTechCard vehicle={vehicle} />

      {/* Fahrzeugschein (PROJ-12) */}
      {user && (
        <RegistrationDocumentCard
          vehicleId={vehicle.id}
          canUpload={hasPermission(user.role, "vehicles.media.upload")}
        />
      )}

      {/* History feed */}
      <div>
        <h2 className="mb-4 text-lg font-semibold">Fahrzeughistorie</h2>
        <HistoryTab
          vehicleId={vehicle.id}
          currentMileage={vehicle.current_mileage}
        />
      </div>
    </div>
  )
}

function WorkshopDetailSkeleton() {
  return (
    <div className="space-y-6 px-4 pt-6">
      <Skeleton className="h-8 w-24" />
      <div className="flex flex-col items-center gap-4 sm:flex-row sm:items-start">
        <Skeleton className="h-40 w-40 rounded-md" />
        <div className="space-y-2">
          <Skeleton className="h-8 w-48" />
          <Skeleton className="h-5 w-32" />
          <Skeleton className="h-6 w-20" />
        </div>
      </div>
      <Skeleton className="h-64 w-full rounded-md" />
      <Skeleton className="h-48 w-full rounded-md" />
    </div>
  )
}
