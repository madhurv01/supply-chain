import { Component, AfterViewInit, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
import * as L from 'leaflet';
import 'leaflet.markercluster';
import { ApiService } from '../../core/services/api.service';
import { RouteRecommendation, Shipment } from '../../core/models/api.models';

interface FocusedTrack {
  id: string | number;
  map: L.Map;
  marker: L.Marker;
  routeLine: L.LayerGroup;
  currentLatLng: L.LatLng;
  animFrame?: number;
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

function shipmentSection(status: string): 'active' | 'completed' {
  // /logistics/shipments only ever returns IN_TRANSIT/ARRIVED (SOLD shipments
  // are excluded server-side once sold), so ARRIVED is the real "completed the
  // journey, awaiting sale" state here, not SOLD.
  return status === 'ARRIVED' || status === 'SOLD' ? 'completed' : 'active';
}

function addBaseLayers(map: L.Map): void {
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
  street.addTo(map);
  L.control
    .layers({ Street: street, Satellite: satellite, Terrain: terrain }, {}, { position: 'topright', collapsed: true })
    .addTo(map);
}

@Component({
  selector: 'app-logistics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatSlideToggleModule,
    MatExpansionModule,
    BaseChartDirective,
  ],
  templateUrl: './logistics.component.html',
})
export class LogisticsComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly shipments = signal<Shipment[]>([]);
  readonly liveMonitoring = signal(false);

  readonly activePanelOpen = signal(true);
  readonly completedPanelOpen = signal(false);
  readonly expandedShipmentId = signal<string | number | null>(null);

  readonly activeShipments = computed(() => this.shipments().filter((s) => shipmentSection(s.status) === 'active'));
  readonly completedShipments = computed(() => this.shipments().filter((s) => shipmentSection(s.status) === 'completed'));

  readonly activeQuantity = computed(() => this.activeShipments().reduce((acc, s) => acc + (s.quantity ?? 0), 0));
  readonly completedQuantity = computed(() => this.completedShipments().reduce((acc, s) => acc + (s.quantity ?? 0), 0));
  readonly activeAvgProgress = computed(() => {
    const list = this.activeShipments();
    if (list.length === 0) return 0;
    return list.reduce((acc, s) => acc + (s.progress ?? 0), 0) / list.length;
  });
  readonly completedAvgAge = computed(() => {
    const list = this.completedShipments().filter((s) => !!s.createdAt);
    if (list.length === 0) return 0;
    const totalHours = list.reduce((acc, s) => acc + (Date.now() - new Date(s.createdAt!).getTime()) / 3.6e6, 0);
    return totalHours / list.length;
  });

  // Analysis strip
  readonly fleetBreakdown = computed(() => {
    const list = this.shipments();
    return {
      inTransit: list.filter((s) => s.status === 'IN_TRANSIT').length,
      arrived: list.filter((s) => s.status === 'ARRIVED').length,
      sold: list.filter((s) => s.status === 'SOLD').length,
    };
  });

  readonly topDestinations = computed(() => {
    const totals = new Map<string, { quantity: number; count: number }>();
    for (const s of this.shipments()) {
      const cur = totals.get(s.destinationMarket) ?? { quantity: 0, count: 0 };
      cur.quantity += s.quantity ?? 0;
      cur.count += 1;
      totals.set(s.destinationMarket, cur);
    }
    return Array.from(totals.entries())
      .map(([market, v]) => ({ market, ...v }))
      .sort((a, b) => b.quantity - a.quantity)
      .slice(0, 5);
  });

  readonly maxDestinationQuantity = computed(() => this.topDestinations().reduce((m, d) => Math.max(m, d.quantity), 0) || 1);

  readonly atRiskShipments = computed(() =>
    this.activeShipments().filter((s) => {
      if (!s.createdAt) return false;
      const hoursSinceDispatch = (Date.now() - new Date(s.createdAt).getTime()) / 3.6e6;
      return hoursSinceDispatch > 48 && (s.progress ?? 0) < 0.4;
    }),
  );

  readonly commodityChartData = computed<ChartData<'doughnut'>>(() => {
    const totals = new Map<string, number>();
    for (const s of this.activeShipments()) {
      totals.set(s.commodity, (totals.get(s.commodity) ?? 0) + (s.quantity ?? 0));
    }
    const entries = Array.from(totals.entries()).sort((a, b) => b[1] - a[1]);
    return {
      labels: entries.map(([c]) => c),
      datasets: [
        {
          data: entries.map(([, q]) => q),
          backgroundColor: ['#059669', '#0d9488', '#10b981', '#34d399', '#2dd4bf', '#5eead4', '#6ee7b7', '#99f6e4'],
        },
      ],
    };
  });

  readonly doughnutOptions: ChartConfiguration['options'] = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: { legend: { position: 'right', labels: { color: '#334155', boxWidth: 10, font: { size: 10 } } } },
  };

  truckId = '';
  commodity = '';
  quantity: number | null = null;
  destinationMarket = '';

  readonly optCommodity = signal('');
  readonly optQuantity = signal<number | null>(null);
  readonly recommendations = signal<RouteRecommendation[]>([]);
  readonly optimizing = signal(false);

  private overviewMap?: L.Map;
  private overviewCluster?: L.MarkerClusterGroup;
  private focused?: FocusedTrack;
  private pollHandle?: ReturnType<typeof setInterval>;

  constructor(private api: ApiService, private snackBar: MatSnackBar) {}

  ngOnInit(): void {
    this.loadShipments();
  }

  ngAfterViewInit(): void {
    this.initOverviewMap();
  }

  ngOnDestroy(): void {
    if (this.pollHandle) {
      clearInterval(this.pollHandle);
    }
    this.collapseFocused();
    this.overviewMap?.remove();
  }

  private initOverviewMap(): void {
    this.overviewMap = L.map('logistics-overview-map', { zoomControl: true, attributionControl: true, minZoom: 4 }).setView([22.5, 80], 4.6);
    this.overviewMap.setMaxBounds([[4, 60], [40, 100]]);
    (this.overviewMap as any).options.maxBoundsViscosity = 1.0;
    addBaseLayers(this.overviewMap);
    this.overviewCluster = (L as any).markerClusterGroup({ maxClusterRadius: 50, spiderfyOnMaxZoom: true, showCoverageOnHover: false });
    this.overviewCluster!.addTo(this.overviewMap);
    this.renderOverviewMarkers();
    setTimeout(() => this.overviewMap?.invalidateSize(), 0);
  }

  private renderOverviewMarkers(): void {
    if (!this.overviewCluster) {
      return;
    }
    this.overviewCluster.clearLayers();
    for (const s of this.shipments()) {
      if (s.destinationLat == null || s.destinationLon == null) {
        continue;
      }
      const color = this.statusColor(s.status);
      const icon = L.divIcon({
        className: '',
        html: `<div style="background:${color};width:12px;height:12px;border-radius:3px;border:2px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></div>`,
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      const marker = L.marker([s.destinationLat, s.destinationLon], { icon }).bindPopup(this.popupHtml(s));
      this.overviewCluster.addLayer(marker);
    }
  }

  private statusColor(status: string): string {
    return shipmentSection(status) === 'completed' ? '#2563eb' : '#059669';
  }

  etaLabel(s: Shipment): string {
    if (s.status === 'SOLD' || s.status === 'ARRIVED') {
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

  trackingStage(s: Shipment): 'dispatched' | 'transit' | 'arrived' {
    if (s.status === 'ARRIVED' || s.status === 'SOLD') {
      return 'arrived';
    }
    return (s.progress ?? 0) > 0.01 ? 'transit' : 'dispatched';
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

  toggleShipmentExpand(s: Shipment): void {
    const alreadyOpen = this.expandedShipmentId() === s.id;
    this.collapseFocused();
    if (alreadyOpen) {
      return;
    }
    this.expandedShipmentId.set(s.id);
    setTimeout(() => this.initFocusedMap(s), 320);
  }

  private collapseFocused(): void {
    if (this.focused) {
      if (this.focused.animFrame) {
        cancelAnimationFrame(this.focused.animFrame);
      }
      this.focused.map.remove();
      this.focused = undefined;
    }
    this.expandedShipmentId.set(null);
  }

  private initFocusedMap(s: Shipment): void {
    const elId = `shipment-map-${s.id}`;
    if (!document.getElementById(elId)) {
      return;
    }
    const map = L.map(elId, { zoomControl: true, attributionControl: false, scrollWheelZoom: false });
    addBaseLayers(map);

    const routeLine = L.layerGroup().addTo(map);
    this.drawRoute(routeLine, s);

    const bounds: L.LatLngTuple[] = [];
    if (s.originLat != null && s.originLon != null) {
      bounds.push([s.originLat, s.originLon]);
      const originIcon = L.divIcon({
        className: '',
        html: '<div style="background:#64748b;width:10px;height:10px;border-radius:50%;border:2px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></div>',
        iconSize: [10, 10],
        iconAnchor: [5, 5],
      });
      L.marker([s.originLat, s.originLon], { icon: originIcon }).bindPopup('Origin').addTo(map);
    }
    if (s.destinationLat != null && s.destinationLon != null) {
      bounds.push([s.destinationLat, s.destinationLon]);
      const destIcon = L.divIcon({
        className: '',
        html: '<div style="background:#f59e0b;width:12px;height:12px;border-radius:3px;border:2px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></div>',
        iconSize: [12, 12],
        iconAnchor: [6, 6],
      });
      L.marker([s.destinationLat, s.destinationLon], { icon: destIcon }).bindPopup(`Destination: ${s.destinationMarket}`).addTo(map);
    }

    const currentLatLng =
      s.currentLat != null && s.currentLon != null
        ? L.latLng(s.currentLat, s.currentLon)
        : bounds.length > 0
          ? L.latLng(bounds[0][0], bounds[0][1])
          : L.latLng(20, 60);
    const rot =
      s.destinationLat != null && s.destinationLon != null ? bearing(currentLatLng, L.latLng(s.destinationLat, s.destinationLon)) : 0;
    const marker = L.marker(currentLatLng, {
      icon: L.divIcon({ className: '', html: truckIconHtml(rot, s.status === 'IN_TRANSIT'), iconSize: [30, 30], iconAnchor: [15, 15] }),
    }).addTo(map);

    if (bounds.length === 2) {
      map.fitBounds(L.latLngBounds(bounds), { padding: [30, 30], maxZoom: 12 });
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 6);
    } else {
      map.setView([20, 60], 4);
    }

    this.focused = { id: s.id, map, marker, routeLine, currentLatLng };
    setTimeout(() => map.invalidateSize(), 50);
  }

  private updateFocusedMap(): void {
    if (!this.focused) {
      return;
    }
    const s = this.shipments().find((x) => x.id === this.focused!.id);
    if (!s) {
      this.collapseFocused();
      return;
    }
    this.focused.routeLine.clearLayers();
    this.drawRoute(this.focused.routeLine, s);
    if (s.currentLat != null && s.currentLon != null) {
      this.animateFocusedMarker(L.latLng(s.currentLat, s.currentLon), s);
    }
  }

  private animateFocusedMarker(target: L.LatLng, s: Shipment): void {
    const f = this.focused;
    if (!f) {
      return;
    }
    if (f.animFrame) {
      cancelAnimationFrame(f.animFrame);
    }
    const start = f.currentLatLng;
    if (start.equals(target)) {
      return;
    }
    const startTime = performance.now();
    const rot = s.destinationLat != null && s.destinationLon != null ? bearing(start, target) : 0;
    f.marker.setIcon(
      L.divIcon({ className: '', html: truckIconHtml(rot, s.status === 'IN_TRANSIT'), iconSize: [30, 30], iconAnchor: [15, 15] }),
    );
    const step = (now: number) => {
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / ANIMATION_MS);
      const pos = lerpLatLng(start, target, progress);
      f.marker.setLatLng(pos);
      if (progress < 1) {
        f.animFrame = requestAnimationFrame(step);
      } else {
        f.currentLatLng = target;
        f.animFrame = undefined;
      }
    };
    f.animFrame = requestAnimationFrame(step);
  }

  loadShipments(): void {
    this.api.getShipments().subscribe({
      next: (list) => {
        this.shipments.set(list ?? []);
        this.renderOverviewMarkers();
        this.updateFocusedMap();
      },
      error: () => this.shipments.set([]),
    });
  }

  toggleLiveMonitoring(): void {
    this.liveMonitoring.update((v) => !v);
    if (this.liveMonitoring()) {
      // Shipment progress is now computed server-side from real elapsed time on every
      // fetch, so live monitoring just needs to re-poll for the latest positions -
      // no separate "advance" call needed to make anything move.
      this.pollHandle = setInterval(() => this.loadShipments(), 5000);
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
