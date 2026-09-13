from datetime import date

from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.auth import CurrentUser, get_current_user
from backend.services import farm as farm_service
from backend.supabase_client import get_client

router = APIRouter(prefix="/farm", tags=["farm"])


class AddPlotRequest(BaseModel):
    commodity: str
    plot_id: str
    quantity: float
    date_planted: date
    expected_harvest_date: date


class HarvestRequest(BaseModel):
    plot_row_id: int
    commodity: str
    quantity: float


@router.get("/plots")
def list_plots(status: str | None = None, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return farm_service.get_farm_plots(client, status)


@router.post("/plots")
def add_plot(body: AddPlotRequest, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return farm_service.add_farm_plot(
        client, body.commodity, body.plot_id, body.quantity, body.date_planted, body.expected_harvest_date
    )


@router.post("/harvest")
def harvest(body: HarvestRequest, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return farm_service.harvest_plot(client, body.plot_row_id, body.commodity, body.quantity)
