import { supabase } from "@/lib/supabase";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || "http://localhost:8000";

export interface ForecastResult {
  avg_price?: number;
  volatility_pct?: number;
  top_market?: string;
  top_price?: number;
  demand_indicator?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface AnalyzeChartPoint {
  label: string;
  value: number;
  [key: string]: unknown;
}

export interface AnalyzeResult {
  top_recommendation?: string;
  top_price?: number;
  chart_data?: AnalyzeChartPoint[];
  [key: string]: unknown;
}

export interface ForecastHistoryItem {
  id: string | number;
  kind: string;
  query?: string;
  report?: string;
  created_at?: string;
  [key: string]: unknown;
}

export type PlotStatus = "GROWING" | "HARVESTED";

export interface Plot {
  id: string | number;
  commodity: string;
  plot_id: string;
  quantity: number;
  date_planted?: string;
  expected_harvest_date?: string;
  status?: PlotStatus;
  [key: string]: unknown;
}

export interface InventoryItem {
  commodity: string;
  quantity: number;
  unit?: string;
  [key: string]: unknown;
}

export type ShipmentStatus = "IN_TRANSIT" | "ARRIVED" | string;

export interface Shipment {
  id: string | number;
  truck_id: string;
  commodity: string;
  quantity: number;
  destination_market: string;
  current_lat: number;
  current_lon: number;
  destination_lat: number;
  destination_lon: number;
  progress: number;
  status: ShipmentStatus;
  [key: string]: unknown;
}

export interface Sale {
  id?: string | number;
  commodity: string;
  quantity: number;
  price_per_unit: number;
  market?: string;
  created_at?: string;
  [key: string]: unknown;
}

export interface FinanceSummary {
  total_revenue?: number;
  total_sales?: number;
  avg_sale_value?: number;
  by_commodity?: { commodity: string; revenue: number }[];
  [key: string]: unknown;
}

export interface AgentToolCall {
  name: string;
  args?: Record<string, unknown>;
  result?: unknown;
}

export interface AgentChatResponse {
  reply: string;
  tool_calls?: AgentToolCall[];
}

export interface ChatMessage {
  role: "user" | "assistant";
  content: string;
}

async function getAuthHeader(): Promise<Record<string, string>> {
  const { data } = await supabase.auth.getSession();
  const token = data.session?.access_token;
  return token ? { Authorization: `Bearer ${token}` } : {};
}

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const authHeader = await getAuthHeader();
  const res = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...authHeader,
      ...(options.headers || {}),
    },
  });

  if (!res.ok) {
    let message = `Request failed: ${res.status}`;
    try {
      const body = await res.json();
      message = body?.detail || body?.message || message;
    } catch {
      // ignore parse errors
    }
    throw new Error(message);
  }

  if (res.status === 204) return undefined as T;

  try {
    return (await res.json()) as T;
  } catch {
    return undefined as T;
  }
}

export const api = {
  health: () => request<{ status?: string }>("/health"),

  commodities: () => request<string[]>("/market/commodities"),
  markets: () => request<string[]>("/market/markets"),
  forecast: (body: { commodity: string; state?: string }) =>
    request<ForecastResult>("/market/forecast", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  analyze: (body: {
    mode: "best_market_for_commodity" | "best_commodity_for_market";
    value: string;
  }) =>
    request<AnalyzeResult>("/market/analyze", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  forecastHistory: (kind: "ai_forecast" | "market_analysis") =>
    request<ForecastHistoryItem[]>(`/forecasts?kind=${kind}`),

  plots: (status?: PlotStatus) =>
    request<Plot[]>(`/farm/plots${status ? `?status=${status}` : ""}`),
  createPlot: (body: {
    commodity: string;
    plot_id: string;
    quantity: number;
    date_planted: string;
    expected_harvest_date: string;
  }) =>
    request<Plot>("/farm/plots", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  harvestPlot: (id: string | number, body: { commodity: string; quantity: number }) =>
    request<Plot>(`/farm/plots/${id}/harvest`, {
      method: "POST",
      body: JSON.stringify(body),
    }),

  inventory: () => request<InventoryItem[]>("/inventory"),

  shipments: () => request<Shipment[]>("/logistics/shipments"),
  createShipment: (body: {
    truck_id: string;
    commodity: string;
    quantity: number;
    destination_market: string;
  }) =>
    request<Shipment>("/logistics/shipments", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  tickShipments: () =>
    request<unknown>("/logistics/shipments/tick", { method: "POST" }),

  sales: () => request<Sale[]>("/finance/sales"),
  createSale: (body: {
    commodity: string;
    quantity: number;
    price_per_unit: number;
    market: string;
  }) =>
    request<Sale>("/finance/sales", {
      method: "POST",
      body: JSON.stringify(body),
    }),
  financeSummary: () => request<FinanceSummary>("/finance/summary"),

  agentChat: (messages: ChatMessage[]) =>
    request<AgentChatResponse>("/agent/chat", {
      method: "POST",
      body: JSON.stringify({ messages }),
    }),
};
