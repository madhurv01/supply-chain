export interface AuthResponse {
  token: string;
  email: string;
}

export interface ForecastResult {
  commodity?: string;
  state?: string;
  avgPrice?: number;
  volatility?: number;
  topMarket?: string;
  topPrice?: number;
  demandIndicator?: string;
  narrative?: string;
  summary?: string;
  [key: string]: unknown;
}

export interface AnalysisChartPoint {
  label: string;
  value: number;
}

export interface AnalysisResult {
  topRecommendation?: string;
  topPrice?: number;
  chartData?: AnalysisChartPoint[];
}

export interface HistoryEntry {
  id: string | number;
  kind: string;
  query: string;
  report: string;
  createdAt: string;
}

export interface FarmPlot {
  id?: string | number;
  plotId: string;
  commodity: string;
  quantity: number;
  datePlanted: string;
  expectedHarvestDate: string;
  status?: 'GROWING' | 'HARVESTED';
}

export interface InventoryItem {
  commodity: string;
  quantity: number;
  unit: string;
}

export interface Shipment {
  id: string | number;
  truckId: string;
  commodity: string;
  quantity: number;
  destinationMarket: string;
  currentLat: number;
  currentLon: number;
  destinationLat: number;
  destinationLon: number;
  progress: number;
  status: string;
}

export interface RouteRecommendation {
  market: string;
  price?: number;
  distanceKm?: number;
  transitTimeHours?: number;
  spoilageRisk?: string;
  netScore?: number;
  reasoning?: string;
  [key: string]: unknown;
}

export interface Sale {
  id?: string | number;
  commodity: string;
  quantity: number;
  pricePerUnit: number;
  market: string;
  createdAt?: string;
}

export interface FinanceSummary {
  totalRevenue: number;
  totalSales: number;
  avgSaleValue: number;
  byCommodity: { commodity: string; revenue: number }[];
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
}

export interface ToolCall {
  name: string;
  args: unknown;
  result: unknown;
}

export interface ChatResponse {
  reply: string;
  toolCalls?: ToolCall[];
}

export interface GradingResult {
  grade: 'A' | 'B' | 'C';
  defects: string[];
  confidence: number;
  notes: string;
}
