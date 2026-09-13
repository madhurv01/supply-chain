from collections import defaultdict


def _fetch_rows(client, commodity=None, state=None, market=None):
    query = client.table("market_prices").select("*")
    if commodity:
        query = query.ilike("commodity", f"%{commodity}%")
    if state and state != "All":
        query = query.ilike("state", f"%{state}%")
    if market and market != "All":
        query = query.ilike("market", f"%{market}%")
    return query.execute().data


def get_price_forecast_stats(client, commodity: str, state: str = "All", market: str = "All") -> dict:
    rows = _fetch_rows(client, commodity=commodity, state=state, market=market)
    if not rows:
        return {"found": False, "message": f"No data found for '{commodity}' in the specified region."}

    prices = [float(r["modal_price"]) for r in rows if r.get("modal_price") is not None]
    if not prices:
        return {"found": False, "message": f"No price data found for '{commodity}'."}

    avg_price = sum(prices) / len(prices)
    variance = sum((p - avg_price) ** 2 for p in prices) / len(prices)
    std_dev = variance ** 0.5
    volatility = (std_dev / avg_price) * 100 if avg_price > 0 else 0

    best_row = max(rows, key=lambda r: r.get("modal_price") or 0)
    best_market = f"{best_row['market']}, {best_row['state']}"
    best_price = float(best_row["modal_price"])
    demand_indicator = len({r["market"] for r in rows})

    return {
        "found": True,
        "commodity": commodity,
        "avg_price": round(avg_price, 2),
        "volatility_pct": round(volatility, 2),
        "best_market": best_market,
        "best_price": round(best_price, 2),
        "demand_indicator": demand_indicator,
    }


def _top5_by_group(rows, group_key, value_key="modal_price"):
    sums = defaultdict(float)
    counts = defaultdict(int)
    for r in rows:
        val = r.get(value_key)
        if val is None:
            continue
        key = r.get(group_key)
        if not key:
            continue
        sums[key] += float(val)
        counts[key] += 1
    avgs = {k: sums[k] / counts[k] for k in sums}
    top5 = sorted(avgs.items(), key=lambda kv: kv[1], reverse=True)[:5]
    return [{"name": k, "avg_price": round(v, 2)} for k, v in top5]


def find_best_market_for_commodity(client, commodity: str) -> dict:
    rows = client.table("market_prices").select("*").eq("commodity", commodity).execute().data
    if not rows:
        return {"found": False, "message": f"No data found for '{commodity}'."}
    top5 = _top5_by_group(rows, "market")
    if not top5:
        return {"found": False, "message": f"No price data found for '{commodity}'."}
    return {
        "found": True,
        "query_value": commodity,
        "top_recommendation": top5[0]["name"],
        "top_price": top5[0]["avg_price"],
        "chart_data": top5,
    }


def find_best_commodity_for_market(client, market: str) -> dict:
    rows = client.table("market_prices").select("*").eq("market", market).execute().data
    if not rows:
        return {"found": False, "message": f"No data found for '{market}'."}
    top5 = _top5_by_group(rows, "commodity")
    if not top5:
        return {"found": False, "message": f"No price data found for '{market}'."}
    return {
        "found": True,
        "query_value": market,
        "top_recommendation": top5[0]["name"],
        "top_price": top5[0]["avg_price"],
        "chart_data": top5,
    }


def get_distinct_commodities(client) -> list[str]:
    rows = client.table("market_prices").select("commodity").execute().data
    return sorted({r["commodity"] for r in rows if r.get("commodity")})


def get_distinct_markets(client) -> list[str]:
    rows = client.table("market_prices").select("market").execute().data
    return sorted({r["market"] for r in rows if r.get("market")})
