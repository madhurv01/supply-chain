"use client";

import { useEffect, useState } from "react";
import { Warehouse, Truck, Wallet, Sprout } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { api, InventoryItem, Plot, Shipment, FinanceSummary } from "@/lib/api";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export default function DashboardHome() {
  const [loading, setLoading] = useState(true);
  const [inventory, setInventory] = useState<InventoryItem[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [plots, setPlots] = useState<Plot[]>([]);
  const [finance, setFinance] = useState<FinanceSummary | null>(null);

  useEffect(() => {
    async function load() {
      const results = await Promise.allSettled([
        api.inventory(),
        api.shipments(),
        api.plots("GROWING"),
        api.financeSummary(),
      ]);
      if (results[0].status === "fulfilled") setInventory(results[0].value);
      if (results[1].status === "fulfilled") setShipments(results[1].value);
      if (results[2].status === "fulfilled") setPlots(results[2].value);
      if (results[3].status === "fulfilled") setFinance(results[3].value);
      setLoading(false);
    }
    load();
  }, []);

  const totalInventory = inventory.reduce((sum, i) => sum + (i.quantity || 0), 0);
  const activeShipments = shipments.length;
  const revenue = finance?.total_revenue ?? 0;
  const growingPlots = plots.length;

  const shipmentsByStatus = Object.entries(
    shipments.reduce<Record<string, number>>((acc, s) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {})
  ).map(([status, count]) => ({ status, count }));

  const revenueByCommodity = finance?.by_commodity ?? [];

  return (
    <div>
      <PageHeader
        title="Dashboard"
        description="A quick pulse on your farm-to-market operations"
      />

      {loading ? (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <StatCard
            label="Total Inventory"
            value={totalInventory.toLocaleString()}
            icon={Warehouse}
            hint={`${inventory.length} commodities`}
          />
          <StatCard
            label="Active Shipments"
            value={activeShipments}
            icon={Truck}
          />
          <StatCard
            label="Revenue"
            value={`₹${revenue.toLocaleString()}`}
            icon={Wallet}
          />
          <StatCard
            label="Growing Plots"
            value={growingPlots}
            icon={Sprout}
          />
        </div>
      )}

      <div className="mt-6 grid grid-cols-1 gap-4 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Revenue by Commodity</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {revenueByCommodity.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={revenueByCommodity}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                  <XAxis dataKey="commodity" stroke="var(--color-muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-card-foreground)",
                    }}
                  />
                  <Bar dataKey="revenue" radius={[6, 6, 0, 0]}>
                    {revenueByCommodity.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Active Shipments by Status</CardTitle>
          </CardHeader>
          <CardContent className="h-72">
            {shipmentsByStatus.length === 0 ? (
              <EmptyChart />
            ) : (
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={shipmentsByStatus}
                    dataKey="count"
                    nameKey="status"
                    innerRadius={55}
                    outerRadius={90}
                    paddingAngle={3}
                  >
                    {shipmentsByStatus.map((_, i) => (
                      <Cell key={i} fill={COLORS[i % COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--color-card)",
                      border: "1px solid var(--color-border)",
                      borderRadius: 8,
                      color: "var(--color-card-foreground)",
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}

function EmptyChart() {
  return (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      No data yet
    </div>
  );
}
