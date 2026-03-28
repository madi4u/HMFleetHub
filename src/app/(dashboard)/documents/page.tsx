import { FolderOpen, Clock } from "lucide-react"

export default function DocumentsPage() {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-4 text-center">
      <div className="rounded-full bg-muted p-4">
        <FolderOpen className="h-8 w-8 text-muted-foreground" />
      </div>
      <div>
        <h1 className="text-2xl font-bold tracking-tight">Dokumente & Medien</h1>
        <p className="mt-2 text-muted-foreground max-w-sm">
          Diese Funktion befindet sich in Entwicklung und wird in einer zukünftigen Version verfügbar sein.
        </p>
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Clock className="h-4 w-4" />
        <span>Geplant: PROJ-11</span>
      </div>
    </div>
  )
}
