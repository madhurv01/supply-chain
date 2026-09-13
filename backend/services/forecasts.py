def save_forecast(client, user_id: str, kind: str, query: dict, report: str):
    row = {"user_id": user_id, "kind": kind, "query": query, "report": report}
    return client.table("forecasts").insert(row).execute().data


def get_forecasts(client, user_id: str | None = None, kind: str | None = None):
    query = client.table("forecasts").select("*")
    if user_id:
        query = query.eq("user_id", user_id)
    if kind:
        query = query.eq("kind", kind)
    return query.order("created_at", desc=True).execute().data
