import { Component, AfterViewInit, OnDestroy, OnInit, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatSnackBar } from '@angular/material/snack-bar';
import * as L from 'leaflet';
import { ApiService } from '../../core/services/api.service';
import { RouteRecommendation, Shipment } from '../../core/models/api.models';

@Component({
  selector: 'app-logistics',
  standalone: true,
  imports: [CommonModule, FormsModule, MatButtonModule, MatFormFieldModule, MatInputModule, MatSlideToggleModule, MatTableModule],
  templateUrl: './logistics.component.html',
})
export class LogisticsComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly shipments = signal<Shipment[]>([]);
  readonly liveMonitoring = signal(false);
  readonly columns = ['truckId', 'commodity', 'quantity', 'destinationMarket', 'status', 'progress', 'actions'];

  truckId = '';
  commodity = '';
  quantity: number | null = null;
  destinationMarket = '';

  readonly optCommodity = signal('');
  readonly optQuantity = signal<number | null>(null);
  readonly recommendations = signal<RouteRecommendation[]>([]);
  readonly optimizing = signal(false);

  private map?: L.Map;
  private markersLayer?: L.LayerGroup;
  private pollHandle?: ReturnType<typeof setInterval>;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadShipments();
  }

  ngAfterViewInit(): void {
    this.initMap();
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
    }
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map('logistics-map', { zoomControl: true }).setView([22.9734, 78.6569], 5);
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(this.map);
    this.markersLayer = L.layerGroup().addTo(this.map);
    this.renderMarkers();
  }

  private renderMarkers(): void {
    if (!this.markersLayer) {
      return;
    }
    this.markersLayer.clearLayers();
    const truckIcon = L.divIcon({
      className: '',
      html: '<div style="background:#4ade80;width:12px;height:12px;border-radius:50%;border:2px solid #0a0e0d;"></div>',
      iconSize: [12, 12],
    });
    const destIcon = L.divIcon({
      className: '',
      html: '<div style="background:#f59e0b;width:10px;height:10px;border-radius:2px;border:2px solid #0a0e0d;"></div>',
      iconSize: [10, 10],
    });
    for (const s of this.shipments()) {
      if (s.currentLat != null && s.currentLon != null) {
        L.marker([s.currentLat, s.currentLon], { icon: truckIcon })
          .bindPopup(`${s.truckId} — ${s.commodity} (${s.progress ?? 0}%)`)
          .addTo(this.markersLayer);
      }
      if (s.destinationLat != null && s.destinationLon != null) {
        L.marker([s.destinationLat, s.destinationLon], { icon: destIcon })
          .bindPopup(`Destination: ${s.destinationMarket}`)
          .addTo(this.markersLayer);
      }
    }
  }

  loadShipments(): void {
    this.api.getShipments().subscribe({
      next: (list) => {
        this.shipments.set(list ?? []);
        this.renderMarkers();
      },
      error: () => this.shipments.set([]),
    });
  }

  toggleLiveMonitoring(): void {
    this.liveMonitoring.update((v) => !v);
    if (this.liveMonitoring()) {
      this.pollHandle = setInterval(() => {
        this.api.advanceShipments().subscribe({
          next: () => this.loadShipments(),
          error: () => this.loadShipments(),
        });
      }, 8000);
    } else if (this.pollHandle) {
      clearInterval(this.pollHandle);
      this.pollHandle = undefined;
    }
  }

  dispatch(): void {
    if (!this.truckId || !this.commodity || !this.quantity || !this.destinationMarket) {
      this.snackBar.open('Fill all dispatch fields', 'Dismiss', { duration: 3000 });
      return;
    }
    this.api
      .dispatchShipment({
        truckId: this.truckId,
        commodity: this.commodity,
        quantity: this.quantity,
        destinationMarket: this.destinationMarket,
      })
      .subscribe({
        next: () => {
          this.snackBar.open('Shipment dispatched', 'Dismiss', { duration: 2500 });
          this.truckId = '';
          this.commodity = '';
          this.quantity = null;
          this.destinationMarket = '';
          this.loadShipments();
        },
        error: () => this.snackBar.open('Failed to dispatch shipment', 'Dismiss', { duration: 3000 }),
      });
  }

  deliver(shipment: Shipment): void {
    this.api.deliverShipment(shipment.id).subscribe({
      next: () => {
        this.snackBar.open('Shipment marked delivered', 'Dismiss', { duration: 2500 });
        this.loadShipments();
      },
      error: () => this.snackBar.open('Failed to update shipment', 'Dismiss', { duration: 3000 }),
    });
  }

  runOptimizer(): void {
    const commodity = this.optCommodity();
    const quantity = this.optQuantity();
    if (!commodity || !quantity) {
      this.snackBar.open('Enter commodity and quantity', 'Dismiss', { duration: 3000 });
      return;
    }
    this.optimizing.set(true);
    this.api.optimizeRoute(commodity, quantity).subscribe({
      next: (recs) => {
        this.recommendations.set(recs ?? []);
        this.optimizing.set(false);
      },
      error: () => {
        this.recommendations.set([]);
        this.optimizing.set(false);
        this.snackBar.open('Could not compute route recommendations', 'Dismiss', { duration: 3000 });
      },
    });
  }

  dispatchToMarket(rec: RouteRecommendation): void {
    this.destinationMarket = rec.market;
    this.commodity = this.optCommodity();
    this.quantity = this.optQuantity();
    document.getElementById('dispatch-form')?.scrollIntoView({ behavior: 'smooth' });
  }
}
