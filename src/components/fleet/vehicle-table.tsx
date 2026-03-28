"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  useReactTable,
  getCoreRowModel,
  getSortedRowModel,
  getPaginationRowModel,
  flexRender,
  type ColumnDef,
  type SortingState,
} from "@tanstack/react-table"
import {
  ArrowUpDown,
  MoreHorizontal,
  Eye,
  Pencil,
  Trash2,
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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { VehicleStatusBadge } from "@/components/fleet/vehicle-status-badge"
import { VehicleTypeBadge } from "@/components/fleet/vehicle-type-badge"
import { VehiclePhoto } from "@/components/fleet/vehicle-photo"
import type { Vehicle } from "@/types/database"
import type { UserRole } from "@/types/database"
import { hasPermission } from "@/lib/permissions.config"

interface VehicleTableProps {
  data: Vehicle[]
  total: number
  page: number
  pageSize: number
  userRole: UserRole
  onPageChange: (page: number) => void
  onPageSizeChange: (size: number) => void
}

export function VehicleTable({
  data,
  total,
  page,
  pageSize,
  userRole,
  onPageChange,
  onPageSizeChange,
}: VehicleTableProps) {
  const [sorting, setSorting] = useState<SortingState>([])

  const canEdit = hasPermission(userRole, "vehicles.edit")
  const canDelete =
    userRole === "SUPERADMIN" || userRole === "TENANT_ADMIN"

  const columns: ColumnDef<Vehicle>[] = useMemo(
    () => [
      {
        id: "photo",
        header: "",
        cell: ({ row }) => (
          <VehiclePhoto
            imageUrl={row.original.image_url}
            licensePlate={row.original.license_plate}
            size="sm"
          />
        ),
        enableSorting: false,
      },
      {
        accessorKey: "license_plate",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-4"
          >
            Kennzeichen
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => (
          <Link
            href={`/fleet/${row.original.id}`}
            className="font-medium uppercase hover:underline"
          >
            {row.original.license_plate}
          </Link>
        ),
      },
      {
        id: "make_model",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-4"
          >
            Marke / Modell
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        accessorFn: (row) => `${row.make} ${row.model}`,
        cell: ({ row }) => (
          <span>
            {row.original.make} {row.original.model}
          </span>
        ),
      },
      {
        accessorKey: "vehicle_type",
        header: "Fahrzeugtyp",
        cell: ({ row }) => (
          <VehicleTypeBadge type={row.original.vehicle_type} />
        ),
      },
      {
        accessorKey: "status",
        header: "Status",
        cell: ({ row }) => (
          <VehicleStatusBadge status={row.original.status} />
        ),
      },
      {
        accessorKey: "current_mileage",
        header: ({ column }) => (
          <Button
            variant="ghost"
            onClick={() =>
              column.toggleSorting(column.getIsSorted() === "asc")
            }
            className="-ml-4"
          >
            Kilometerstand
            <ArrowUpDown className="ml-2 h-4 w-4" />
          </Button>
        ),
        cell: ({ row }) => {
          const km = row.original.current_mileage
          return km != null ? (
            <span className="tabular-nums">
              {km.toLocaleString("de-DE")} km
            </span>
          ) : (
            <span className="text-muted-foreground">--</span>
          )
        },
      },
      {
        accessorKey: "location",
        header: "Standort",
        cell: ({ row }) =>
          row.original.location || (
            <span className="text-muted-foreground">--</span>
          ),
      },
      {
        accessorKey: "assigned_to",
        header: "Zugewiesen an",
        cell: ({ row }) =>
          row.original.assigned_to || (
            <span className="text-muted-foreground">--</span>
          ),
      },
      {
        id: "actions",
        header: "",
        cell: ({ row }) => {
          const vehicle = row.original
          return (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  variant="ghost"
                  className="h-8 w-8 p-0"
                  aria-label={`Aktionen für ${vehicle.license_plate}`}
                >
                  <MoreHorizontal className="h-4 w-4" />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem asChild>
                  <Link href={`/fleet/${vehicle.id}`}>
                    <Eye className="mr-2 h-4 w-4" />
                    Details anzeigen
                  </Link>
                </DropdownMenuItem>
                {canEdit && (
                  <DropdownMenuItem asChild>
                    <Link href={`/fleet/${vehicle.id}/edit`}>
                      <Pencil className="mr-2 h-4 w-4" />
                      Bearbeiten
                    </Link>
                  </DropdownMenuItem>
                )}
                {canDelete && (
                  <DropdownMenuItem asChild>
                    <Link href={`/fleet/${vehicle.id}/edit`}>
                      <Trash2 className="mr-2 h-4 w-4" />
                      Löschen
                    </Link>
                  </DropdownMenuItem>
                )}
              </DropdownMenuContent>
            </DropdownMenu>
          )
        },
        enableSorting: false,
      },
    ],
    [canEdit, canDelete]
  )

  const table = useReactTable({
    data,
    columns,
    state: { sorting },
    onSortingChange: setSorting,
    getCoreRowModel: getCoreRowModel(),
    getSortedRowModel: getSortedRowModel(),
    manualPagination: true,
    pageCount: Math.ceil(total / pageSize),
  })

  const totalPages = Math.ceil(total / pageSize)

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
            {data.length > 0 ? (
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
                  Keine Fahrzeuge gefunden.
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>

      {/* Pagination */}
      <div className="flex flex-col gap-4 pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2">
          <span className="text-sm text-muted-foreground">Einträge pro Seite:</span>
          <Select
            value={String(pageSize)}
            onValueChange={(val) => onPageSizeChange(Number(val))}
          >
            <SelectTrigger className="w-20" aria-label="Einträge pro Seite">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="25">25</SelectItem>
              <SelectItem value="50">50</SelectItem>
              <SelectItem value="100">100</SelectItem>
            </SelectContent>
          </Select>
          <span className="text-sm text-muted-foreground">
            {total} Fahrzeug{total !== 1 ? "e" : ""} gesamt
          </span>
        </div>

        <div className="flex items-center gap-2">
          <p className="text-sm text-muted-foreground">
            Seite {page} von {totalPages || 1}
          </p>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page - 1)}
            disabled={page <= 1}
          >
            Zurück
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(page + 1)}
            disabled={page >= totalPages}
          >
            Weiter
          </Button>
        </div>
      </div>
    </>
  )
}
