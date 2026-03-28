"use client"

import { useState, useEffect, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import Link from "next/link"
import {
  ArrowLeft,
  Building2,
  Users,
  Car,
  Mail,
  MapPin,
  Calendar,
  Loader2,
  UserPlus,
} from "lucide-react"
import { toast } from "sonner"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { Badge } from "@/components/ui/badge"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { TenantStatusBadge } from "@/components/admin/tenant-status-badge"
import { InviteUserDialog } from "@/components/admin/invite-user-dialog"
import { useUser } from "@/hooks/use-user"
import type { TenantWithCounts, UserRole } from "@/types/database"

interface TenantUser {
  id: string
  user_id: string
  email: string
  full_name: string | null
  role: UserRole
  is_active: boolean
  created_at: string
}

/** Map role to a German label */
function getRoleLabel(role: UserRole): string {
  const labels: Record<UserRole, string> = {
    SUPERADMIN: "Superadmin",
    TENANT_ADMIN: "Mandanten-Admin",
    FLEET_MANAGER: "Fuhrparkleiter",
    OFFICE_USER: "Bueroanwender",
    WORKSHOP_MECHANIC: "Werkstattmitarbeiter",
    READ_ONLY: "Nur Lesen",
  }
  return labels[role] ?? role
}

export default function TenantDetailPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { user, isLoading: userLoading } = useUser()

  const [tenant, setTenant] = useState<TenantWithCounts | null>(null)
  const [users, setUsers] = useState<TenantUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [inviteOpen, setInviteOpen] = useState(false)

  const fetchTenant = useCallback(async () => {
    setIsLoading(true)
    setError(null)

    try {
      // Fetch tenant details
      const tenantRes = await fetch(`/api/admin/tenants/${id}`)
      if (!tenantRes.ok) {
        if (tenantRes.status === 403) {
          router.push("/dashboard")
          return
        }
        if (tenantRes.status === 404) {
          setError("Mandant nicht gefunden.")
          setIsLoading(false)
          return
        }
        throw new Error("Mandant konnte nicht geladen werden.")
      }
      const tenantData = await tenantRes.json()
      setTenant(tenantData.tenant)
      setUsers(tenantData.users ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsLoading(false)
    }
  }, [id, router])

  useEffect(() => {
    if (!userLoading && user) {
      if (user.role !== "SUPERADMIN") {
        router.push("/dashboard")
        return
      }
      fetchTenant()
    }
  }, [user, userLoading, router, fetchTenant])

  // Auth loading
  if (userLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    )
  }

  if (!user || user.role !== "SUPERADMIN") {
    return null
  }

  // Data loading
  if (isLoading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-8 w-48" />
        <Skeleton className="h-64 w-full" />
      </div>
    )
  }

  // Error
  if (error) {
    return (
      <div className="space-y-6">
        <Button variant="ghost" asChild className="-ml-4">
          <Link href="/admin/tenants">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Zurueck zur Uebersicht
          </Link>
        </Button>
        <Alert variant="destructive">
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    )
  }

  if (!tenant) {
    return null
  }

  return (
    <div className="space-y-6">
      {/* Back link + header */}
      <Button variant="ghost" asChild className="-ml-4">
        <Link href="/admin/tenants">
          <ArrowLeft className="mr-2 h-4 w-4" />
          Zurueck zur Uebersicht
        </Link>
      </Button>

      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-primary/10">
            <Building2 className="h-5 w-5 text-primary" />
          </div>
          <div>
            <h1 className="text-2xl font-bold tracking-tight">
              {tenant.name}
            </h1>
            <p className="text-sm text-muted-foreground">{tenant.slug}</p>
          </div>
          <TenantStatusBadge status={tenant.status} />
        </div>
      </div>

      {/* Tabs */}
      <Tabs defaultValue="overview">
        <TabsList>
          <TabsTrigger value="overview">Uebersicht</TabsTrigger>
          <TabsTrigger value="users">
            Benutzer ({users.length})
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-3">
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Benutzer
                </CardTitle>
                <Users className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{tenant.user_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Fahrzeuge
                </CardTitle>
                <Car className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">{tenant.vehicle_count}</p>
              </CardContent>
            </Card>
            <Card>
              <CardHeader className="flex flex-row items-center justify-between pb-2">
                <CardTitle className="text-sm font-medium">
                  Erstellt am
                </CardTitle>
                <Calendar className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <p className="text-2xl font-bold">
                  {new Date(tenant.created_at).toLocaleDateString("de-DE")}
                </p>
              </CardContent>
            </Card>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Stammdaten</CardTitle>
              <CardDescription>
                Detailinformationen des Mandanten.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <dl className="grid gap-4 sm:grid-cols-2">
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Firmenname
                  </dt>
                  <dd className="mt-1 text-sm">{tenant.name}</dd>
                </div>
                <div>
                  <dt className="text-sm font-medium text-muted-foreground">
                    Slug
                  </dt>
                  <dd className="mt-1 text-sm font-mono">{tenant.slug}</dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                    <Mail className="h-3.5 w-3.5" />
                    Kontakt-E-Mail
                  </dt>
                  <dd className="mt-1 text-sm">
                    {tenant.contact_email || (
                      <span className="text-muted-foreground">
                        Nicht angegeben
                      </span>
                    )}
                  </dd>
                </div>
                <div>
                  <dt className="flex items-center gap-1 text-sm font-medium text-muted-foreground">
                    <MapPin className="h-3.5 w-3.5" />
                    Adresse
                  </dt>
                  <dd className="mt-1 whitespace-pre-line text-sm">
                    {tenant.address || (
                      <span className="text-muted-foreground">
                        Nicht angegeben
                      </span>
                    )}
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Users Tab */}
        <TabsContent value="users" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {users.length === 0
                ? "Noch keine Benutzer vorhanden."
                : `${users.length} Benutzer in diesem Mandanten.`}
            </p>
            <Button onClick={() => setInviteOpen(true)}>
              <UserPlus className="mr-2 h-4 w-4" />
              Admin einladen
            </Button>
          </div>

          {users.length > 0 ? (
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>E-Mail</TableHead>
                    <TableHead>Rolle</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Seit</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {users.map((u) => (
                    <TableRow key={u.id}>
                      <TableCell className="font-medium">
                        {u.full_name || (
                          <span className="text-muted-foreground">
                            Kein Name
                          </span>
                        )}
                      </TableCell>
                      <TableCell>{u.email}</TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {getRoleLabel(u.role)}
                        </Badge>
                      </TableCell>
                      <TableCell>
                        {u.is_active ? (
                          <Badge
                            variant="default"
                            className="bg-green-600 text-white hover:bg-green-700 dark:bg-green-700"
                          >
                            Aktiv
                          </Badge>
                        ) : (
                          <Badge variant="destructive">Inaktiv</Badge>
                        )}
                      </TableCell>
                      <TableCell>
                        {new Date(u.created_at).toLocaleDateString("de-DE")}
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          ) : (
            <Card>
              <CardContent className="flex flex-col items-center justify-center py-12">
                <Users className="mb-4 h-12 w-12 text-muted-foreground/50" />
                <p className="text-lg font-medium">Keine Benutzer</p>
                <p className="text-sm text-muted-foreground">
                  Laden Sie den ersten Admin fuer diesen Mandanten ein.
                </p>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {/* Invite dialog */}
      <InviteUserDialog
        tenantId={tenant.id}
        tenantName={tenant.name}
        open={inviteOpen}
        onOpenChange={setInviteOpen}
        onSuccess={() => {
          toast.success("Einladung wurde erfolgreich gesendet.")
          fetchTenant()
        }}
      />
    </div>
  )
}
