"use client"

import { useState, useEffect, useCallback, useMemo } from "react"
import Link from "next/link"
import {
  FileText,
  Search,
  ExternalLink,
  AlertTriangle,
  TrendingUp,
  Clock,
  XCircle,
} from "lucide-react"

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
import { Card, CardContent } from "@/components/ui/card"
import { ContractStatusBadge } from "@/components/fleet/contracts/contract-status-badge"
import { ContractTypeBadge } from "@/components/fleet/contracts/contract-type-badge"
import { useUser } from "@/hooks/use-user"
import type { Contract } from "@/types/database"

interface ContractWithVehicle extends Omit<Contract, "documents"> {
  vehicles: { id: string; license_plate: string; make: string; model: string }
}

interface ContractsResponse {
  contracts: ContractWithVehicle[]
  total: number
}

function isExpiringSoon(contractEnd: string | null): boolean {
  if (!contractEnd) return false
  const end = new Date(contractEnd)
  const now = new Date()
  const sixtyDaysFromNow = new Date()
  sixtyDaysFromNow.setDate(now.getDate() + 60)
  return end >= now && end <= sixtyDaysFromNow
}

function isExpired(contractEnd: string | null): boolean {
  if (!contractEnd) return false
  return new Date(contractEnd) < new Date()
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "unbefristet"
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatCurrency(amount: number | null, currency: string): string {
  if (amount === null || amount === undefined) return "\u2014"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(amount)
}

export default function ContractsPage() {
  const { user, isLoading: userLoading } = useUser()
  const [contracts, setContracts] = useState<ContractWithVehicle[]>([])
  const [total, setTotal] = useState(0)
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const isWorkshopMechanic = user?.role === "WORKSHOP_MECHANIC"

  const fetchContracts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const params = new URLSearchParams()
      if (search) params.set("search", search)
      if (statusFilter && statusFilter !== "all")
        params.set("status", statusFilter)

      const res = await fetch(`/api/contracts?${params.toString()}`)
      if (!res.ok) {
        throw new Error("Vertraege konnten nicht geladen werden.")
      }
      const json: ContractsResponse = await res.json()
      setContracts(json.contracts)
      setTotal(json.total)
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsLoading(false)
    }
  }, [search, statusFilter])

  useEffect(() => {
    if (!userLoading && user) {
      fetchContracts()
    }
  }, [fetchContracts, userLoading, user])

  const stats = useMemo(() => {
    const active = contracts.filter(
      (c) => c.contract_status === "ACTIVE"
    ).length
    const expiringSoon = contracts.filter((c) =>
      isExpiringSoon(c.contract_end)
    ).length
    const expired = contracts.filter(
      (c) => c.contract_status === "EXPIRED"
    ).length
    return { total: contracts.length, active, expiringSoon, expired }
  }, [contracts])

  if (userLoading) {
    return <ContractsPageSkeleton />
  }

  if (!user) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight">
          Vertragsverwaltung
        </h1>
        <p className="text-muted-foreground">
          Alle Vertraege Ihres Fuhrparks auf einen Blick.
        </p>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-muted p-2">
              <FileText className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Gesamt</p>
              <p className="text-2xl font-bold">{stats.total}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-green-500/10 p-2">
              <TrendingUp className="h-5 w-5 text-green-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Aktiv</p>
              <p className="text-2xl font-bold">{stats.active}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-amber-500/10 p-2">
              <AlertTriangle className="h-5 w-5 text-amber-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Laeuft bald ab</p>
              <p className="text-2xl font-bold">{stats.expiringSoon}</p>
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="flex items-center gap-3 p-4">
            <div className="rounded-md bg-red-500/10 p-2">
              <XCircle className="h-5 w-5 text-red-400" />
            </div>
            <div>
              <p className="text-sm text-muted-foreground">Abgelaufen</p>
              <p className="text-2xl font-bold">{stats.expired}</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1 sm:max-w-sm">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Anbieter, Vertragsnr. oder Fahrzeug..."
            className="pl-9"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            aria-label="Vertraege durchsuchen"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-full sm:w-44"
            aria-label="Status filtern"
          >
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="ACTIVE">Aktiv</SelectItem>
            <SelectItem value="EXPIRED">Abgelaufen</SelectItem>
            <SelectItem value="CANCELLED">Gekuendigt</SelectItem>
            <SelectItem value="PLANNED">Geplant</SelectItem>
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
      {isLoading && <ContractsTableSkeleton />}

      {/* Empty state */}
      {!isLoading && !error && contracts.length === 0 && (
        <div className="flex flex-col items-center justify-center rounded-md border border-dashed py-16">
          <FileText className="mb-4 h-12 w-12 text-muted-foreground" />
          <h3 className="text-lg font-semibold">Keine Vertraege gefunden</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            {search || statusFilter !== "all"
              ? "Versuchen Sie andere Suchkriterien."
              : "Es sind noch keine Vertraege vorhanden. Legen Sie Vertraege ueber die Fahrzeugdetailseite an."}
          </p>
        </div>
      )}

      {/* Contracts table */}
      {!isLoading && !error && contracts.length > 0 && (
        <div className="rounded-md border">
          {/* Desktop table header */}
          <div className="hidden border-b bg-muted/50 px-4 py-3 text-sm font-medium text-muted-foreground lg:grid lg:grid-cols-12 lg:gap-4">
            <div className="col-span-2">Fahrzeug</div>
            <div className="col-span-1">Vertragsart</div>
            <div className="col-span-1">Status</div>
            <div className="col-span-2">Anbieter</div>
            <div className="col-span-2">Laufzeit</div>
            {!isWorkshopMechanic && (
              <div className="col-span-2">Monatl. Rate</div>
            )}
            <div className={isWorkshopMechanic ? "col-span-4" : "col-span-2"}>
              Aktion
            </div>
          </div>

          {/* Rows */}
          {contracts.map((contract) => {
            const expiring = isExpiringSoon(contract.contract_end)
            return (
              <div
                key={contract.id}
                className={`border-b px-4 py-3 last:border-b-0 ${
                  expiring ? "bg-amber-500/5" : ""
                }`}
              >
                {/* Desktop row */}
                <div className="hidden lg:grid lg:grid-cols-12 lg:items-center lg:gap-4">
                  <div className="col-span-2">
                    <p className="font-semibold">
                      {contract.vehicles.license_plate}
                    </p>
                    <p className="text-sm text-muted-foreground">
                      {contract.vehicles.make} {contract.vehicles.model}
                    </p>
                  </div>
                  <div className="col-span-1">
                    <ContractTypeBadge type={contract.contract_type} />
                  </div>
                  <div className="col-span-1 flex items-center gap-2">
                    <ContractStatusBadge status={contract.contract_status} />
                    {expiring && (
                      <AlertTriangle className="h-4 w-4 text-amber-400" />
                    )}
                  </div>
                  <div className="col-span-2 truncate text-sm">
                    {contract.provider}
                    {contract.contract_number && (
                      <p className="text-xs text-muted-foreground truncate">
                        Nr. {contract.contract_number}
                      </p>
                    )}
                  </div>
                  <div className="col-span-2 text-sm">
                    <span>{formatDate(contract.contract_start)}</span>
                    <span className="mx-1 text-muted-foreground">
                      &rarr;
                    </span>
                    <span
                      className={
                        expiring ? "font-medium text-amber-400" : ""
                      }
                    >
                      {formatDate(contract.contract_end)}
                    </span>
                  </div>
                  {!isWorkshopMechanic && (
                    <div className="col-span-2 text-sm font-medium">
                      {formatCurrency(
                        contract.monthly_cost,
                        contract.currency
                      )}
                    </div>
                  )}
                  <div
                    className={
                      isWorkshopMechanic ? "col-span-4" : "col-span-2"
                    }
                  >
                    <Button variant="ghost" size="sm" asChild>
                      <Link href={`/fleet/${contract.vehicles.id}`}>
                        <ExternalLink className="mr-2 h-4 w-4" />
                        Fahrzeug
                      </Link>
                    </Button>
                  </div>
                </div>

                {/* Mobile/Tablet card */}
                <div className="space-y-2 lg:hidden">
                  <div className="flex items-start justify-between">
                    <div>
                      <p className="font-semibold">
                        {contract.vehicles.license_plate}
                      </p>
                      <p className="text-sm text-muted-foreground">
                        {contract.vehicles.make} {contract.vehicles.model}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <ContractStatusBadge status={contract.contract_status} />
                      {expiring && (
                        <AlertTriangle className="h-4 w-4 text-amber-400" />
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-2 text-sm">
                    <ContractTypeBadge type={contract.contract_type} />
                    <span className="text-muted-foreground">
                      {contract.provider}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-muted-foreground">
                      {formatDate(contract.contract_start)} &rarr;{" "}
                      <span
                        className={
                          expiring ? "font-medium text-amber-400" : ""
                        }
                      >
                        {formatDate(contract.contract_end)}
                      </span>
                    </span>
                    {!isWorkshopMechanic && (
                      <span className="font-medium">
                        {formatCurrency(
                          contract.monthly_cost,
                          contract.currency
                        )}
                      </span>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="w-full"
                    asChild
                  >
                    <Link href={`/fleet/${contract.vehicles.id}`}>
                      <ExternalLink className="mr-2 h-4 w-4" />
                      Zum Fahrzeug
                    </Link>
                  </Button>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function ContractsPageSkeleton() {
  return (
    <div className="space-y-6">
      <div className="space-y-2">
        <Skeleton className="h-8 w-56" />
        <Skeleton className="h-4 w-80" />
      </div>
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, i) => (
          <Skeleton key={i} className="h-20 rounded-md" />
        ))}
      </div>
      <ContractsTableSkeleton />
    </div>
  )
}

function ContractsTableSkeleton() {
  return (
    <div className="space-y-3">
      <div className="flex gap-3">
        <Skeleton className="h-10 flex-1 max-w-sm" />
        <Skeleton className="h-10 w-44" />
      </div>
      <div className="rounded-md border">
        {Array.from({ length: 6 }).map((_, i) => (
          <div
            key={i}
            className="flex items-center gap-4 border-b p-4 last:border-b-0"
          >
            <Skeleton className="h-4 w-24" />
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-40" />
            <Skeleton className="h-4 w-20" />
            <Skeleton className="h-8 w-24" />
          </div>
        ))}
      </div>
    </div>
  )
}
