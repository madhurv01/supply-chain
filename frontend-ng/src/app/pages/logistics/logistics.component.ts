import { Component, AfterViewInit, OnDestroy, OnInit, computed, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatTableModule } from '@angular/material/table';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatSnackBar } from '@angular/material/snack-bar';
import { BaseChartDirective } from 'ng2-charts';
import { ChartConfiguration, ChartData } from 'chart.js';
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
  section: 'active' | 'completed';
}

interface DestMarker {
  marker: L.Marker;
  section: 'active' | 'completed';
}

const ANIMATION_MS = 1500;
const INDIA_BOUNDS: L.LatLngBoundsExpression = [
  [4, 60],
  [40, 100],
];

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

@Component({
  selector: 'app-logistics',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSlideToggleModule,
    MatTableModule,
    MatExpansionModule,
    BaseChartDirective,
  ],
  templateUrl: './logistics.component.html',
})
export class LogisticsComponent implements OnInit, AfterViewInit, OnDestroy {
  readonly shipments = signal<Shipment[]>([]);
  readonly liveMonitoring = signal(false);
  readonly columns = ['truckId', 'commodity', 'quantity', 'destinationMarket', 'status', 'progress', 'actions'];

  readonly activePanelOpen = signal(true);
  readonly completedPanelOpen = signal(false);

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

  private map?: L.Map;
  private activeCluster?: L.MarkerClusterGroup;
  private completedCluster?: L.MarkerClusterGroup;
  private activeDestLayer?: L.LayerGroup;
  private completedDestLayer?: L.LayerGroup;
  private activeRouteLayer?: L.LayerGroup;
  private completedRouteLayer?: L.LayerGroup;
  private tracked = new Map<string | number, TrackedShipment>();
  private destMarkers = new Map<string | number, DestMarker>();
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
    this.map = L.map('logistics-map', { zoomControl: true, attributionControl: true, minZoom: 4 }).setView([22.4, 80], 5);
    this.map.setMaxBounds(INDIA_BOUNDS);
    (this.map as any).options.maxBoundsViscosity = 1.0;

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

    this.activeCluster = (L as any).markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true, showCoverageOnHover: false });
    this.completedCluster = (L as any).markerClusterGroup({ maxClusterRadius: 40, spiderfyOnMaxZoom: true, showCoverageOnHover: false });
    this.activeDestLayer = L.layerGroup();
    this.completedDestLayer = L.layerGroup();
    this.activeRouteLayer = L.layerGroup();
    this.completedRouteLayer = L.layerGroup();

    if (this.activePanelOpen()) {
      this.activeRouteLayer.addTo(this.map);
      this.activeDestLayer.addTo(this.map);
      this.activeCluster!.addTo(this.map);
    }
    if (this.completedPanelOpen()) {
      this.completedRouteLayer.addTo(this.map);
      this.completedDestLayer.addTo(this.map);
      this.completedCluster!.addTo(this.map);
    }

    this.addLegend();
    this.renderMarkers();
  }

  toggleActivePanel(opened: boolean): void {
    this.activePanelOpen.set(opened);
    if (!this.map || !this.activeCluster || !this.activeDestLayer || !this.activeRouteLayer) {
      return;
    }
    if (opened) {
      this.activeRouteLayer.addTo(this.map);
      this.activeDestLayer.addTo(this.map);
      this.activeCluster.addTo(this.map);
    } else {
      this.map.removeLayer(this.activeRouteLayer);
      this.map.removeLayer(this.activeDestLayer);
      this.map.removeLayer(this.activeCluster);
    }
  }

  toggleCompletedPanel(opened: boolean): void {
    this.completedPanelOpen.set(opened);
    if (!this.map || !this.completedCluster || !this.completedDestLayer || !this.completedRouteLayer) {
      return;
    }
    if (opened) {
      this.completedRouteLayer.addTo(this.map);
      this.completedDestLayer.addTo(this.map);
      this.completedCluster.addTo(this.map);
    } else {
      this.map.removeLayer(this.completedRouteLayer);
      this.map.removeLayer(this.completedDestLayer);
      this.map.removeLayer(this.completedCluster);
    }
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
        <div class="map-legend__row"><span class="map-legend__dot" style="background:#2563eb"></span>Completed</div>
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
    return shipmentSection(status) === 'completed' ? '#2563eb' : '#059669';
  }

  private clusterFor(section: 'active' | 'completed'): L.MarkerClusterGroup {
    return section === 'active' ? this.activeCluster! : this.completedCluster!;
  }

  private routeLayerFor(section: 'active' | 'completed'): L.LayerGroup {
    return section === 'active' ? this.activeRouteLayer! : this.completedRouteLayer!;
  }

  private destLayerFor(section: 'active' | 'completed'): L.LayerGroup {
    return section === 'active' ? this.activeDestLayer! : this.completedDestLayer!;
  }

  private etaLabel(s: Shipment): string {
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
    if (!this.activeCluster || !this.completedCluster || !this.activeDestLayer || !this.completedDestLayer || !this.activeRouteLayer || !this.completedRouteLayer) {
      return;
    }
    const list = this.shipments();
    const seenIds = new Set<string | number>();

    for (const s of list) {
      if (s.currentLat == null || s.currentLon == null) {
        continue;
      }
      seenIds.add(s.id);
      const section = shipmentSection(s.status);
      const newLatLng = L.latLng(s.currentLat, s.currentLon);
      const existing = this.tracked.get(s.id);

      if (!existing) {
        const rot = s.destinationLat != null && s.destinationLon != null
          ? bearing(newLatLng, L.latLng(s.destinationLat, s.destinationLon))
          : 0;
        const icon = L.divIcon({
          className: '',
          html: truckIconHtml(rot, section === 'active'),
          iconSize: [30, 30],
          iconAnchor: [15, 15],
        });
        const marker = L.marker(newLatLng, { icon }).bindPopup(this.popupHtml(s));
        this.clusterFor(section).addLayer(marker);

        const routeLine = L.layerGroup();
        this.drawRoute(routeLine, s);
        routeLine.addTo(this.routeLayerFor(section));

        if (s.destinationLat != null && s.destinationLon != null) {
          const destIcon = L.divIcon({
            className: '',
            html: '<div style="background:#f59e0b;width:12px;height:12px;border-radius:3px;border:2px solid #ffffff;box-shadow:0 0 0 1px rgba(0,0,0,0.15);"></div>',
            iconSize: [12, 12],
            iconAnchor: [6, 6],
          });
          const destMarker = L.marker([s.destinationLat, s.destinationLon], { icon: destIcon }).bindPopup(`Destination: ${s.destinationMarket}`);
          destMarker.addTo(this.destLayerFor(section));
          this.destMarkers.set(s.id, { marker: destMarker, section });
        }

        this.tracked.set(s.id, { marker, routeLine, currentLatLng: newLatLng, shipment: s, section });
      } else {
        if (existing.section !== section) {
          this.clusterFor(existing.section).removeLayer(existing.marker);
          this.clusterFor(section).addLayer(existing.marker);
          this.routeLayerFor(existing.section).removeLayer(existing.routeLine);
          existing.routeLine.addTo(this.routeLayerFor(section));
          const destEntry = this.destMarkers.get(s.id);
          if (destEntry) {
            this.destLayerFor(destEntry.section).removeLayer(destEntry.marker);
            destEntry.marker.addTo(this.destLayerFor(section));
            destEntry.section = section;
          }
          existing.section = section;
        }
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
        this.clusterFor(t.section).removeLayer(t.marker);
        t.routeLine.remove();
        this.tracked.delete(id);
        const destEntry = this.destMarkers.get(id);
        if (destEntry) {
          this.destLayerFor(destEntry.section).removeLayer(destEntry.marker);
          this.destMarkers.delete(id);
        }
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
        html: truckIconHtml(rot, t.section === 'active'),
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
