"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import {
  Users,
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
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { UserTable } from "@/components/users/user-table"
import { InviteUserDialog } from "@/components/users/invite-user-dialog"
import { EditUserSheet } from "@/components/users/edit-user-sheet"
import { useUser } from "@/hooks/use-user"
import type { TenantUser } from "@/types/database"

export default function UsersPage() {
  const { user, isLoading: userLoading } = useUser()
  const router = useRouter()

  const [users, setUsers] = useState<TenantUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Filter state
  const [searchQuery, setSearchQuery] = useState("")
  const [roleFilter, setRoleFilter] = useState("all")
  const [statusFilter, setStatusFilter] = useState("all")

  // Dialog state
  const [inviteOpen, setInviteOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<TenantUser | null>(null)

  const fetchUsers = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      const response = await fetch("/api/users")
      if (!response.ok) {
        if (response.status === 403) {
          router.push("/dashboard")
          return
        }
        throw new Error("Benutzer konnten nicht geladen werden.")
      }
      const data = await response.json()
      setUsers(data)
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
      // Access guard: only TENANT_ADMIN and SUPERADMIN
      if (user.role !== "TENANT_ADMIN" && user.role !== "SUPERADMIN") {
        router.push("/dashboard")
        return
      }
      fetchUsers()
    }
  }, [user, userLoading, router, fetchUsers])

  // Stats
  const totalCount = users.length
  const activeCount = users.filter((u) => u.is_active).length
  const inactiveCount = users.filter((u) => !u.is_active).length

  // Auth loading
  if (userLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  // Not authorized guard (fallback)
  if (!user || (user.role !== "TENANT_ADMIN" && user.role !== "SUPERADMIN")) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Page header */}
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">Benutzer</h1>
          <p className="text-muted-foreground">
            Verwalten Sie die Benutzer Ihres Mandanten.
          </p>
        </div>
        <Button onClick={() => setInviteOpen(true)}>
          <Plus className="mr-2 h-4 w-4" />
          Benutzer einladen
        </Button>
      </div>

      {/* Stat Cards */}
      <div className="grid gap-4 sm:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-2">
            <CardTitle className="text-sm font-medium">Gesamt</CardTitle>
            <Users className="h-4 w-4 text-muted-foreground" />
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
            placeholder="Name oder E-Mail suchen..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9"
            aria-label="Benutzer durchsuchen"
          />
        </div>
        <Select value={roleFilter} onValueChange={setRoleFilter}>
          <SelectTrigger
            className="w-full sm:w-[200px]"
            aria-label="Rolle filtern"
          >
            <SelectValue placeholder="Alle Rollen" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Alle Rollen</SelectItem>
            <SelectItem value="FLEET_MANAGER">Fuhrparkleiter</SelectItem>
            <SelectItem value="OFFICE_USER">Bueroanwender</SelectItem>
            <SelectItem value="WORKSHOP_MECHANIC">Werkstatt</SelectItem>
            <SelectItem value="READ_ONLY">Nur Lesen</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger
            className="w-full sm:w-[180px]"
            aria-label="Status filtern"
          >
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
        <UserTable
          data={users}
          searchQuery={searchQuery}
          roleFilter={roleFilter}
          statusFilter={statusFilter}
          currentUserId={user.id}
          onEditUser={(u) => setEditingUser(u)}
        />
      )}

      {/* Invite User Dialog */}
      <InviteUserDialog
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={fetchUsers}
      />

      {/* Edit User Sheet */}
      <EditUserSheet
        user={editingUser}
        currentUserId={user.id}
        open={!!editingUser}
        onOpenChange={(open) => !open && setEditingUser(null)}
        onSuccess={fetchUsers}
      />
    </div>
  )
}
