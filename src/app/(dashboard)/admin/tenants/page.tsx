"use client"

import { useState, useEffect, useCallback } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Building2,
  CheckCircle2,
  XCircle,
  Plus,
  Search,
  Loader2,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TenantTable } from "@/components/admin/tenant-table"
import {
  TenantForm,
  type TenantFormValues,
} from "@/components/admin/tenant-form"
import { useUser } from "@/hooks/use-user"
import type { TenantWithCounts } from "@/types/database"

export default function TenantsPage() {
  const { user, isLoading: userLoading } = useUser()
  const router = useRouter()

  const [tenants, setTenants] = useState<TenantWithCounts[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [searchQuery, setSearchQuery] = useState("")
  const [statusFilter, setStatusFilter] = useState("all")

  // Edit sheet state
  const [editingTenant, setEditingTenant] = useState<TenantWithCounts | null>(
    null
  )

  const fetchTenants = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/admin/tenants")
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/dashboard")
          return
        }
        throw new Error("Mandanten konnten nicht geladen werden.")
      }
      const data = await response.json()
      setTenants(data)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsLoading(false)
    }
  }, [router])

  useEffect(() => {
    if (!userLoading && user) {
      if (user.role !== "SUPERADMIN") {
        router.push("/dashboard")
        return
      }
      fetchTenants()
    }
  }, [user, userLoading, router, fetchTenants])

  // Stats
  const totalCount = tenants.length
  const activeCount = tenants.filter((t) => t.status === "active").length
  const inactiveCount = tenants.filter((t) => t.status === "inactive").length

  async function handleToggleStatus(tenant: TenantWithCounts) {
    const newStatus = tenant.status === "active" ? "inactive" : "active"

    try {
      const response = await fetch(`/api/admin/tenants/${tenant.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })

      if (!response.ok) {
        throw new Error("Status konnte nicht geaendert werden.")
      }

      toast.success(
        newStatus === "active"
          ? `"${tenant.name}" wurde aktiviert.`
          : `"${tenant.name}" wurde deaktiviert.`
      )
      fetchTenants()
    } catch (err) {
      toast.error(
        err instanceof Error
          ? err.message
          : "Ein Fehler ist aufgetreten."
      )
    }
  }

  async function handleEditSubmit(values: TenantFormValues) {
    if (!editingTenant) return

    const response = await fetch(`/api/admin/tenants/${editingTenant.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })

    if (!response.ok) {
      const data = await response.json().catch(() => null)
      throw new Error(
        data?.error ?? "Mandant konnte nicht gespeichert werden."
      )
    }

    toast.success(`"${values.name}" wurde aktualisiert.`)
    setEditingTenant(null)
    fetchTenants()
  }

  // Auth loading
  if (userLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not SUPERADMIN guard (should redirect but fallback)
  if (!user || user.role !== "SUPERADMIN") {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Mandanten</h1>
          <p className="text-muted-foreground">
            Verwalten Sie alle Mandanten der Plattform.
          </p>
        </div>
        <Button asChild>
          <Link href="/admin/tenants/new">
            <Plus className="mr-2 h-4 w-4" />
            Neuen Mandanten anlegen
          </Link>
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
            <Building2 className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{totalCount}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Aktiv</CardTitle>
            <CheckCircle2 className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{activeCount}</p>
            )}
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Inaktiv</CardTitle>
            <XCircle className="h-4 w-4 text-red-600" />
          </CardHeader>
          <CardContent>
            {isLoading ? (
              <Skeleton className="h-8 w-16" />
            ) : (
              <p className="text-2xl font-bold">{inactiveCount}</p>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Toolbar */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            placeholder="Mandant suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Mandanten durchsuchen"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[180px]" aria-label="Status filtern">
            <SelectValue placeholder="Alle Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Status</SelectItem>
            <SelectItem value="active">Aktiv</SelectItem>
            <SelectItem value="inactive">Inaktiv</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Error state */}
      {error && (
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      )}

      {/* Loading state */}
      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        <TenantTable
          data={tenants}
          searchQuery={searchQuery}
          statusFilter={statusFilter}
          onToggleStatus={handleToggleStatus}
          onEdit={(tenant) => setEditingTenant(tenant)}
        />
      )}

      {/* Edit Sheet */}
      <Sheet
        open={!!editingTenant}
        onOpenChange={(open) => !open && setEditingTenant(null)}
      >
        <SheetContent>
          <SheetHeader>
            <SheetTitle>Mandant bearbeiten</SheetTitle>
            <SheetDescription>
              Aendern Sie die Stammdaten von {editingTenant?.name}.
            </SheetDescription>
          </SheetHeader>
          <div className="mt-6">
            {editingTenant && (
              <TenantForm
                tenant={editingTenant}
                onSubmit={handleEditSubmit}
                submitLabel="Aenderungen speichern"
                onCancel={() => setEditingTenant(null)}
              />
            )}
          </div>
        </SheetContent>
      </Sheet>
    </div>
  )
}
