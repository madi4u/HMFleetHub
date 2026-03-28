"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  useReactTable,
  getCoreRowModel,
  getFilteredRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
  type ColumnFiltersState,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  MoreHorizontal,
  Pencil,
  Power,
  Eye,
} from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { TenantStatusBadge } from "@/components/admin/tenant-status-badge"
import type { TenantWithCounts } from "@/types/database"

interface TenantTableProps {
  data: TenantWithCounts[]
  searchQuery: string
  statusFilter: string
  onToggleStatus: (tenant: TenantWithCounts) => void
  onEdit: (tenant: TenantWithCounts) => void
}

export function TenantTable({
  data,
  searchQuery,
  statusFilter,
  onToggleStatus,
  onEdit,
}: TenantTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const [confirmTenant, setConfirmTenant] = useState<TenantWithCounts | null>(
    null
  )

  // Apply external filters
  const filteredData = useMemo(() => {
    let result = data

    if (statusFilter && statusFilter !== "all") {
      result = result.filter((t) => t.status === statusFilter)
    }

    if (searchQuery) {
      const q = searchQuery.toLowerCase()
      result = result.filter(
        (t) =>
          t.name.toLowerCase().includes(q) ||
          t.slug.toLowerCase().includes(q) ||
          (t.contact_email && t.contact_email.toLowerCase().includes(q))
      )
    }

    return result
  }, [data, searchQuery, statusFilter])

  const columns: ColumnDef<TenantWithCounts>[] = useMemo(
    () => [
      {
        accessorKey: "name",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-4"
          >
            Name
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/admin/tenants/${row.original.id}`}
            className="font-medium hover:underline"
          >
            {row.original.name}
          </Link>
        ),
      },
      {
        accessorKey: "slug",
        header: "Slug",
        cell: ({ row }) => (
          <span className="text-muted-foreground">{row.original.slug}</span>
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <TenantStatusBadge status={row.original.status} />
        ),
      },
      {
        accessorKey: "user_count",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-4"
          >
            Benutzer
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.user_count}</span>
        ),
      },
      {
        accessorKey: "vehicle_count",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-4"
          >
            Fahrzeuge
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <span className="tabular-nums">{row.original.vehicle_count}</span>
        ),
      },
      {
        accessorKey: "created_at",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-4"
          >
            Erstellt
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) =>
          new Date(row.original.created_at).toLocaleDateString("de-DE"),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const tenant = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  aria-label={`Aktionen für ${tenant.name}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/admin/tenants/${tenant.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Details anzeigen
                  </Link>
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => onEdit(tenant)}>
                  <Pencil className="mr-2 h-4 w-4" />
                  Bearbeiten
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => setConfirmTenant(tenant)}>
                  <Power className="mr-2 h-4 w-4" />
                  {tenant.status === "active"
                    ? "Deaktivieren"
                    : "Aktivieren"}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
      },
    ],
    [onEdit]
  )

  const table = useReactTable({
    data: filteredData,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    getPaginationRowModel: getPaginationRowModel(),
    initialState: {
      pagination: { pageSize: 20 },
    },
  })

  return (
    <>
      <div className="rounded-md border">
        <Table>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => (
                  <TableHead key={header.id}>
                    {header.isPlaceholder
                      ? null
                      : flexRender(
                          header.column.columnDef.header,
                          header.getContext()
                        )}
                  </TableHead>
                ))}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => (
                <TableRow key={row.id}>
                  {row.getVisibleCells().map((cell) => (
                    <TableCell key={cell.id}>
                      {flexRender(
                        cell.column.columnDef.cell,
                        cell.getContext()
                      )}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            ) : (
              <TableRow>
                <TableCell
                  colSpan={columns.length}
                  className="h-24 text-center text-muted-foreground"
                >
                  Keine Mandanten gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      {table.getPageCount() > 1 && (
        <div className="flex items-center justify-between pt-4">
          <p className="text-sm text-muted-foreground">
            Seite {table.getState().pagination.pageIndex + 1} von{" "}
            {table.getPageCount()} ({filteredData.length} Einträge)
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.previousPage()}
              disabled={!table.getCanPreviousPage()}
            >
              Zurück
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => table.nextPage()}
              disabled={!table.getCanNextPage()}
            >
              Weiter
            </Button>
          </div>
        </div>
      )}

      {/* Confirm activate/deactivate dialog */}
      <AlertDialog
        open={!!confirmTenant}
        onOpenChange={(open) => !open && setConfirmTenant(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {confirmTenant?.status === "active"
                ? "Mandant deaktivieren"
                : "Mandant aktivieren"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {confirmTenant?.status === "active"
                ? `Möchten Sie "${confirmTenant?.name}" wirklich deaktivieren? Alle Benutzer dieses Mandanten können sich nicht mehr anmelden. Die Daten bleiben erhalten.`
                : `Möchten Sie "${confirmTenant?.name}" wieder aktivieren? Benutzer können sich danach wieder anmelden.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Abbrechen</AlertDialogCancel>
            <AlertDialogAction
              onClick={() => {
                if (confirmTenant) {
                  onToggleStatus(confirmTenant)
                  setConfirmTenant(null)
                }
              }}
              className={
                confirmTenant?.status === "active"
                  ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
                  : ""
              }
            >
              {confirmTenant?.status === "active"
                ? "Deaktivieren"
                : "Aktivieren"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}
