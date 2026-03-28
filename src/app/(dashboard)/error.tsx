"use client"

import { useEffect } from "react"
import { Button } from "@/components/ui/button"

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log the error to the console for debugging
    console.error("[DashboardError]", error)
  }, [error])

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 p-8">
      <div className="w-full max-w-2xl space-y-4">
        <h2 className="text-xl font-semibold text-destructive">
          Ein Fehler ist aufgetreten
        </h2>
        <div className="rounded-md border border-destructive/30 bg-destructive/10 p-4">
          <p className="font-mono text-sm break-all text-destructive">
            {error.message || "Unbekannter Fehler"}
          </p>
          {error.digest && (
            <p className="mt-1 font-mono text-xs text-muted-foreground">
              Digest: {error.digest}
            </p>
          )}
        </div>
        {process.env.NODE_ENV !== "production" && error.stack && (
          <pre className="overflow-auto rounded-md bg-muted p-4 text-xs text-muted-foreground max-h-64">
            {error.stack}
          </pre>
        )}
        <Button onClick={reset} variant="outline">
          Seite neu laden
        </Button>
      </div>
    </div>
  )
}
