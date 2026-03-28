"use client"

import { useState, useEffect, useRef, useCallback } from "react"
import { Search, Loader2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { VehiclePhoto } from "@/components/fleet/vehicle-photo"
import type { VehicleWorkshopSearchResult } from "@/types/database"

interface VehicleSearchInputProps {
  onSelect: (vehicleId: string) => void
}

export function VehicleSearchInput({ onSelect }: VehicleSearchInputProps) {
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<VehicleWorkshopSearchResult[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isOpen, setIsOpen] = useState(false)
  const [hasSearched, setHasSearched] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const search = useCallback(async (q: string) => {
    if (q.trim().length < 2) {
      setResults([])
      setIsOpen(false)
      setHasSearched(false)
      return
    }

    setIsLoading(true)
    setHasSearched(true)

    try {
      const res = await fetch(
        `/api/vehicles/workshop-search?q=${encodeURIComponent(q.trim())}`
      )
      if (!res.ok) throw new Error("Suchfehler")
      const data: VehicleWorkshopSearchResult[] = await res.json()
      setResults(data)
      setIsOpen(true)
    } catch {
      setResults([])
      setIsOpen(true)
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current)
    }

    debounceRef.current = setTimeout(() => {
      search(query)
    }, 300)

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current)
      }
    }
  }, [query, search])

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        setIsOpen(false)
      }
    }

    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  function handleSelect(vehicleId: string) {
    setQuery("")
    setResults([])
    setIsOpen(false)
    setHasSearched(false)
    onSelect(vehicleId)
  }

  return (
    <div ref={containerRef} className="relative w-full">
      <div className="relative">
        <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
        <Input
          type="text"
          placeholder="Kennzeichen suchen..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => {
            if (results.length > 0 || (hasSearched && query.trim().length >= 2)) {
              setIsOpen(true)
            }
          }}
          className="h-14 pl-12 pr-12 text-lg"
          aria-label="Fahrzeug per Kennzeichen suchen"
          autoComplete="off"
        />
        {isLoading && (
          <Loader2 className="absolute right-4 top-1/2 h-5 w-5 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>

      {isOpen && (
        <div className="absolute z-50 mt-2 w-full rounded-md border bg-card shadow-lg">
          {results.length > 0 ? (
            <ul role="listbox" aria-label="Suchergebnisse">
              {results.map((vehicle) => (
                <li key={vehicle.id} role="option" aria-selected={false}>
                  <button
                    type="button"
                    className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent focus:bg-accent focus:outline-none"
                    onClick={() => handleSelect(vehicle.id)}
                  >
                    <VehiclePhoto
                      imageUrl={vehicle.image_url}
                      licensePlate={vehicle.license_plate}
                      size="sm"
                    />
                    <div className="min-w-0 flex-1">
                      <p className="truncate font-bold uppercase">
                        {vehicle.license_plate}
                      </p>
                      <p className="truncate text-sm text-muted-foreground">
                        {vehicle.make} {vehicle.model}
                      </p>
                    </div>
                  </button>
                </li>
              ))}
            </ul>
          ) : hasSearched && !isLoading ? (
            <div className="px-4 py-6 text-center text-sm text-muted-foreground">
              Kein Fahrzeug gefunden
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}
