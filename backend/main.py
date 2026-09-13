from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from backend.routers import agent, farm, finance, forecasts, inventory, logistics, market

app = FastAPI(title="Agri-Chain OS API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/health")
def health():
    return {"status": "ok"}


app.include_router(market.router)
app.include_router(farm.router)
app.include_router(inventory.router)
app.include_router(logistics.router)
app.include_router(finance.router)
app.include_router(forecasts.router)
app.include_router(agent.router)
