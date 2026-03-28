"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { Plus, Search, Car } from "lucide-react"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { VehicleTable } from "@/components/fleet/vehicle-table"
import { useUser } from "@/hooks/use-user"
import { hasPermission } from "@/lib/permissions.config"
import type { Vehicle, VehicleListResponse } from "@/types/database"

export default function FleetPage() {
  const { user, isLoading: userLoading } = useUser()
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [total, setTotal] = useState(0)
  const [page, setPage] = useState(1)
  const [pageSize, setPageSize] = useState(25)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [typeFilter, setTypeFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchVehicles = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams({
        page: String(page),
        pageSize: String(pageSize),
      })
      if (search) params.set("search", search)
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter)
      if (typeFilter && typeFilter !== "all")
        params.set("vehicle_type", typeFilter)

      const res = await fetch(`/api/vehicles?${params.toString()}`)
      if (!res.ok) {
        throw new Error("Fahrzeuge konnten nicht geladen werden.")
      }
      const json: VehicleListResponse = await res.json()
      setVehicles(json.data)
      setTotal(json.total)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsLoading(false)
    }
  }, [page, pageSize, search, statusFilter, typeFilter])

  useEffect(() => {
    if (!userLoading && user) {
      fetchVehicles()
    }
  }, [fetchVehicles, userLoading, user])

  // WORKSHOP_MECHANIC redirect
  useEffect(() => {
    if (!userLoading && user?.role === "WORKSHOP_MECHANIC") {
      window.location.href = "/workshop"
    }
  }, [userLoading, user])

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1)
  }, [search, statusFilter, typeFilter, pageSize])

  if (userLoading) {
    return <FleetPageSkeleton />
  }

  if (!user || user.role === "WORKSHOP_MECHANIC") {
    return null
  }

  const canCreate = hasPermission(user.role, "vehicles.create")

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Fahrzeuge</h1>
          <p className="text-muted-foreground">
            Verwalten Sie Ihren gesamten Fuhrpark an einem Ort.
          </p>
        </div>
        {canCreate && (
          <Button asChild>
            <Link href="/fleet/new">
              <Plus className="mr-2 h-4 w-4" />
              Fahrzeug anlegen
            </Link>
          </Button>
        )}
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Kennzeichen, Marke oder Modell..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Fahrzeuge durchsuchen"
          />
        </div>

        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-44" aria-label="Status filtern">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="Aktiv">Aktiv</SelectItem>
            <SelectItem value="Inaktiv">Inaktiv</SelectItem>
            <SelectItem value="In Werkstatt">In Werkstatt</SelectItem>
            <SelectItem value="Verkauft">Verkauft</SelectItem>
            <SelectItem value="Abgemeldet">Abgemeldet</SelectItem>
          </SelectContent>
        </Select>

        <Select value={typeFilter} onValueChange={setTypeFilter}>
          <SelectTrigger
            className="w-full sm:w-44"
            aria-label="Fahrzeugtyp filtern"
          >
            <SelectValue placeholder="Fahrzeugtyp" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Typen</SelectItem>
            <SelectItem value="PKW">PKW</SelectItem>
            <SelectItem value="LKW">LKW</SelectItem>
            <SelectItem value="Transporter">Transporter</SelectItem>
            <SelectItem value="Motorrad">Motorrad</SelectItem>
            <SelectItem value="Anhänger">Anhaenger</SelectItem>
            <SelectItem value="Sonstige">Sonstige</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {error && (
        <div className="rounded-md border border-destructive/50 bg-destructive/10 p-4 text-sm text-destructive">
          {error}
        </div>
      )}

      {/* Loading state */}
      {isLoading && <FleetTableSkeleton />}

      {/* Empty state */}
      {!isLoading && !error && vehicles.length === 0 && total === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <Car className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Noch keine Fahrzeuge</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Legen Sie Ihr erstes Fahrzeug an, um den Fuhrpark zu verwalten.
          </p>
          {canCreate && (
            <Button asChild className="mt-4">
              <Link href="/fleet/new">
                <Plus className="mr-2 h-4 w-4" />
                Fahrzeug anlegen
              </Link>
            </Button>
          )}
        </div>
      )}

      {/* Table */}
      {!isLoading && !error && vehicles.length > 0 && (
        <VehicleTable
          data={vehicles}
          total={total}
          page={page}
          pageSize={pageSize}
          userRole={user.role}
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      )}
    </div>
  )
}

function FleetPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div className="space-y-2">
          <Skeleton className="h-8 w-40" />
          <Skeleton className="h-4 w-64" />
        </div>
        <Skeleton className="h-10 w-40" />
      </div>
      <FleetTableSkeleton />
    </div>
  )
}

function FleetTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm" />
        <Skeleton className="h-10 w-44" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="rounded-md border">
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} className="flex items-center gap-4 border-b p-4 last:border-b-0">
            <Skeleton className="h-10 w-10 rounded-md" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-4 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
