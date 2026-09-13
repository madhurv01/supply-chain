"use client";

import { useEffect, useState } from "react";
import { Loader2, TrendingUp } from "lucide-react";
import { toast } from "sonner";
import { PageHeader } from "@/components/layout/page-header";
import { StatCard } from "@/components/stat-card";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { api, ForecastHistoryItem, ForecastResult } from "@/lib/api";

export default function ForecastPage() {
  const [commodities, setCommodities] = useState<string[]>([]);
  const [commodity, setCommodity] = useState("");
  const [state, setState] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<ForecastResult | null>(null);
  const [history, setHistory] = useState<ForecastHistoryItem[]>([]);

  useEffect(() => {
    api.commodities().then(setCommodities).catch(() => setCommodities([]));
    api.forecastHistory("ai_forecast").then(setHistory).catch(() => setHistory([]));
  }, []);

  async function handleGenerate() {
    if (!commodity) {
      toast.error("Select a commodity first");
      return;
    }
    setLoading(true);
    try {
      const res = await api.forecast({ commodity, state: state || undefined });
      setResult(res);
      api.forecastHistory("ai_forecast").then(setHistory).catch(() => {});
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Failed to generate forecast");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div>
      <PageHeader
        title="Forecast"
        description="AI-assisted price forecasting for a commodity"
      />

      <Card className="border-border/60">
        <CardContent className="grid grid-cols-1 gap-4 pt-6 sm:grid-cols-[1fr_1fr_auto]">
          <div className="space-y-2">
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
          <div className="space-y-2">
            <Label>State (optional)</Label>
            <Input
              value={state}
              onChange={(e) => setState(e.target.value)}
              placeholder="e.g. Maharashtra"
            />
          </div>
          <div className="flex items-end">
            <Button onClick={handleGenerate} disabled={loading} className="w-full sm:w-auto">
              {loading ? <Loader2 className="h-4 w-4 animate-spin" /> : <TrendingUp className="h-4 w-4" />}
              Generate Forecast
            </Button>
          </div>
        </CardContent>
      </Card>

      {result && (
        <div className="mt-6">
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <StatCard
              label="Average Price"
              value={result.avg_price != null ? `₹${result.avg_price}` : "—"}
            />
            <StatCard
              label="Volatility"
              value={result.volatility_pct != null ? `${result.volatility_pct}%` : "—"}
            />
            <StatCard
              label="Top Market"
              value={result.top_market ?? "—"}
            />
            <StatCard
              label="Top Price"
              value={result.top_price != null ? `₹${result.top_price}` : "—"}
            />
          </div>
          {(result.demand_indicator || result.summary) && (
            <Card className="mt-4 border-border/60">
              <CardContent className="pt-6 space-y-2">
                {result.demand_indicator && (
                  <p className="text-sm">
                    <span className="text-muted-foreground">Demand indicator: </span>
                    {String(result.demand_indicator)}
                  </p>
                )}
                {result.summary && (
                  <p className="text-sm leading-relaxed">{String(result.summary)}</p>
                )}
              </CardContent>
            </Card>
          )}
        </div>
      )}

      <Card className="mt-6 border-border/60">
        <CardHeader>
          <CardTitle className="text-base">Forecast History</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          {history.length === 0 && (
            <p className="text-sm text-muted-foreground">No saved forecasts yet.</p>
          )}
          {history.map((h) => (
            <div key={h.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between gap-2">
                <span className="font-medium">{h.query ?? "Forecast"}</span>
                {h.created_at && (
                  <span className="text-xs text-muted-foreground">
                    {new Date(h.created_at).toLocaleString()}
                  </span>
                )}
              </div>
              {h.report && (
                <p className="mt-1 text-muted-foreground line-clamp-3">{h.report}</p>
              )}
            </div>
          ))}
        </CardContent>
      </Card>
    </div>
  );
}
