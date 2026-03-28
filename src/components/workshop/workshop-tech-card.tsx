"use client"

import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { VehicleStatusBadge } from "@/components/fleet/vehicle-status-badge"
import type { VehicleWorkshopView } from "@/types/database"

interface WorkshopTechCardProps {
  vehicle: VehicleWorkshopView
}

function FieldItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="space-y-1">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="text-sm font-medium">{value ?? "\u2014"}</p>
    </div>
  )
}

function formatMileage(km: number | null): string {
  if (km == null) return "\u2014"
  return km.toLocaleString("de-DE") + " km"
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "\u2014"
  try {
    return new Date(dateStr).toLocaleDateString("de-DE")
  } catch {
    return dateStr
  }
}

export function WorkshopTechCard({ vehicle }: WorkshopTechCardProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Fahrzeugdaten</CardTitle>
      </CardHeader>
      <CardContent className="space-y-6">
        {/* Fahrzeugdaten */}
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
          <FieldItem
            label="Kennzeichen"
            value={
              <span className="text-base font-bold uppercase">
                {vehicle.license_plate}
              </span>
            }
          />
          <FieldItem
            label="Marke / Modell"
            value={`${vehicle.make} ${vehicle.model}`}
          />
          <FieldItem label="Fahrzeugtyp" value={vehicle.vehicle_type} />
          <FieldItem
            label="Status"
            value={<VehicleStatusBadge status={vehicle.status} />}
          />
          <FieldItem label="VIN" value={vehicle.vin} />
          <FieldItem label="Baujahr" value={vehicle.year} />
          <FieldItem
            label="Erstzulassung"
            value={formatDate(vehicle.first_registration)}
          />
          <FieldItem
            label="Kilometerstand"
            value={formatMileage(vehicle.current_mileage)}
          />
        </div>

        {/* Technische Daten */}
        <div>
          <h3 className="mb-3 text-sm font-semibold text-muted-foreground">
            Technische Daten
          </h3>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <FieldItem label="Reifengroesse" value={vehicle.tire_size} />
            <FieldItem label="Motoroel" value={vehicle.engine_oil_spec} />
            <FieldItem label="Getriebeoel" value={vehicle.transmission_oil_spec} />
            <FieldItem label="Kraftstoffart" value={vehicle.fuel_type} />
            <FieldItem label="Motorisierung" value={vehicle.engine_code} />
            <FieldItem
              label="Leistung"
              value={vehicle.engine_power != null ? `${vehicle.engine_power} kW` : null}
            />
            <FieldItem label="HSN" value={vehicle.hsn} />
            <FieldItem label="TSN" value={vehicle.tsn} />
          </div>
        </div>

        {/* Notes sections */}
        {vehicle.service_interval_notes && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Servicehinweise
            </p>
            <p className="whitespace-pre-wrap text-sm">
              {vehicle.service_interval_notes}
            </p>
          </div>
        )}

        {vehicle.technical_notes && (
          <div>
            <p className="mb-1 text-xs text-muted-foreground">
              Technische Bemerkungen
            </p>
            <p className="whitespace-pre-wrap text-sm">
              {vehicle.technical_notes}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
