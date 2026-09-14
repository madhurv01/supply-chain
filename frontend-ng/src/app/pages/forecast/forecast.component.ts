import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { ApiService } from '../../core/services/api.service';
import { ForecastResult, HistoryEntry } from '../../core/models/api.models';

@Component({
  selector: 'app-forecast',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatProgressSpinnerModule],
  templateUrl: './forecast.component.html',
})
export class ForecastComponent implements OnInit {
  readonly commodities = signal<string[]>([]);
  readonly history = signal<HistoryEntry[]>([]);
  readonly result = signal<ForecastResult | null>(null);
  readonly loading = signal(false);
  readonly error = signal<string | null>(null);

  commodity = '';
  state = '';

  constructor(private api: ApiService) {}

  ngOnInit(): void {
    this.api.getCommodities().subscribe({
      next: (list) => this.commodities.set(list ?? []),
      error: () => this.commodities.set([]),
    });
    this.loadHistory();
  }

  loadHistory(): void {
    this.api.getHistory('ai_forecast').subscribe({
      next: (list) => this.history.set(list ?? []),
      error: () => this.history.set([]),
    });
  }

  generate(): void {
    if (!this.commodity) {
      return;
    }
    this.loading.set(true);
    this.error.set(null);
    this.api.forecast(this.commodity, this.state || undefined).subscribe({
      next: (res) => {
        this.result.set(res);
        this.loading.set(false);
        this.loadHistory();
      },
      error: () => {
        this.error.set('Could not generate forecast.');
        this.loading.set(false);
      },
    });
  }

  entries(result: ForecastResult): { key: string; value: unknown }[] {
    return Object.entries(result)
      .filter(([k]) => !['narrative', 'summary'].includes(k))
      .map(([key, value]) => ({ key, value }));
  }
}
