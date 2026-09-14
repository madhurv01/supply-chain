import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatButtonToggleModule } from '@angular/material/button-toggle';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import { ApiService } from '../../core/services/api.service';
import { AnalysisResult, HistoryEntry } from '../../core/models/api.models';

type Mode = 'best_market_for_commodity' | 'best_commodity_for_market';

@Component({
  selector: 'app-market',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatSelectModule, MatButtonToggleModule, BaseChartDirective],
  templateUrl: './market.component.html',
})
export class MarketComponent implements OnInit {
  readonly commodities = signal<string[]>([]);
  readonly markets = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);
  readonly result = signal<AnalysisResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  mode: Mode = 'best_market_for_commodity';
  value = '';

  readonly chartData = signal<ChartData<'bar'>>({ labels: [], datasets: [{ data: [], label: 'Value', backgroundColor: '#4ade80' }] });
  readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#94a3b8' }, grid: { color: '#1f2a24' } },
      y: { ticks: { color: '#94a3b8' }, grid: { color: '#1f2a24' } },
    },
  };

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getCommodities().subscribe({ next: (l) => this.commodities.set(l ?? []), error: () => this.commodities.set([]) });
    this.api.getMarkets().subscribe({ next: (l) => this.markets.set(l ?? []), error: () => this.markets.set([]) });
    this.loadHistory();
  }

  loadHistory(): void {
    this.api.getHistory('market_analysis').subscribe({
      next: (list) => this.history.set(list ?? []),
      error: () => this.history.set([]),
    });
  }

  get options(): string[] {
    return this.mode === 'best_market_for_commodity' ? this.commodities() : this.markets();
  }

  onModeChange(): void {
    this.value = '';
  }

  analyze(): void {
    if (!this.value) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.analyze(this.mode, this.value).subscribe({
      next: (res) => {
        this.result.set(res);
        this.chartData.set({
          labels: (res?.chartData ?? []).map((d) => d.label),
          datasets: [{ data: (res?.chartData ?? []).map((d) => d.value), label: 'Value', backgroundColor: '#4ade80' }],
        });
        this.loading.set(false);
        this.loadHistory();
      },
      error: () => {
        this.error.set('Could not run analysis.');
        this.loading.set(false);
      },
    });
  }
}
