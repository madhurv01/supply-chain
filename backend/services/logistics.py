import hashlib

WAREHOUSE_LAT, WAREHOUSE_LON = 21.1458, 79.0882  # Nagpur, roughly central India


def _market_to_latlon(market_name: str):
    """Deterministically map a market name to a plausible lat/lon within India's bounding box."""
    digest = hashlib.md5(market_name.encode("utf-8")).hexdigest()
    frac_lat = int(digest[:8], 16) / 0xFFFFFFFF
    frac_lon = int(digest[8:16], 16) / 0xFFFFFFFF
    lat = 8.0 + frac_lat * (35.0 - 8.0)
    lon = 68.0 + frac_lon * (97.0 - 68.0)
    return lat, lon


def create_shipment(client, truck_id: str, commodity: str, quantity: float, destination_market: str):
    dest_lat, dest_lon = _market_to_latlon(destination_market)

    existing = client.table("inventory").select("*").eq("commodity", commodity).execute().data
    if not existing or float(existing[0]["quantity"]) < float(quantity):
        return {"success": False, "message": "Insufficient inventory for this commodity."}

    new_qty = float(existing[0]["quantity"]) - float(quantity)
    client.table("inventory").update({"quantity": new_qty}).eq("commodity", commodity).execute()

    row = {
        "truck_id": truck_id,
        "commodity": commodity,
        "quantity": quantity,
        "destination_market": destination_market,
        "origin_lat": WAREHOUSE_LAT,
        "origin_lon": WAREHOUSE_LON,
        "destination_lat": dest_lat,
        "destination_lon": dest_lon,
        "current_lat": WAREHOUSE_LAT,
        "current_lon": WAREHOUSE_LON,
        "progress": 0,
        "status": "IN_TRANSIT",
    }
    data = client.table("shipments").insert(row).execute().data
    return {"success": True, "shipment": data[0] if data else row}


def get_active_shipments(client):
    return (
        client.table("shipments")
        .select("*")
        .in_("status", ["IN_TRANSIT", "ARRIVED"])
        .order("created_at", desc=True)
        .execute()
        .data
    )


def update_all_shipment_locations(client, step_progress: float = 0.02):
    rows = client.table("shipments").select("*").eq("status", "IN_TRANSIT").execute().data
    for row in rows:
        new_progress = min(1.0, row["progress"] + step_progress)
        new_lat = row["origin_lat"] + (row["destination_lat"] - row["origin_lat"]) * new_progress
        new_lon = row["origin_lon"] + (row["destination_lon"] - row["origin_lon"]) * new_progress
        new_status = "ARRIVED" if new_progress >= 1.0 else "IN_TRANSIT"
        client.table("shipments").update(
            {
                "progress": new_progress,
                "current_lat": new_lat,
                "current_lon": new_lon,
                "status": new_status,
            }
        ).eq("id", row["id"]).execute()
    return {"updated": len(rows)}


def deliver_shipment(client, shipment_id: int):
    client.table("shipments").update({"status": "SOLD"}).eq("id", shipment_id).execute()
    return {"success": True}
