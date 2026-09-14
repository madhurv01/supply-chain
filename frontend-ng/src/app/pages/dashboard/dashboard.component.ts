import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { forkJoin } from 'rxjs';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { ApiService } from '../../core/services/api.service';
import { InventoryItem, Shipment } from '../../core/models/api.models';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, BaseChartDirective],
  templateUrl: './dashboard.component.html',
})
export class DashboardComponent implements OnInit {
  readonly loading = signal(true);
  readonly error = signal<string | null>(null);

  readonly totalInventory = signal(0);
  readonly activeShipments = signal(0);
  readonly totalRevenue = signal(0);
  readonly growingPlots = signal(0);

  readonly inventoryChartData = signal<ChartData<'doughnut'>>({ labels: [], datasets: [{ data: [] }] });
  readonly revenueChartData = signal<ChartData<'bar'>>({ labels: [], datasets: [{ data: [], label: 'Revenue' }] });

  readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#cbd5e1' } } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: '#1f2a24' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: '#1f2a24' } },
    },
  };

  readonly doughnutOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { labels: { color: '#cbd5e1' } } },
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    forkJoin({
      inventory: this.api.getInventory(),
      shipments: this.api.getShipments(),
      summary: this.api.getFinanceSummary(),
      plots: this.api.getPlots('GROWING'),
    }).subscribe({
      next: ({ inventory, shipments, summary, plots }) => {
        this.applyInventory(inventory ?? []);
        this.applyShipments(shipments ?? []);
        this.totalRevenue.set(summary?.totalRevenue ?? 0);
        this.revenueChartData.set({
          labels: (summary?.byCommodity ?? []).map((c) => c.commodity),
          datasets: [{ data: (summary?.byCommodity ?? []).map((c) => c.revenue), label: 'Revenue', backgroundColor: '#4ade80' }],
        });
        this.growingPlots.set((plots ?? []).length);
        this.loading.set(false);
      },
      error: () => {
        this.error.set('Could not reach the backend. Showing empty state.');
        this.loading.set(false);
      },
    });
  }

  private applyInventory(items: InventoryItem[]): void {
    this.totalInventory.set(items.reduce((acc, i) => acc + (i.quantity ?? 0), 0));
    this.inventoryChartData.set({
      labels: items.map((i) => i.commodity),
      datasets: [
        {
          data: items.map((i) => i.quantity),
          backgroundColor: ['#4ade80', '#a3e635', '#10b981', '#34d399', '#65a30d', '#22c55e'],
        },
      ],
    });
  }

  private applyShipments(shipments: Shipment[]): void {
    this.activeShipments.set(shipments.filter((s) => s.status !== 'DELIVERED').length);
  }
}
