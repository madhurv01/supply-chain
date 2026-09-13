def log_sale(client, commodity: str, quantity: float, price_per_unit: float, market: str):
    total_revenue = float(quantity) * float(price_per_unit)
    row = {
        "commodity": commodity,
        "quantity": quantity,
        "price_per_unit": price_per_unit,
        "total_revenue": total_revenue,
        "market": market,
    }
    return client.table("sales").insert(row).execute().data


def get_sales_data(client):
    return client.table("sales").select("*").order("sold_at", desc=True).execute().data


def get_financial_summary(client) -> dict:
    sales = get_sales_data(client)
    if not sales:
        return {"total_revenue": 0, "total_sales": 0, "avg_sale_value": 0}
    total_revenue = sum(float(s["total_revenue"]) for s in sales)
    total_sales = len(sales)
    avg_sale_value = total_revenue / total_sales if total_sales else 0
    return {
        "total_revenue": round(total_revenue, 2),
        "total_sales": total_sales,
        "avg_sale_value": round(avg_sale_value, 2),
    }
