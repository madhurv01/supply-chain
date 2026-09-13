from datetime import date


def add_farm_plot(client, commodity: str, plot_id: str, quantity: float, date_planted, expected_harvest_date):
    row = {
        "commodity": commodity,
        "plot_id": plot_id,
        "quantity_planted": quantity,
        "date_planted": date_planted.isoformat() if isinstance(date_planted, date) else str(date_planted),
        "expected_harvest_date": expected_harvest_date.isoformat()
        if isinstance(expected_harvest_date, date)
        else str(expected_harvest_date),
        "status": "GROWING",
    }
    return client.table("farm_plots").insert(row).execute().data


def get_farm_plots(client, status: str | None = None):
    query = client.table("farm_plots").select("*")
    if status:
        query = query.eq("status", status)
    return query.order("created_at", desc=True).execute().data


def harvest_plot(client, plot_row_id: int, commodity: str, quantity: float):
    client.table("farm_plots").update({"status": "HARVESTED"}).eq("id", plot_row_id).execute()

    existing = client.table("inventory").select("*").eq("commodity", commodity).execute().data
    if existing:
        new_qty = float(existing[0]["quantity"]) + float(quantity)
        client.table("inventory").update({"quantity": new_qty}).eq("commodity", commodity).execute()
    else:
        client.table("inventory").insert(
            {"commodity": commodity, "quantity": quantity, "unit": "KG"}
        ).execute()
    return {"success": True}
