from supabase import create_client, Client

from backend.config import settings


def get_client(access_token: str | None = None) -> Client:
    client = create_client(settings.SUPABASE_URL, settings.SUPABASE_ANON_KEY)
    if access_token:
        client.postgrest.auth(access_token)
    return client
