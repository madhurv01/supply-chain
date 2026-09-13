from dataclasses import dataclass

from fastapi import Header, HTTPException

from backend.supabase_client import get_client


@dataclass
class CurrentUser:
    id: str
    email: str | None
    token: str


def get_current_user(authorization: str = Header(...)) -> CurrentUser:
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing or malformed Authorization header")

    token = authorization.split(" ", 1)[1].strip()
    if not token:
        raise HTTPException(status_code=401, detail="Missing bearer token")

    client = get_client(token)
    try:
        response = client.auth.get_user(token)
    except Exception:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    user = getattr(response, "user", None)
    if not user:
        raise HTTPException(status_code=401, detail="Invalid or expired token")

    return CurrentUser(id=user.id, email=user.email, token=token)
