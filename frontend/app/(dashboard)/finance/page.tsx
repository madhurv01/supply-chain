"use client";

import { useEffect, useMemo, useState } from "react";
import { QRCodeSVG } from "qrcode.react";
import { Loader2, Wallet } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, FinanceSummary, Sale, Shipment } from "@/lib/api";

const UPI_ID = process.env.NEXT_PUBLIC_UPI_ID || "demo@upi";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export default function FinancePage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [selectedShipmentId, setSelectedShipmentId] = useState<string>("");
  const [price, setPrice] = useState("");
  const [logging, setLogging] = useState(false);
  const [summary, setSummary] = useState<FinanceSummary | null>(null);
  const [sales, setSales] = useState<Sale[]>([]);

  useEffect(() => {
    api.shipments().then(setShipments).catch(() => setShipments([]));
    api.financeSummary().then(setSummary).catch(() => setSummary(null));
    api.sales().then(setSales).catch(() => setSales([]));
  }, []);

  const arrivedShipments = shipments.filter((s) => s.status === "ARRIVED");
  const selectedShipment = arrivedShipments.find((s) => String(s.id) === selectedShipmentId);

  const upiLink = useMemo(() => {
    if (!selectedShipment || !price) return null;
    const amount = Number(price) * selectedShipment.quantity;
    if (!amount || Number.isNaN(amount)) return null;
    const params = new URLSearchParams({
      pa: UPI_ID,
      pn: "Agri-Chain OS",
      am: amount.toFixed(2),
      cu: "INR",
      tn: `${selectedShipment.commodity} sale - ${selectedShipment.destination_market}`,
    });
    return `upi://pay?${params.toString()}`;
  }, [selectedShipment, price]);

  async function handleLogSale() {
    if (!selectedShipment || !price) {
      toast.error("Select a shipment and enter a price");
      return;
    }
    setLogging(true);
    try {
      await api.createSale({
        commodity: selectedShipment.commodity,
        quantity: selectedShipment.quantity,
        price_per_unit: Number(price),
        market: selectedShipment.destination_market,
      });
      toast.success("Sale logged");
      setPrice("");
      setSelectedShipmentId("");
      api.financeSummary().then(setSummary).catch(() => {});
      api.sales().then(setSales).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to log sale");
    } finally {
      setLogging(false);
    }
  }

  return (
    <div>
      <PageHeader title="Finance" description="Log sales via UPI and review revenue" />

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">Log a Sale</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label>Arrived Shipment</Label>
              <Select value={selectedShipmentId} onValueChange={(v) => setSelectedShipmentId(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select a shipment" />
                </SelectTrigger>
                <SelectContent>
                  {arrivedShipments.map((s) => (
                    <SelectItem key={s.id} value={String(s.id)}>
                      {s.truck_id} · {s.commodity} · {s.quantity}kg → {s.destination_market}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {arrivedShipments.length === 0 && (
                <p className="text-xs text-muted-foreground">No arrived shipments yet.</p>
              )}
            </div>
            <div className="space-y-2">
              <Label>Price per unit (₹)</Label>
              <Input type="number" value={price} onChange={(e) => setPrice(e.target.value)} placeholder="e.g. 25" />
            </div>
            <Button onClick={handleLogSale} disabled={logging} className="w-full">
              {logging && <Loader2 className="h-4 w-4 animate-spin" />}
              Log Sale & Generate QR
            </Button>
          </CardContent>
        </Card>

        <Card className="border-border/60">
          <CardHeader>
            <CardTitle className="text-base">UPI Payment QR</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col items-center justify-center gap-4 py-8">
            {upiLink ? (
              <>
                <div className="rounded-xl bg-white p-4 shadow-inner">
                  <QRCodeSVG value={upiLink} size={200} />
                </div>
                <p className="text-center text-sm text-muted-foreground">
                  ₹{(Number(price) * (selectedShipment?.quantity ?? 0)).toFixed(2)} to {UPI_ID}
                </p>
              </>
            ) : (
              <p className="text-sm text-muted-foreground text-center">
                Select a shipment and enter a price to generate a payment QR.
              </p>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 sm:grid-cols-3">
        <StatCard
          label="Total Revenue"
          value={`₹${(summary?.total_revenue ?? 0).toLocaleString()}`}
          icon={Wallet}
        />
        <StatCard label="Total Sales" value={summary?.total_sales ?? 0} />
        <StatCard
          label="Avg Sale Value"
          value={`₹${(summary?.avg_sale_value ?? 0).toLocaleString()}`}
        />
      </div>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Revenue by Commodity</CardTitle>
        </CardHeader>
        <CardContent className="h-72">
          {!summary?.by_commodity || summary.by_commodity.length === 0 ? (
            <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
              No revenue data yet
            </div>
          ) : (
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={summary.by_commodity}>
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
                  {summary.by_commodity.map((_, i) => (
                    <Cell key={i} fill={COLORS[i % COLORS.length]} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Recent Sales</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Commodity</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead className="text-right">Price/unit</TableHead>
                <TableHead>Market</TableHead>
                <TableHead>Date</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sales.map((s, i) => (
                <TableRow key={s.id ?? i}>
                  <TableCell className="font-medium">{s.commodity}</TableCell>
                  <TableCell className="text-right">{s.quantity}</TableCell>
                  <TableCell className="text-right">₹{s.price_per_unit}</TableCell>
                  <TableCell>{s.market ?? "—"}</TableCell>
                  <TableCell>{s.created_at ? new Date(s.created_at).toLocaleDateString() : "—"}</TableCell>
                </TableRow>
              ))}
              {sales.length === 0 && (
                <TableRow>
                  <TableCell colSpan={5} className="text-center text-muted-foreground">
                    No sales yet
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
