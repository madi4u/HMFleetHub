"use client"

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"

interface CostByCategoryChartProps {
  data: { category: string; total_gross: number }[]
}

const CATEGORY_LABELS: Record<string, string> = {
  REPAIR: "Reparatur",
  MAINTENANCE: "Wartung",
  OIL: "Oelwechsel",
  TIRES: "Reifen",
  INSPECTION: "Inspektion",
  BODYWORK: "Karosserie",
  ELECTRICAL: "Elektrik",
  OTHER: "Sonstiges",
}

function formatEuro(value: number): string {
  return value.toLocaleString("de-DE", {
    style: "currency",
    currency: "EUR",
    minimumFractionDigits: 0,
    maximumFractionDigits: 0,
  })
}

export function CostByCategoryChart({ data }: CostByCategoryChartProps) {
  const chartData = data.map((d) => ({
    category: CATEGORY_LABELS[d.category] ?? d.category,
    total_gross: d.total_gross,
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Kosten nach Kategorie</CardTitle>
      </CardHeader>
      <CardContent>
        {chartData.length === 0 ? (
          <p className="text-sm text-muted-foreground py-8 text-center">
            Keine Kostendaten vorhanden.
          </p>
        ) : (
          <ResponsiveContainer width="100%" height={220}>
            <BarChart data={chartData}>
              <CartesianGrid
                strokeDasharray="3 3"
                stroke="hsl(var(--border))"
              />
              <XAxis
                dataKey="category"
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 11 }}
                tickLine={false}
                axisLine={false}
              />
              <YAxis
                tickFormatter={(v: number) => formatEuro(v)}
                tick={{ fill: "hsl(var(--muted-foreground))", fontSize: 12 }}
                tickLine={false}
                axisLine={false}
                width={80}
              />
              <Tooltip
                contentStyle={{
                  backgroundColor: "hsl(var(--card))",
                  border: "1px solid hsl(var(--border))",
                  borderRadius: "8px",
                  color: "hsl(var(--foreground))",
                }}
                formatter={(value) => [formatEuro(Number(value)), "Kosten"]}
              />
              <Bar
                dataKey="total_gross"
                fill="hsl(var(--primary))"
                radius={[4, 4, 0, 0]}
              />
            </BarChart>
          </ResponsiveContainer>
        )}
      </CardContent>
    </Card>
  )
}
