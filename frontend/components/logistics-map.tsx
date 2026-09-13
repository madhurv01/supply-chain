"use client";

import { Fragment } from "react";
import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { Shipment } from "@/lib/api";

const truckIcon = L.divIcon({
  html: `<div style="font-size:22px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">🚚</div>`,
  className: "",
  iconSize: [24, 24],
  iconAnchor: [12, 12],
});

const flagIcon = L.divIcon({
  html: `<div style="font-size:20px;line-height:1;filter:drop-shadow(0 1px 2px rgba(0,0,0,.5))">🚩</div>`,
  className: "",
  iconSize: [20, 20],
  iconAnchor: [4, 20],
});

const INDIA_CENTER: [number, number] = [22.9734, 78.6569];

export default function LogisticsMap({ shipments }: { shipments: Shipment[] }) {
  return (
    <MapContainer
      center={INDIA_CENTER}
      zoom={5}
      scrollWheelZoom
      style={{ height: "100%", width: "100%", borderRadius: "0.75rem" }}
    >
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      {shipments.map((s) => (
        <Fragment key={s.id}>
          {s.current_lat != null && s.current_lon != null && (
            <Marker position={[s.current_lat, s.current_lon]} icon={truckIcon}>
              <Popup>
                <div className="text-sm">
                  <p className="font-medium">{s.truck_id}</p>
                  <p>{s.commodity} · {s.quantity}kg</p>
                  <p>To: {s.destination_market}</p>
                  <p>Progress: {Math.round((s.progress ?? 0) * 100)}%</p>
                  <p>Status: {s.status}</p>
                </div>
              </Popup>
            </Marker>
          )}
          {s.destination_lat != null && s.destination_lon != null && (
            <Marker position={[s.destination_lat, s.destination_lon]} icon={flagIcon}>
              <Popup>
                <div className="text-sm">
                  <p className="font-medium">{s.destination_market}</p>
                  <p>Destination</p>
                </div>
              </Popup>
            </Marker>
          )}
        </Fragment>
      ))}
    </MapContainer>
  );
}
