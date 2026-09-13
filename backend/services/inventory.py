def get_inventory(client):
    return client.table("inventory").select("*").gt("quantity", 0).execute().data
