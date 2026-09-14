import { Component, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import * as QRCode from 'qrcode';
import { ApiService } from '../../core/services/api.service';
import { FinanceSummary, Sale, Shipment } from '../../core/models/api.models';

@Component({
  selector: 'app-finance',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSelectModule, MatTableModule, BaseChartDirective],
  templateUrl: './finance.component.html',
})
export class FinanceComponent implements OnInit {
  readonly arrivedShipments = signal<Shipment[]>([]);
  readonly sales = signal<Sale[]>([]);
  readonly summary = signal<FinanceSummary | null>(null);
  readonly qrDataUrl = signal<string | null>(null);
  readonly submitting = signal(false);
  readonly columns = ['commodity', 'quantity', 'pricePerUnit', 'market'];

  selectedShipment: Shipment | null = null;
  pricePerUnit: number | null = null;

  readonly chartData = signal<ChartData<'bar'>>({ labels: [], datasets: [{ data: [], label: 'Revenue', backgroundColor: '#0d9488' }] });
  readonly chartOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { display: false } },
    scales: {
      x: { ticks: { color: '#475569' }, grid: { color: '#e5e7eb' } },
      y: { ticks: { color: '#475569' }, grid: { color: '#e5e7eb' } },
    },
  };

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadAll();
  }

  loadAll(): void {
    this.api.getShipments().subscribe({
      next: (list) => this.arrivedShipments.set((list ?? []).filter((s) => s.status === 'ARRIVED')),
      error: () => this.arrivedShipments.set([]),
    });
    this.api.getSales().subscribe({
      next: (list) => this.sales.set(list ?? []),
      error: () => this.sales.set([]),
    });
    this.api.getFinanceSummary().subscribe({
      next: (res) => {
        this.summary.set(res);
        this.chartData.set({
          labels: (res?.byCommodity ?? []).map((c) => c.commodity),
          datasets: [{ data: (res?.byCommodity ?? []).map((c) => c.revenue), label: 'Revenue', backgroundColor: '#0d9488' }],
        });
      },
      error: () => this.summary.set(null),
    });
  }

  onShipmentChange(): void {
    this.updateQr();
  }

  onPriceChange(): void {
    this.updateQr();
  }

  private updateQr(): void {
    const shipment = this.selectedShipment;
    const price = this.pricePerUnit;
    if (!shipment || !price) {
      this.qrDataUrl.set(null);
      return;
    }
    const amount = (price * shipment.quantity).toFixed(2);
    const upiUri = `upi://pay?pa=agrichain@upi&pn=AgriChainOS&am=${amount}&cu=INR&tn=${encodeURIComponent(shipment.commodity + ' sale')}`;
    QRCode.toDataURL(upiUri, { margin: 1, width: 200, color: { dark: '#0a0e0d', light: '#ffffff' } })
      .then((url) => this.qrDataUrl.set(url))
      .catch(() => this.qrDataUrl.set(null));
  }

  logSale(): void {
    const shipment = this.selectedShipment;
    if (!shipment || !this.pricePerUnit) {
      this.snackBar.open('Select a shipment and enter a price', 'Dismiss', { duration: 3000 });
      return;
    }
    this.submitting.set(true);
    this.api
      .addSale({
        commodity: shipment.commodity,
        quantity: shipment.quantity,
        pricePerUnit: this.pricePerUnit,
        market: shipment.destinationMarket,
      })
      .subscribe({
        next: () => {
          this.submitting.set(false);
          this.selectedShipment = null;
          this.pricePerUnit = null;
          this.qrDataUrl.set(null);
          this.loadAll();
          this.snackBar.open('Sale logged', 'Dismiss', { duration: 2500 });
        },
        error: () => {
          this.submitting.set(false);
          this.snackBar.open('Failed to log sale', 'Dismiss', { duration: 3000 });
        },
      });
  }
}
