"use client"

import { useRouter } from "next/navigation"
import { Wrench } from "lucide-react"
import { useUser } from "@/hooks/use-user"
import { VehicleSearchInput } from "@/components/workshop/vehicle-search-input"
import { Skeleton } from "@/components/ui/skeleton"

export default function WorkshopPage() {
  const router = useRouter()
  const { isLoading } = useUser()

  function handleVehicleSelect(vehicleId: string) {
    router.push(`/workshop/${vehicleId}`)
  }

  if (isLoading) {
    return (
      <div className="flex flex-col items-center px-4 pt-20">
        <Skeleton className="mb-4 h-8 w-64" />
        <Skeleton className="mb-8 h-5 w-48" />
        <Skeleton className="h-14 w-full max-w-lg" />
      </div>
    )
  }

  return (
    <div className="flex flex-col items-center px-4 pt-12 sm:pt-20">
      <div className="mb-8 text-center">
        <div className="mb-4 flex items-center justify-center gap-3">
          <Wrench className="h-8 w-8 text-primary" aria-hidden="true" />
          <h1 className="text-2xl font-bold tracking-tight sm:text-3xl">
            H+M FleetHub Werkstatt
          </h1>
        </div>
        <p className="text-muted-foreground">
          Fahrzeug per Kennzeichen suchen
        </p>
      </div>

      <div className="w-full max-w-lg">
        <VehicleSearchInput onSelect={handleVehicleSelect} />
      </div>
    </div>
  )
}
