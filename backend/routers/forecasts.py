from fastapi import APIRouter, Depends

from backend.auth import CurrentUser, get_current_user
from backend.services import forecasts as forecasts_service
from backend.supabase_client import get_client

router = APIRouter(prefix="/forecasts", tags=["forecasts"])


@router.get("")
def list_forecasts(kind: str | None = None, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return forecasts_service.get_forecasts(client, kind=kind)
