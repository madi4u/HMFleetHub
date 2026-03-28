import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

/**
 * Vehicles page - placeholder.
 * Will be implemented in PROJ-5 (Fahrzeugstammdaten).
 */
export default function VehiclesPage() {
  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Fahrzeuge</h1>
        <p className="text-muted-foreground">
          Verwalten Sie Ihren gesamten Fuhrpark an einem Ort.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Fahrzeuguebersicht</CardTitle>
        </CardHeader>
        <CardContent>
          <p className="text-sm text-muted-foreground">
            Noch keine Fahrzeuge vorhanden. Diese Seite wird in PROJ-5 implementiert.
          </p>
        </CardContent>
      </Card>
    </div>
  )
}
