from fastapi import APIRouter, Depends

from backend.auth import CurrentUser, get_current_user
from backend.services import inventory as inventory_service
from backend.supabase_client import get_client

router = APIRouter(prefix="/inventory", tags=["inventory"])


@router.get("")
def list_inventory(user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return inventory_service.get_inventory(client)
