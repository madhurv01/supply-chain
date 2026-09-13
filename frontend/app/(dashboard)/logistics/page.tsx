"use client";

import { useEffect, useRef, useState } from "react";
import dynamic from "next/dynamic";
import { Loader2, Truck } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { api, Shipment } from "@/lib/api";

const LogisticsMap = dynamic(() => import("@/components/logistics-map"), {
  ssr: false,
  loading: () => (
    <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
      Loading map...
    </div>
  ),
});

export default function LogisticsPage() {
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [commodities, setCommodities] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [live, setLive] = useState(false);
  const [truckId, setTruckId] = useState("");
  const [commodity, setCommodity] = useState("");
  const [quantity, setQuantity] = useState("");
  const [destination, setDestination] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  async function refreshShipments() {
    try {
      const data = await api.shipments();
      setShipments(data);
    } catch {
      // keep last known state
    }
  }

  useEffect(() => {
    api.commodities().then(setCommodities).catch(() => setCommodities([]));
    api.markets().then(setMarkets).catch(() => setMarkets([]));
    refreshShipments();
  }, []);

  useEffect(() => {
    if (live) {
      intervalRef.current = setInterval(async () => {
        try {
          await api.tickShipments();
        } catch {
          // ignore tick failures
        }
        refreshShipments();
      }, 8000);
    } else if (intervalRef.current) {
      clearInterval(intervalRef.current);
      intervalRef.current = null;
    }
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [live]);

  async function handleDispatch(e: React.FormEvent) {
    e.preventDefault();
    if (!truckId || !commodity || !quantity || !destination) {
      toast.error("Fill in all fields");
      return;
    }
    setSubmitting(true);
    try {
      await api.createShipment({
        truck_id: truckId,
        commodity,
        quantity: Number(quantity),
        destination_market: destination,
      });
      toast.success("Shipment dispatched");
      setTruckId("");
      setQuantity("");
      refreshShipments();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to dispatch shipment");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Logistics"
        description="Track trucks in transit and dispatch new shipments"
        action={
          <Button variant={live ? "default" : "outline"} onClick={() => setLive((v) => !v)}>
            <Truck className="h-4 w-4" />
            {live ? "Live monitoring: ON" : "Live monitoring: OFF"}
          </Button>
        }
      />

      <Card className="h-[420px] overflow-hidden border-border/60 p-0">
        <LogisticsMap shipments={shipments} />
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Dispatch New Shipment</CardTitle>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleDispatch} className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5 lg:items-end">
            <div className="space-y-2">
              <Label>Truck ID</Label>
              <Input value={truckId} onChange={(e) => setTruckId(e.target.value)} placeholder="TRK-01" />
            </div>
            <div className="space-y-2">
              <Label>Commodity</Label>
              <Select value={commodity} onValueChange={(v) => setCommodity(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {commodities.map((c) => (
                    <SelectItem key={c} value={c}>
                      {c}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label>Quantity (kg)</Label>
              <Input
                type="number"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="200"
              />
            </div>
            <div className="space-y-2">
              <Label>Destination Market</Label>
              <Select value={destination} onValueChange={(v) => setDestination(v ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Select" />
                </SelectTrigger>
                <SelectContent>
                  {markets.map((m) => (
                    <SelectItem key={m} value={m}>
                      {m}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <Button type="submit" disabled={submitting}>
              {submitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Dispatch
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Active Shipments</CardTitle>
        </CardHeader>
        <CardContent>
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Truck</TableHead>
                <TableHead>Commodity</TableHead>
                <TableHead className="text-right">Quantity</TableHead>
                <TableHead>Destination</TableHead>
                <TableHead className="text-right">Progress</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {shipments.map((s) => (
                <TableRow key={s.id}>
                  <TableCell className="font-medium">{s.truck_id}</TableCell>
                  <TableCell>{s.commodity}</TableCell>
                  <TableCell className="text-right">{s.quantity}</TableCell>
                  <TableCell>{s.destination_market}</TableCell>
                  <TableCell className="text-right">{Math.round((s.progress ?? 0) * 100)}%</TableCell>
                  <TableCell>
                    <Badge variant={s.status === "ARRIVED" ? "default" : "secondary"}>{s.status}</Badge>
                  </TableCell>
                </TableRow>
              ))}
              {shipments.length === 0 && (
                <TableRow>
                  <TableCell colSpan={6} className="text-center text-muted-foreground">
                    No active shipments
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
