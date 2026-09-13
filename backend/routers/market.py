from fastapi import APIRouter, Depends
from pydantic import BaseModel

from backend.auth import CurrentUser, get_current_user
from backend.services import forecasts as forecasts_service
from backend.services import market as market_service
from backend.supabase_client import get_client

router = APIRouter(prefix="/market", tags=["market"])


class ForecastRequest(BaseModel):
    commodity: str
    state: str = "All"
    market: str = "All"


class AnalyzeRequest(BaseModel):
    mode: str  # "best_market_for_commodity" | "best_commodity_for_market"
    value: str


@router.get("/commodities")
def list_commodities(user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return market_service.get_distinct_commodities(client)


@router.get("/markets")
def list_markets(user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return market_service.get_distinct_markets(client)


@router.post("/forecast")
def forecast(body: ForecastRequest, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    return market_service.get_price_forecast_stats(client, body.commodity, body.state, body.market)


@router.post("/analyze")
def analyze(body: AnalyzeRequest, user: CurrentUser = Depends(get_current_user)):
    client = get_client(user.token)
    if body.mode == "best_market_for_commodity":
        result = market_service.find_best_market_for_commodity(client, body.value)
        analysis_type = "Best Market for Commodity"
    else:
        result = market_service.find_best_commodity_for_market(client, body.value)
        analysis_type = "Best Commodity for Market"

    if result.get("found"):
        report = (
            f"### Top Recommendation for '{body.value}'\n"
            f"- **Best {'Market' if body.mode == 'best_market_for_commodity' else 'Commodity'}:** "
            f"{result['top_recommendation']}\n"
            f"- **Expected Average Price:** ₹{result['top_price']:.2f}"
        )
        forecasts_service.save_forecast(
            client,
            user.id,
            "market_analysis",
            {"analysis_type": analysis_type, "query_value": body.value, **result},
            report,
        )
    return result
