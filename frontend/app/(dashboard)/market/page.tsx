"use client";

import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { api, AnalyzeResult, ForecastHistoryItem } from "@/lib/api";

const COLORS = [
  "var(--color-chart-1)",
  "var(--color-chart-2)",
  "var(--color-chart-3)",
  "var(--color-chart-4)",
  "var(--color-chart-5)",
];

export default function MarketPage() {
  const [commodities, setCommodities] = useState<string[]>([]);
  const [markets, setMarkets] = useState<string[]>([]);
  const [mode, setMode] = useState<"best_market_for_commodity" | "best_commodity_for_market">(
    "best_market_for_commodity"
  );
  const [commodity, setCommodity] = useState("");
  const [market, setMarket] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AnalyzeResult | null>(null);
  const [history, setHistory] = useState<ForecastHistoryItem[]>([]);

  useEffect(() => {
    api.commodities().then(setCommodities).catch(() => setCommodities([]));
    api.markets().then(setMarkets).catch(() => setMarkets([]));
    api.forecastHistory("market_analysis").then(setHistory).catch(() => setHistory([]));
  }, []);

  async function handleAnalyze() {
    const value = mode === "best_market_for_commodity" ? commodity : market;
    if (!value) {
      toast.error("Select a value first");
      return;
    }
    setLoading(true);
    try {
      const res = await api.analyze({ mode, value });
      setResult(res);
      api.forecastHistory("market_analysis").then(setHistory).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to run analysis");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader title="Market Analysis" description="Find the best market or commodity match" />

      <Card className="border-border/60">
        <CardContent className="pt-6">
          <Tabs
            value={mode}
            onValueChange={(v) => {
              setMode(v as typeof mode);
              setResult(null);
            }}
          >
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="best_market_for_commodity">Best market for commodity</TabsTrigger>
              <TabsTrigger value="best_commodity_for_market">Best commodity for market</TabsTrigger>
            </TabsList>
            <TabsContent value="best_market_for_commodity" className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Commodity</Label>
                <Select value={commodity} onValueChange={(v) => setCommodity(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select commodity" />
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
              <Button onClick={handleAnalyze} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Analyze
              </Button>
            </TabsContent>
            <TabsContent value="best_commodity_for_market" className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end">
              <div className="flex-1 space-y-2">
                <Label>Market</Label>
                <Select value={market} onValueChange={(v) => setMarket(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Select market" />
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
              <Button onClick={handleAnalyze} disabled={loading}>
                {loading && <Loader2 className="h-4 w-4 animate-spin" />}
                Analyze
              </Button>
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {result && (
        <div className="mt-6 space-y-4">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <StatCard label="Top Recommendation" value={result.top_recommendation ?? "—"} />
            <StatCard
              label="Top Price"
              value={result.top_price != null ? `₹${result.top_price}` : "—"}
            />
          </div>
          {result.chart_data && result.chart_data.length > 0 && (
            <Card className="border-border/60">
              <CardHeader>
                <CardTitle className="text-base">Comparison</CardTitle>
              </CardHeader>
              <CardContent className="h-72">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={result.chart_data}>
                    <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border)" />
                    <XAxis dataKey="label" stroke="var(--color-muted-foreground)" fontSize={12} />
                    <YAxis stroke="var(--color-muted-foreground)" fontSize={12} />
                    <Tooltip
                      contentStyle={{
                        background: "var(--color-card)",
                        border: "1px solid var(--color-border)",
                        borderRadius: 8,
                        color: "var(--color-card-foreground)",
                      }}
                    />
                    <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                      {result.chart_data.map((_, i) => (
                        <Cell key={i} fill={COLORS[i % COLORS.length]} />
                      ))}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Analysis History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No saved analyses yet.</p>
          )}
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{h.query ?? "Analysis"}</span>
                {h.created_at && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                )}
              </div>
              {h.report && <p className="mt-1 text-muted-foreground line-clamp-3">{h.report}</p>}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
