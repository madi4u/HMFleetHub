import Link from "next/link"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { cn } from "@/lib/utils"
import type { DashboardExpiringContract } from "@/types/database"

interface ExpiringContractsListProps {
  items: DashboardExpiringContract[]
}

const CONTRACT_TYPE_LABELS: Record<string, string> = {
  LEASING: "Leasing",
  FINANCING: "Finanzierung",
  PURCHASE: "Kauf",
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("de-DE", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  })
}

function formatCurrency(value: number, currency: string): string {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  })
}

function getExpiryColor(endDateStr: string): string {
  const now = new Date()
  const end = new Date(endDateStr)
  const diffMs = end.getTime() - now.getTime()
  const diffDays = diffMs / (1000 * 60 * 60 * 24)

  if (diffDays <= 14) return "text-red-400 font-bold"
  return "text-yellow-400"
}

export function ExpiringContractsList({ items }: ExpiringContractsListProps) {
  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">
          Bald endende Verträge (60 Tage)
        </CardTitle>
      </CardHeader>
      <CardContent>
        {items.length === 0 ? (
          <p className="text-sm text-muted-foreground py-4 text-center">
            Keine Verträge laufen in den nächsten 60 Tagen aus.
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-muted-foreground">
                  <th className="pb-2 font-medium">Kennzeichen</th>
                  <th className="pb-2 font-medium hidden sm:table-cell">
                    Fahrzeug
                  </th>
                  <th className="pb-2 font-medium">Anbieter</th>
                  <th className="pb-2 font-medium hidden md:table-cell">Typ</th>
                  <th className="pb-2 font-medium">Enddatum</th>
                  <th className="pb-2 font-medium text-right hidden sm:table-cell">
                    Mtl. Kosten
                  </th>
                </tr>
              </thead>
              <tbody>
                {items.map((item) => (
                  <tr key={item.id} className="border-b border-border/50">
                    <td className="py-2">
                      <Link
                        href={`/fleet/${item.vehicle_id}?tab=vertraege`}
                        className="font-semibold hover:underline"
                      >
                        {item.vehicle_license_plate}
                      </Link>
                    </td>
                    <td className="py-2 text-muted-foreground hidden sm:table-cell">
                      {item.vehicle_make} {item.vehicle_model}
                    </td>
                    <td className="py-2 text-muted-foreground">
                      {item.provider}
                    </td>
                    <td className="py-2 text-muted-foreground hidden md:table-cell">
                      {CONTRACT_TYPE_LABELS[item.contract_type] ??
                        item.contract_type}
                    </td>
                    <td className={cn("py-2", getExpiryColor(item.contract_end))}>
                      {formatDate(item.contract_end)}
                    </td>
                    <td className="py-2 text-right text-muted-foreground hidden sm:table-cell">
                      {item.monthly_cost != null
                        ? formatCurrency(item.monthly_cost, item.currency)
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </CardContent>
    </Card>
  )
}
