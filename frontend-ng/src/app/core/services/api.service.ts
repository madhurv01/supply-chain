import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import {
  AnalysisResult,
  ChatMessage,
  ChatResponse,
  FarmPlot,
  FinanceSummary,
  ForecastResult,
  GradingResult,
  HistoryEntry,
  InventoryItem,
  RouteRecommendation,
  Sale,
  Shipment,
} from '../models/api.models';

@Injectable({ providedIn: 'root' })
export class ApiService {
  private readonly base = environment.apiBaseUrl;

  constructor(private http: HttpClient) {}

  health(): Observable<unknown> {
    return this.http.get(`${this.base}/health`);
  }

  // Market
  getCommodities(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/market/commodities`);
  }

  getMarkets(): Observable<string[]> {
    return this.http.get<string[]>(`${this.base}/market/markets`);
  }

  forecast(commodity: string, state?: string): Observable<ForecastResult> {
    return this.http.post<ForecastResult>(`${this.base}/market/forecast`, { commodity, state });
  }

  analyze(mode: 'best_market_for_commodity' | 'best_commodity_for_market', value: string): Observable<AnalysisResult> {
    return this.http.post<AnalysisResult>(`${this.base}/market/analyze`, { mode, value });
  }

  getHistory(kind: 'ai_forecast' | 'market_analysis'): Observable<HistoryEntry[]> {
    const params: Record<string, string> = { kind };
    return this.http.get<HistoryEntry[]>(`${this.base}/forecasts`, { params });
  }

  // Farm
  getPlots(status?: 'GROWING' | 'HARVESTED'): Observable<FarmPlot[]> {
    const params: Record<string, string> = status ? { status } : {};
    return this.http.get<FarmPlot[]>(`${this.base}/farm/plots`, { params });
  }

  addPlot(payload: {
    commodity: string;
    plotId: string;
    quantity: number;
    datePlanted: string;
    expectedHarvestDate: string;
  }): Observable<FarmPlot> {
    return this.http.post<FarmPlot>(`${this.base}/farm/plots`, payload);
  }

  harvest(payload: { plotRowId: string | number; commodity: string; quantity: number }): Observable<unknown> {
    return this.http.post(`${this.base}/farm/harvest`, payload);
  }

  // Inventory
  getInventory(): Observable<InventoryItem[]> {
    return this.http.get<InventoryItem[]>(`${this.base}/inventory`);
  }

  // Logistics
  getShipments(): Observable<Shipment[]> {
    return this.http.get<Shipment[]>(`${this.base}/logistics/shipments`);
  }

  dispatchShipment(payload: {
    truckId: string;
    commodity: string;
    quantity: number;
    destinationMarket: string;
  }): Observable<Shipment> {
    return this.http.post<Shipment>(`${this.base}/logistics/shipments`, payload);
  }

  advanceShipments(): Observable<unknown> {
    return this.http.post(`${this.base}/logistics/shipments/advance`, {});
  }

  deliverShipment(id: string | number): Observable<unknown> {
    return this.http.post(`${this.base}/logistics/shipments/${id}/deliver`, {});
  }

  optimizeRoute(commodity: string, quantity: number): Observable<RouteRecommendation[]> {
    return this.http.post<RouteRecommendation[]>(`${this.base}/logistics/optimize-route`, { commodity, quantity });
  }

  // Finance
  getSales(): Observable<Sale[]> {
    return this.http.get<Sale[]>(`${this.base}/finance/sales`);
  }

  addSale(payload: { commodity: string; quantity: number; pricePerUnit: number; market: string }): Observable<Sale> {
    return this.http.post<Sale>(`${this.base}/finance/sales`, payload);
  }

  getFinanceSummary(): Observable<FinanceSummary> {
    return this.http.get<FinanceSummary>(`${this.base}/finance/summary`);
  }

  // Agent
  chat(messages: ChatMessage[]): Observable<ChatResponse> {
    return this.http.post<ChatResponse>(`${this.base}/agent/chat`, { messages });
  }

  // Grading
  analyzeGrading(image: File, commodity: string): Observable<GradingResult> {
    const form = new FormData();
    form.append('image', image);
    form.append('commodity', commodity);
    return this.http.post<GradingResult>(`${this.base}/grading/analyze`, form);
  }
}
