from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.auth import CurrentUser, get_current_user
from backend.services import finance as finance_service
from backend.supabase_client import get_client

router = APIRouter(prefix="/finance", tags=["finance"])


class LogSaleRequest(BaseModel):
    commodity: str
    quantity: float
    price_per_unit: float
    market: str


@router.get("/sales")
def list_sales(user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return finance_service.get_sales_data(client)


@router.post("/sales")
def log_sale(body: LogSaleRequest, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return finance_service.log_sale(client, body.commodity, body.quantity, body.price_per_unit, body.market)


@router.get("/summary")
def summary(user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return finance_service.get_financial_summary(client)
