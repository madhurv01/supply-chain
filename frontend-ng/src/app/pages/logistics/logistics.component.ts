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
import 'leaflet.markercluster';
import { ApiService } from '../../core/services/api.service';
import { RouteRecommendation, Shipment } from '../../core/models/api.models';

interface TrackedShipment {
  marker: L.Marker;
  routeLine: L.LayerGroup;
  currentLatLng: L.LatLng;
  animFrame?: number;
  shipment: Shipment;
}

const ANIMATION_MS = 1500;

function bearing(from: L.LatLng, to: L.LatLng): number {
  const lat1 = (from.lat * Math.PI) / 180;
  const lat2 = (to.lat * Math.PI) / 180;
  const dLon = ((to.lng - from.lng) * Math.PI) / 180;
  const y = Math.sin(dLon) * Math.cos(lat2);
  const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLon);
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

function lerpLatLng(a: L.LatLng, b: L.LatLng, t: number): L.LatLng {
  return L.latLng(a.lat + (b.lat - a.lat) * t, a.lng + (b.lng - a.lng) * t);
}

function truckIconHtml(rotationDeg: number, live: boolean): string {
  return `
    <div class="truck-marker ${live ? 'truck-marker--live' : ''}">
      <div class="truck-marker__glow"></div>
      <div class="truck-marker__arrow" style="transform: rotate(${rotationDeg}deg)">🚚</div>
    </div>
  `;
}

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
  private clusterGroup?: L.MarkerClusterGroup;
  private destLayer?: L.LayerGroup;
  private routeLayer?: L.LayerGroup;
  private tracked = new Map<string | number, TrackedShipment>();
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
    for (const t of this.tracked.values()) {
      if (t.animFrame) {
        cancelAnimationFrame(t.animFrame);
      }
    }
    this.map?.remove();
  }

  private initMap(): void {
    this.map = L.map('logistics-map', { zoomControl: true, attributionControl: true }).setView([22.9734, 78.6569], 5);

    const street = L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      attribution: '&copy; OpenStreetMap contributors',
      maxZoom: 19,
    });
    const satellite = L.tileLayer(
      'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}',
      {
        attribution: 'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
        maxZoom: 19,
      },
    );
    const terrain = L.tileLayer('https://{s}.tile.opentopomap.org/{z}/{x}/{y}.png', {
      attribution: 'Map data: &copy; OpenStreetMap contributors, SRTM | Map style: &copy; OpenTopoMap (CC-BY-SA)',
      maxZoom: 17,
    });

    street.addTo(this.map);
    L.control
      .layers(
        { Street: street, Satellite: satellite, Terrain: terrain },
        {},
        { position: 'topright', collapsed: false },
      )
      .addTo(this.map);

    this.clusterGroup = (L as any).markerClusterGroup({
      maxClusterRadius: 45,
      spiderfyOnMaxZoom: true,
      showCoverageOnHover: false,
    });
    this.destLayer = L.layerGroup();
    this.routeLayer = L.layerGroup();
    this.routeLayer.addTo(this.map);
    this.destLayer.addTo(this.map);
    this.clusterGroup!.addTo(this.map);

    this.addLegend();
    this.renderMarkers();
  }

  private addLegend(): void {
    if (!this.map) {
      return;
    }
    const legend = new L.Control({ position: 'bottomleft' });
    legend.onAdd = () => {
      const div = L.DomUtil.create('div', 'map-legend');
      div.innerHTML = `
        <div class="map-legend__title">Legend</div>
        <div class="map-legend__row"><span class="map-legend__dot" style="background:#059669"></span>In transit</div>
        <div class="map-legend__row"><span class="map-legend__dot" style="background:#2563eb"></span>Delivered</div>
        <div class="map-legend__row"><span class="map-legend__square" style="background:#f59e0b"></span>Destination market</div>
        <div class="map-legend__row"><span class="map-legend__line map-legend__line--solid"></span>Traveled</div>
        <div class="map-legend__row"><span class="map-legend__line map-legend__line--dashed"></span>Remaining</div>
      `;
      L.DomEvent.disableClickPropagation(div);
      return div;
    };
    legend.addTo(this.map);
  }

  private statusColor(status: string): string {
    if (status === 'DELIVERED' || status === 'SOLD') {
      return '#2563eb';
    }
    return '#059669';
  }

  private etaLabel(s: Shipment): string {
    if (s.status === 'DELIVERED') {
      return 'Arrived';
    }
    const progress = s.progress ?? 0;
    if (!s.createdAt || progress <= 0.01) {
      return 'Calculating…';
    }
    const elapsedMs = Date.now() - new Date(s.createdAt).getTime();
    if (elapsedMs <= 0) {
      return 'Calculating…';
    }
    const totalMs = elapsedMs / progress;
    const remainingMs = Math.max(0, totalMs - elapsedMs);
    const hours = remainingMs / (1000 * 60 * 60);
    if (hours < 1) {
      return `${Math.round(hours * 60)} min`;
    }
    if (hours < 48) {
      return `${hours.toFixed(1)} h`;
    }
    return `${(hours / 24).toFixed(1)} d`;
  }

  private popupHtml(s: Shipment): string {
    const pct = Math.round((s.progress ?? 0) * 100);
    return `
      <div class="shipment-popup">
        <strong>${s.truckId}</strong> — ${s.commodity}<br/>
        To: ${s.destinationMarket}<br/>
        Progress: ${pct}%<br/>
        ETA: ${this.etaLabel(s)}<br/>
        Status: ${s.status}
      </div>
    `;
  }

  private renderMarkers(): void {
    if (!this.clusterGroup || !this.destLayer || !this.routeLayer) {
      return;
    }
    const list = this.shipments();
    const seenIds = new Set<string | number>();

    for (const s of list) {
      if (s.currentLat == null || s.currentLon == null) {
        continue;
      }
      seenIds.add(s.id);
      const newLatLng = L.latLng(s.currentLat, s.currentLon);
      const existing = this.tracked.get(s.id);

      if (!existing) {
        const rot = s.destinationLat != null && s.destinationLon != null
          ? bearing(newLatLng, L.latLng(s.destinationLat, s.destinationLon))
          : 0;
        const icon = L.divIcon({
          className: '',
          html: truckIconHtml(rot, s.status !== 'DELIVERED'),
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const marker = L.marker(newLatLng, { icon }).bindPopup(this.popupHtml(s));
        this.clusterGroup.addLayer(marker);

        const routeLine = L.layerGroup();
        this.drawRoute(routeLine, s);
        routeLine.addTo(this.routeLayer);

        if (s.destinationLat != null && s.destinationLon != null) {
          const destIcon = L.divIcon({
            className: '',
            html: '<div style="background:#f59e0b;width:12px;height:12px;border-radius:3px;border:2px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });
          L.marker([s.destinationLat, s.destinationLon], { icon: destIcon })
            .bindPopup(`Destination: ${s.destinationMarket}`)
            .addTo(this.destLayer);
        }

        this.tracked.set(s.id, { marker, routeLine, currentLatLng: newLatLng, shipment: s });
      } else {
        existing.shipment = s;
        existing.marker.setPopupContent(this.popupHtml(s));
        existing.routeLine.clearLayers();
        this.drawRoute(existing.routeLine, s);
        this.animateMarker(existing, newLatLng, s);
      }
    }

    for (const [id, t] of Array.from(this.tracked.entries())) {
      if (!seenIds.has(id)) {
        if (t.animFrame) {
          cancelAnimationFrame(t.animFrame);
        }
        this.clusterGroup.removeLayer(t.marker);
        t.routeLine.remove();
        this.tracked.delete(id);
      }
    }
  }

  private drawRoute(group: L.LayerGroup, s: Shipment): void {
    if (s.originLat == null || s.originLon == null || s.destinationLat == null || s.destinationLon == null) {
      return;
    }
    const origin = L.latLng(s.originLat, s.originLon);
    const dest = L.latLng(s.destinationLat, s.destinationLon);
    const progress = Math.min(1, Math.max(0, s.progress ?? 0));
    const mid = lerpLatLng(origin, dest, progress);
    const color = this.statusColor(s.status);

    L.polyline([origin, mid], { color, weight: 3, opacity: 0.85 }).addTo(group);
    L.polyline([mid, dest], { color, weight: 2, opacity: 0.5, dashArray: '6, 8' }).addTo(group);
  }

  private animateMarker(t: TrackedShipment, target: L.LatLng, s: Shipment): void {
    if (t.animFrame) {
      cancelAnimationFrame(t.animFrame);
    }
    const start = t.currentLatLng;
    if (start.equals(target)) {
      return;
    }
    const startTime = performance.now();
    const rot = s.destinationLat != null && s.destinationLon != null ? bearing(start, target) : 0;
    t.marker.setIcon(
      L.divIcon({
        className: '',
        html: truckIconHtml(rot, s.status !== 'DELIVERED'),
        iconSize: [30, 30],
        iconAnchor: [15, 15],
      }),
    );

    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / ANIMATION_MS);
      const pos = lerpLatLng(start, target, progress);
      t.marker.setLatLng(pos);
      if (progress < 1) {
        t.animFrame = requestAnimationFrame(step);
      } else {
        t.currentLatLng = target;
        t.animFrame = undefined;
      }
    };
    t.animFrame = requestAnimationFrame(step);
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
