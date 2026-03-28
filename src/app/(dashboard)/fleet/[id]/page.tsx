"use client"

import { useState, useEffect } from "react"
import { useParams } from "next/navigation"
import Link from "next/link"
import { Pencil, ArrowLeft } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Separator } from "@/components/ui/separator"
import { Skeleton } from "@/components/ui/skeleton"
import { VehicleStatusBadge } from "@/components/fleet/vehicle-status-badge"
import { VehiclePhoto } from "@/components/fleet/vehicle-photo"
import { useUser } from "@/hooks/use-user"
import { hasPermission } from "@/lib/permissions.config"
import { HistoryTab } from "@/components/fleet/history/history-tab"
import { MileageSection } from "@/components/fleet/mileage-section"
import { CostSummaryTab } from "@/components/fleet/cost-summary-tab"
import { RepairsMaintenanceSection } from "@/components/fleet/repairs-maintenance-section"
import { ContractsTab } from "@/components/fleet/contracts/contracts-tab"
import { MediaTab } from "@/components/fleet/media/media-tab"
import { RegistrationDocumentCard } from "@/components/fleet/registration-document-card"
import type { Vehicle } from "@/types/database"

export default function VehicleDetailPage() {
  const params = useParams<{ id: string }>()
  const { user, isLoading: userLoading } = useUser()
  const [vehicle, setVehicle] = useState<Vehicle | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

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

  if (userLoading || isLoading) {
    return <VehicleDetailSkeleton />
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

  const canEdit = hasPermission(user.role, "vehicles.edit")

  return (
    <div className="space-y-6">
      {/* Back link */}
      <Button variant="ghost" size="sm" asChild>
        <Link href="/fleet">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurueck zur Fahrzeugliste
        </Link>
      </Button>

      {/* Vehicle Header */}
      <div className="flex flex-col gap-6 sm:flex-row sm:items-start">
        <VehiclePhoto
          imageUrl={vehicle.image_url}
          licensePlate={vehicle.license_plate}
          size="lg"
        />
        <div className="flex-1 space-y-2">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h1 className="text-3xl font-bold uppercase tracking-tight">
                {vehicle.license_plate}
              </h1>
              <p className="text-lg text-muted-foreground">
                {vehicle.make} {vehicle.model}
              </p>
            </div>
            {canEdit && (
              <Button asChild>
                <Link href={`/fleet/${vehicle.id}/edit`}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bearbeiten
                </Link>
              </Button>
            )}
          </div>
          <VehicleStatusBadge status={vehicle.status} />
        </div>
      </div>

      <Separator />

      {/* Tabs */}
      <Tabs defaultValue="stammdaten" className="space-y-4">
        <TabsList className="flex flex-wrap">
          <TabsTrigger value="historie">Historie</TabsTrigger>
          <TabsTrigger value="stammdaten">Stammdaten</TabsTrigger>
          <TabsTrigger value="vertraege">Vertraege</TabsTrigger>
          <TabsTrigger value="medien">Medien</TabsTrigger>
          <TabsTrigger value="auswertungen">Auswertungen</TabsTrigger>
          <TabsTrigger value="aktivitaeten">Aktivitaeten</TabsTrigger>
        </TabsList>

        {/* Tab: Historie */}
        <TabsContent value="historie">
          <HistoryTab
            vehicleId={params.id}
            currentMileage={vehicle?.current_mileage ?? null}
          />
        </TabsContent>

        {/* Tab: Stammdaten */}
        <TabsContent value="stammdaten">
          <div className="space-y-6">
            {/* Fahrzeugschein (PROJ-12) */}
            {user && (
              <RegistrationDocumentCard
                vehicleId={params.id}
                canUpload={hasPermission(user.role, "vehicles.media.upload")}
              />
            )}

            {/* Stammdaten */}
            <Card>
              <CardHeader>
                <CardTitle>Stammdaten</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField
                    label="Kennzeichen"
                    value={vehicle.license_plate}
                    uppercase
                  />
                  <DetailField label="Marke" value={vehicle.make} />
                  <DetailField label="Modell" value={vehicle.model} />
                  <DetailField
                    label="Fahrzeugtyp"
                    value={vehicle.vehicle_type}
                  />
                  <DetailField label="Status" value={vehicle.status} />
                  <DetailField label="VIN" value={vehicle.vin} />
                  <DetailField
                    label="Erstzulassung"
                    value={
                      vehicle.first_registration
                        ? new Date(
                            vehicle.first_registration
                          ).toLocaleDateString("de-DE")
                        : null
                    }
                  />
                  <DetailField
                    label="Baujahr"
                    value={vehicle.year?.toString() ?? null}
                  />
                  <DetailField label="Farbe" value={vehicle.color} />
                  <DetailField
                    label="Kilometerstand"
                    value={
                      vehicle.current_mileage != null
                        ? `${vehicle.current_mileage.toLocaleString("de-DE")} km`
                        : null
                    }
                  />
                  <DetailField label="Standort" value={vehicle.location} />
                  <DetailField
                    label="Zugewiesen an"
                    value={vehicle.assigned_to}
                  />
                </div>
                {vehicle.notes && (
                  <div className="mt-4">
                    <DetailField label="Notizen" value={vehicle.notes} />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Technische Daten */}
            <Card>
              <CardHeader>
                <CardTitle>Technische Daten</CardTitle>
              </CardHeader>
              <CardContent>
                <div className="grid gap-4 sm:grid-cols-2">
                  <DetailField
                    label="Reifengroesse"
                    value={vehicle.tire_size}
                  />
                  <DetailField
                    label="Motoroel-Spezifikation"
                    value={vehicle.engine_oil_spec}
                  />
                  <DetailField
                    label="Getriebeoel-Spezifikation"
                    value={vehicle.transmission_oil_spec}
                  />
                  <DetailField
                    label="Kraftstoffart"
                    value={vehicle.fuel_type}
                  />
                  <DetailField
                    label="Motorisierung"
                    value={vehicle.engine_code}
                  />
                  <DetailField
                    label="Leistung"
                    value={
                      vehicle.engine_power != null
                        ? `${vehicle.engine_power} kW`
                        : null
                    }
                  />
                  <DetailField label="HSN" value={vehicle.hsn} />
                  <DetailField label="TSN" value={vehicle.tsn} />
                </div>
                {vehicle.service_interval_notes && (
                  <div className="mt-4">
                    <DetailField
                      label="Servicehinweise"
                      value={vehicle.service_interval_notes}
                    />
                  </div>
                )}
                {vehicle.technical_notes && (
                  <div className="mt-4">
                    <DetailField
                      label="Technische Bemerkungen"
                      value={vehicle.technical_notes}
                    />
                  </div>
                )}
              </CardContent>
            </Card>

            {/* Kilometerstand-Verlauf (PROJ-8) */}
            <MileageSection
              vehicleId={params.id}
              currentMileage={vehicle?.current_mileage ?? null}
              canEdit={canEdit}
            />
          </div>
        </TabsContent>

        {/* Tab: Vertraege (PROJ-10) */}
        <TabsContent value="vertraege">
          {user && <ContractsTab vehicleId={params.id} userRole={user.role} />}
        </TabsContent>

        {/* Tab: Medien (PROJ-11) */}
        <TabsContent value="medien">
          {user && (
            <MediaTab
              vehicleId={params.id}
              canUpload={hasPermission(user.role, "vehicles.media.upload")}
            />
          )}
        </TabsContent>

        {/* Tab: Auswertungen (PROJ-8 + PROJ-9) */}
        <TabsContent value="auswertungen">
          <CostSummaryTab vehicleId={params.id} />
          <RepairsMaintenanceSection
            vehicleId={params.id}
            canViewFinancials={hasPermission(user.role, "vehicles.financials.view")}
          />
        </TabsContent>

        {/* Tab: Aktivitaeten */}
        <TabsContent value="aktivitaeten">
          <Card>
            <CardHeader>
              <CardTitle>Aktivitaeten</CardTitle>
              <CardDescription>
                Aktivitaetsverlauf fuer dieses Fahrzeug.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <p className="text-sm text-muted-foreground">
                Noch keine Aktivitaeten vorhanden.
              </p>
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  )
}

/**
 * A labeled read-only field for the detail view.
 */
function DetailField({
  label,
  value,
  uppercase,
}: {
  label: string
  value: string | null | undefined
  uppercase?: boolean
}) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className={`text-sm ${uppercase ? "uppercase" : ""}`}>
        {value || <span className="text-muted-foreground">--</span>}
      </p>
    </div>
  )
}

function VehicleDetailSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-8 w-48" />
      <div className="flex gap-6">
        <Skeleton className="h-40 w-40 rounded-md" />
        <div className="flex-1 space-y-3">
          <Skeleton className="h-10 w-64" />
          <Skeleton className="h-5 w-40" />
          <Skeleton className="h-6 w-20 rounded-full" />
        </div>
      </div>
      <Skeleton className="h-px w-full" />
      <Skeleton className="h-10 w-full max-w-xl" />
      <Skeleton className="h-64 w-full" />
    </div>
  )
}
