import { BarChart3, Clock } from "lucide-react"

export default function ReportsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <BarChart3 className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Berichte & Auswertungen</h1>
        <p className="mt-2 text-muted-foreground max-w-sm">
          Diese Funktion befindet sich in Entwicklung und wird in einer zukünftigen Version verfügbar sein.
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Geplant: PROJ-13</span>
      </div>
    </div>
  )
}
