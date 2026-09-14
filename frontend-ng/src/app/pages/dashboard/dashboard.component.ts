import { Component, AfterViewInit, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin, of } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import * as L from 'leaflet';
import { Observable } from 'rxjs';
import { ApiService } from '../../core/services/api.service';
import { FarmPlot, ForecastResult, InventoryItem, RouteRecommendation, Sale, Shipment } from '../../core/models/api.models';

interface HarvestRow extends FarmPlot {
  daysUntilHarvest: number;
  dueSoon: boolean;
}

interface MoverRow {
  commodity: string;
  avgPrice: number;
  volatility: number;
  topMarket?: string;
}

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit, AfterViewInit, OnDestroy {
  // KPI strip
  readonly loadingKpis = signal(true);
  readonly errorKpis = signal<string | null>(null);
  readonly totalInventory = signal(0);
  readonly activeShipments = signal(0);
  readonly totalRevenue = signal(0);
  readonly growingPlots = signal(0);

  // Panel 1: revenue trend
  readonly loadingRevenue = signal(true);
  readonly errorRevenue = signal<string | null>(null);
  readonly revenueTrendData = signal<ChartData<'line'>>({ labels: [], datasets: [{ data: [], label: 'Revenue', fill: true, borderColor: '#059669', backgroundColor: 'rgba(5,150,105,0.15)', tension: 0.3 }] });

  // Panel 2: inventory composition + value
  readonly loadingInventory = signal(true);
  readonly errorInventory = signal<string | null>(null);
  readonly inventoryChartData = signal<ChartData<'doughnut'>>({ labels: [], datasets: [{ data: [] }] });
  readonly inventoryValue = signal(0);
  readonly inventoryRows = signal<{ commodity: string; quantity: number; unit: string; estValue: number }[]>([]);

  // Panel 3: live shipment map
  readonly loadingMap = signal(true);
  readonly errorMap = signal<string | null>(null);
  private map?: L.Map;
  private markersLayer?: L.LayerGroup;
  private pendingShipments: Shipment[] = [];

  // Panel 4: harvest readiness
  readonly loadingHarvest = signal(true);
  readonly errorHarvest = signal<string | null>(null);
  readonly harvestRows = signal<HarvestRow[]>([]);

  // Panel 5: volatility / top movers
  readonly loadingMovers = signal(true);
  readonly errorMovers = signal<string | null>(null);
  readonly moverRows = signal<MoverRow[]>([]);

  // Panel 6: route optimizer quick insight
  readonly loadingOptimizer = signal(true);
  readonly errorOptimizer = signal<string | null>(null);
  readonly optimizerCommodity = signal<string | null>(null);
  readonly optimizerRec = signal<RouteRecommendation | null>(null);

  readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#334155' } } },
    scales: {
      x: { ticks: { color: '#475569' }, grid: { color: '#e5e7eb' } },
      y: { ticks: { color: '#475569' }, grid: { color: '#e5e7eb' } },
    },
  };

  readonly lineOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#475569' }, grid: { display: false } },
      y: { ticks: { color: '#475569' }, grid: { color: '#e5e7eb' } },
    },
  };

  readonly doughnutOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#334155' } } },
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.loadKpisAndInventory();
    this.loadRevenueTrend();
    this.loadShipmentsForMap();
    this.loadHarvestReadiness();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    this.map?.remove();
  }

  private loadKpisAndInventory(): void {
    forkJoin({
      inventory: this.api.getInventory().pipe(catchError(() => of(null))),
      shipments: this.api.getShipments().pipe(catchError(() => of(null))),
      summary: this.api.getFinanceSummary().pipe(catchError(() => of(null))),
      plots: this.api.getPlots('GROWING').pipe(catchError(() => of(null))),
      commodities: this.api.getCommodities().pipe(catchError(() => of(null))),
    }).subscribe(({ inventory, shipments, summary, plots, commodities }) => {
      if (inventory) {
        this.applyInventory(inventory);
      } else {
        this.errorInventory.set('Inventory data unavailable.');
      }
      if (shipments) {
        this.activeShipments.set(shipments.filter((s) => s.status !== 'DELIVERED').length);
      }
      if (summary) {
        this.totalRevenue.set(summary.totalRevenue ?? 0);
      } else {
        this.errorKpis.set('Some KPI data could not be loaded.');
      }
      this.growingPlots.set((plots ?? []).length);
      this.loadingKpis.set(false);
      this.loadingInventory.set(false);

      if (inventory && inventory.length > 0 && commodities) {
        this.loadInventoryValuationAndMovers(inventory, commodities);
      } else {
        this.loadingMovers.set(false);
      }

      if (inventory && inventory.length > 0) {
        this.loadOptimizerInsight(inventory);
      } else {
        this.loadingOptimizer.set(false);
      }
    });
  }

  private applyInventory(items: InventoryItem[]): void {
    this.totalInventory.set(items.reduce((acc, i) => acc + (i.quantity ?? 0), 0));
    this.inventoryChartData.set({
      labels: items.map((i) => i.commodity),
      datasets: [
        {
          data: items.map((i) => i.quantity),
          backgroundColor: ['#8b5cf6', '#a78bfa', '#7c3aed', '#c4b5fd', '#6d28d9', '#ddd6fe', '#5b21b6', '#a855f7', '#9333ea', '#e9d5ff', '#4c1d95', '#c084fc', '#7e22ce', '#f3e8ff'],
        },
      ],
    });
  }

  private loadInventoryValuationAndMovers(items: InventoryItem[], commodities: string[]): void {
    const matched = items.filter((i) => commodities.includes(i.commodity)).slice(0, 15);
    if (matched.length === 0) {
      this.loadingMovers.set(false);
      return;
    }
    const calls = matched.reduce((acc, item) => {
      acc[item.commodity] = this.api.forecast(item.commodity).pipe(catchError(() => of(null)));
      return acc;
    }, {} as Record<string, Observable<ForecastResult | null>>);

    forkJoin(calls).subscribe((results) => {
      let totalValue = 0;
      const rows: { commodity: string; quantity: number; unit: string; estValue: number }[] = [];
      const movers: MoverRow[] = [];
      for (const item of items) {
        const r = results[item.commodity];
        const price = r?.avgPrice ?? 0;
        const value = price * item.quantity;
        totalValue += value;
        rows.push({ commodity: item.commodity, quantity: item.quantity, unit: item.unit, estValue: value });
        if (r && r.avgPrice != null && r.volatility != null) {
          movers.push({ commodity: item.commodity, avgPrice: r.avgPrice, volatility: r.volatility, topMarket: r.topMarket });
        }
      }
      this.inventoryValue.set(totalValue);
      this.inventoryRows.set(rows.sort((a, b) => b.estValue - a.estValue));
      this.moverRows.set(movers.sort((a, b) => b.volatility - a.volatility).slice(0, 5));
      this.loadingMovers.set(false);
    });
  }

  private loadOptimizerInsight(items: InventoryItem[]): void {
    const top = [...items].sort((a, b) => b.quantity - a.quantity)[0];
    if (!top) {
      this.loadingOptimizer.set(false);
      return;
    }
    this.optimizerCommodity.set(top.commodity);
    this.api
      .optimizeRoute(top.commodity, top.quantity)
      .pipe(catchError(() => of(null)))
      .subscribe((recs) => {
        this.optimizerRec.set(recs && recs.length > 0 ? recs[0] : null);
        if (!recs) {
          this.errorOptimizer.set('Could not compute a route recommendation.');
        }
        this.loadingOptimizer.set(false);
      });
  }

  private loadRevenueTrend(): void {
    this.api
      .getSales()
      .pipe(catchError(() => of(null)))
      .subscribe((sales) => {
        if (!sales) {
          this.errorRevenue.set('Could not load sales history.');
          this.loadingRevenue.set(false);
          return;
        }
        this.applyRevenueTrend(sales);
        this.loadingRevenue.set(false);
      });
  }

  private applyRevenueTrend(sales: Sale[]): void {
    const byDay = new Map<string, number>();
    for (const s of sales) {
      if (!s.soldAt) continue;
      const day = s.soldAt.slice(0, 10);
      byDay.set(day, (byDay.get(day) ?? 0) + (s.totalRevenue ?? s.quantity * s.pricePerUnit));
    }
    const days = Array.from(byDay.keys()).sort().slice(-21);
    this.revenueTrendData.set({
      labels: days.map((d) => new Date(d).toLocaleDateString('en-IN', { day: '2-digit', month: 'short' })),
      datasets: [
        {
          data: days.map((d) => Math.round((byDay.get(d) ?? 0) * 100) / 100),
          label: 'Revenue',
          fill: true,
          borderColor: '#059669',
          backgroundColor: 'rgba(5,150,105,0.15)',
          tension: 0.3,
        },
      ],
    });
  }

  private loadShipmentsForMap(): void {
    this.api
      .getShipments()
      .pipe(catchError(() => of(null)))
      .subscribe((shipments) => {
        if (!shipments) {
          this.errorMap.set('Could not load shipment locations.');
          this.loadingMap.set(false);
          return;
        }
        this.pendingShipments = shipments.filter((s) => s.status !== 'DELIVERED');
        this.renderMapMarkers();
        this.loadingMap.set(false);
        setTimeout(() => this.map?.invalidateSize(), 0);
      });
  }

  private initMap(): void {
    const el = document.getElementById('dashboard-mini-map');
    if (!el) {
      return;
    }
    this.map = L.map('dashboard-mini-map', { zoomControl: false, attributionControl: false, dragging: true, scrollWheelZoom: false }).setView([22.9734, 78.6569], 4.3);
    this.map.setMaxBounds([[4, 60], [40, 100]]);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png').addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.renderMapMarkers();
    setTimeout(() => this.map?.invalidateSize(), 0);
  }

  private renderMapMarkers(): void {
    if (!this.markersLayer) {
      return;
    }
    this.markersLayer.clearLayers();
    const truckIcon = L.divIcon({
      className: '',
      html: '<div style="background:#3b82f6;width:10px;height:10px;border-radius:50%;border:2px solid #ffffff;"></div>',
      iconSize: [10, 10],
    });
    for (const s of this.pendingShipments) {
      if (s.currentLat != null && s.currentLon != null) {
        L.marker([s.currentLat, s.currentLon], { icon: truckIcon })
          .bindPopup(`${s.truckId} — ${s.commodity} (${Math.round((s.progress ?? 0) * 100)}%)`)
          .addTo(this.markersLayer);
      }
    }
  }

  private loadHarvestReadiness(): void {
    this.api
      .getPlots('GROWING')
      .pipe(catchError(() => of(null)))
      .subscribe((plots) => {
        if (!plots) {
          this.errorHarvest.set('Could not load farm plots.');
          this.loadingHarvest.set(false);
          return;
        }
        const now = Date.now();
        const rows: HarvestRow[] = plots
          .map((p) => {
            const days = Math.ceil((new Date(p.expectedHarvestDate).getTime() - now) / 86400000);
            return { ...p, daysUntilHarvest: days, dueSoon: days <= 7 };
          })
          .sort((a, b) => a.daysUntilHarvest - b.daysUntilHarvest);
        this.harvestRows.set(rows);
        this.loadingHarvest.set(false);
      });
  }
}
