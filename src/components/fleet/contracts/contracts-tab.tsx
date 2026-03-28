"use client"

import { useState, useEffect, useCallback } from "react"
import { Plus } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import { hasPermission } from "@/lib/permissions.config"
import { ContractCard } from "./contract-card"
import { ContractSheet } from "./contract-sheet"
import type { Contract, ContractDocument, UserRole } from "@/types/database"

interface ContractsTabProps {
  vehicleId: string
  userRole: UserRole
}

export function ContractsTab({ vehicleId, userRole }: ContractsTabProps) {
  const [contracts, setContracts] = useState<Contract[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const [editContract, setEditContract] = useState<Contract | null>(null)

  const canViewContracts = hasPermission(userRole, "vehicles.contracts.view")
  const canEdit = hasPermission(userRole, "vehicles.contracts.edit")
  const canViewFinancials = hasPermission(userRole, "vehicles.financials.view")

  const fetchContracts = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch(`/api/vehicles/${vehicleId}/contracts`)
      if (!res.ok) {
        throw new Error("Verträge konnten nicht geladen werden.")
      }
      const json = await res.json()
      setContracts(json.data ?? [])
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      )
    } finally {
      setIsLoading(false)
    }
  }, [vehicleId])

  useEffect(() => {
    if (canViewContracts) {
      fetchContracts()
    } else {
      setIsLoading(false)
    }
  }, [canViewContracts, fetchContracts])

  // Permission guard
  if (!canViewContracts) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-muted-foreground">
            Keine Berechtigung für Vertragsdaten.
          </p>
        </CardContent>
      </Card>
    )
  }

  // Loading state
  if (isLoading) {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Skeleton className="h-7 w-32" />
          <Skeleton className="h-9 w-40" />
        </div>
        <Skeleton className="h-48 w-full" />
        <Skeleton className="h-48 w-full" />
      </div>
    )
  }

  // Error state
  if (error) {
    return (
      <Card>
        <CardContent className="py-10 text-center">
          <p className="text-sm text-destructive">{error}</p>
          <Button variant="outline" size="sm" className="mt-4" onClick={fetchContracts}>
            Erneut versuchen
          </Button>
        </CardContent>
      </Card>
    )
  }

  function handleEdit(contract: Contract) {
    setEditContract(contract)
    setSheetOpen(true)
  }

  async function handleDelete(contractId: string) {
    try {
      const res = await fetch(
        `/api/vehicles/${vehicleId}/contracts/${contractId}`,
        { method: "DELETE" }
      )
      if (!res.ok) {
        throw new Error("Vertrag konnte nicht gelöscht werden.")
      }
      setContracts((prev) => prev.filter((c) => c.id !== contractId))
    } catch {
      // Could add toast notification here
    }
  }

  function handleSaved(saved: Contract) {
    setContracts((prev) => {
      const idx = prev.findIndex((c) => c.id === saved.id)
      if (idx >= 0) {
        // Update existing
        const updated = [...prev]
        updated[idx] = saved
        return updated
      }
      // Add new
      return [saved, ...prev]
    })
    setEditContract(null)
  }

  function handleDocumentAdded(contractId: string, doc: ContractDocument) {
    setContracts((prev) =>
      prev.map((c) =>
        c.id === contractId
          ? { ...c, documents: [...c.documents, doc] }
          : c
      )
    )
  }

  function handleDocumentDeleted(contractId: string, docId: string) {
    setContracts((prev) =>
      prev.map((c) =>
        c.id === contractId
          ? {
              ...c,
              documents: c.documents.filter((d) => d.id !== docId),
            }
          : c
      )
    )
  }

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <h2 className="text-lg font-semibold">Verträge</h2>
        {canEdit && (
          <Button
            size="sm"
            onClick={() => {
              setEditContract(null)
              setSheetOpen(true)
            }}
          >
            <Plus className="mr-2 h-4 w-4" />
            Vertrag hinzufügen
          </Button>
        )}
      </div>

      {/* Empty state */}
      {contracts.length === 0 ? (
        <Card>
          <CardHeader>
            <CardTitle className="text-base font-normal text-muted-foreground text-center">
              Noch keine Verträge erfasst.
            </CardTitle>
          </CardHeader>
        </Card>
      ) : (
        <div className="space-y-4">
          {contracts.map((contract) => (
            <ContractCard
              key={contract.id}
              contract={contract}
              vehicleId={vehicleId}
              canEdit={canEdit}
              canViewFinancials={canViewFinancials}
              onEdit={handleEdit}
              onDelete={handleDelete}
              onDocumentAdded={handleDocumentAdded}
              onDocumentDeleted={handleDocumentDeleted}
            />
          ))}
        </div>
      )}

      {/* Create / Edit Sheet */}
      <ContractSheet
        vehicleId={vehicleId}
        contract={editContract}
        open={sheetOpen}
        onOpenChange={(open) => {
          setSheetOpen(open)
          if (!open) setEditContract(null)
        }}
        onSaved={handleSaved}
      />
    </div>
  )
}
