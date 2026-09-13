from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.auth import CurrentUser, get_current_user
from backend.services import logistics as logistics_service
from backend.supabase_client import get_client

router = APIRouter(prefix="/logistics", tags=["logistics"])


class CreateShipmentRequest(BaseModel):
    truck_id: str
    commodity: str
    quantity: float
    destination_market: str


class StepRequest(BaseModel):
    step_progress: float = 0.02


@router.get("/shipments")
def list_shipments(user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return logistics_service.get_active_shipments(client)


@router.post("/shipments")
def create_shipment(body: CreateShipmentRequest, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return logistics_service.create_shipment(
        client, body.truck_id, body.commodity, body.quantity, body.destination_market
    )


@router.post("/shipments/advance")
def advance_shipments(body: StepRequest, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return logistics_service.update_all_shipment_locations(client, body.step_progress)


@router.post("/shipments/{shipment_id}/deliver")
def deliver(shipment_id: int, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return logistics_service.deliver_shipment(client, shipment_id)
