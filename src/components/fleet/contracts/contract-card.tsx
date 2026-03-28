"use client"

import { Pencil, Trash2 } from "lucide-react"

import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardHeader,
} from "@/components/ui/card"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Separator } from "@/components/ui/separator"
import { ContractTypeBadge } from "./contract-type-badge"
import { ContractStatusBadge } from "./contract-status-badge"
import { ContractDocumentList } from "./contract-document-list"
import type { Contract, ContractDocument } from "@/types/database"

interface ContractCardProps {
  contract: Contract
  vehicleId: string
  canEdit: boolean
  canViewFinancials: boolean
  onEdit: (contract: Contract) => void
  onDelete: (contractId: string) => void
  onDocumentAdded: (contractId: string, doc: ContractDocument) => void
  onDocumentDeleted: (contractId: string, docId: string) => void
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return "Unbefristet"
  return new Date(dateStr).toLocaleDateString("de-DE")
}

function formatCurrency(
  value: number | null,
  currency: string
): string {
  if (value == null) return "\u2014"
  return new Intl.NumberFormat("de-DE", {
    style: "currency",
    currency,
  }).format(value)
}

export function ContractCard({
  contract,
  vehicleId,
  canEdit,
  canViewFinancials,
  onEdit,
  onDelete,
  onDocumentAdded,
  onDocumentDeleted,
}: ContractCardProps) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-start justify-between gap-4 space-y-0">
        <div className="flex flex-wrap items-center gap-2">
          <ContractTypeBadge type={contract.contract_type} />
          <ContractStatusBadge status={contract.contract_status} />
          <span className="font-semibold">{contract.provider}</span>
        </div>
        {canEdit && (
          <div className="flex items-center gap-1 shrink-0">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onEdit(contract)}
              aria-label="Vertrag bearbeiten"
            >
              <Pencil className="h-4 w-4" />
            </Button>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label="Vertrag loeschen"
                >
                  <Trash2 className="h-4 w-4 text-destructive" />
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Vertrag loeschen?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Moechten Sie diesen Vertrag bei {contract.provider} wirklich
                    loeschen? Alle zugehoerigen Dokumente werden ebenfalls
                    geloescht.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Abbrechen</AlertDialogCancel>
                  <AlertDialogAction onClick={() => onDelete(contract.id)}>
                    Loeschen
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        )}
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Contract Details Grid */}
        <div className="grid gap-3 sm:grid-cols-2">
          <DetailItem
            label="Vertragsbeginn"
            value={formatDate(contract.contract_start)}
          />
          <DetailItem
            label="Vertragsende"
            value={
              contract.contract_end
                ? formatDate(contract.contract_end)
                : "Unbefristet"
            }
          />
          <DetailItem
            label="Vertragsnummer"
            value={contract.contract_number || "\u2014"}
          />
          <DetailItem
            label="Kuendigungsfrist"
            value={
              contract.notice_period_days != null
                ? `${contract.notice_period_days} Tage`
                : "\u2014"
            }
          />
        </div>

        {/* Financial fields - only if permitted */}
        {canViewFinancials && (
          <>
            <Separator />
            <div className="grid gap-3 sm:grid-cols-2">
              {contract.monthly_cost != null && (
                <DetailItem
                  label="Monatliche Rate"
                  value={formatCurrency(
                    contract.monthly_cost,
                    contract.currency
                  )}
                />
              )}
              {contract.purchase_price != null && (
                <DetailItem
                  label="Kaufpreis"
                  value={formatCurrency(
                    contract.purchase_price,
                    contract.currency
                  )}
                />
              )}
              {contract.financing_amount != null && (
                <DetailItem
                  label="Finanzierungssumme"
                  value={formatCurrency(
                    contract.financing_amount,
                    contract.currency
                  )}
                />
              )}
              {contract.residual_value != null && (
                <DetailItem
                  label="Restwert"
                  value={formatCurrency(
                    contract.residual_value,
                    contract.currency
                  )}
                />
              )}
            </div>
          </>
        )}

        {/* Notes */}
        {contract.notes && (
          <>
            <Separator />
            <div className="space-y-1">
              <p className="text-sm font-medium text-muted-foreground">
                Notizen
              </p>
              <p className="text-sm whitespace-pre-wrap">{contract.notes}</p>
            </div>
          </>
        )}

        {/* Documents */}
        <Separator />
        <ContractDocumentList
          contractId={contract.id}
          vehicleId={vehicleId}
          documents={contract.documents}
          canEdit={canEdit}
          onDocumentAdded={(doc) => onDocumentAdded(contract.id, doc)}
          onDocumentDeleted={(docId) => onDocumentDeleted(contract.id, docId)}
        />
      </CardContent>
    </Card>
  )
}

function DetailItem({ label, value }: { label: string; value: string }) {
  return (
    <div className="space-y-1">
      <p className="text-sm font-medium text-muted-foreground">{label}</p>
      <p className="text-sm">{value}</p>
    </div>
  )
}
