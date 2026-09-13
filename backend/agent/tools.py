from backend.services import farm as farm_service
from backend.services import finance as finance_service
from backend.services import inventory as inventory_service
from backend.services import logistics as logistics_service
from backend.services import market as market_service

TOOL_SCHEMA = [
    {
        "type": "function",
        "function": {
            "name": "get_price_forecast",
            "description": "Get price forecast statistics (avg price, volatility, best market, demand) for a commodity.",
            "parameters": {
                "type": "object",
                "properties": {
                    "commodity": {"type": "string"},
                    "state": {"type": "string", "description": "Optional state filter, default 'All'"},
                },
                "required": ["commodity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_best_market",
            "description": "Find the top 5 markets by average price for a given commodity.",
            "parameters": {
                "type": "object",
                "properties": {"commodity": {"type": "string"}},
                "required": ["commodity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "find_best_commodity",
            "description": "Find the top 5 commodities by average price for a given market.",
            "parameters": {
                "type": "object",
                "properties": {"market": {"type": "string"}},
                "required": ["market"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_farm_plots",
            "description": "List farm plots, optionally filtered by status (GROWING or HARVESTED).",
            "parameters": {
                "type": "object",
                "properties": {"status": {"type": "string"}},
                "required": [],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "add_farm_plot",
            "description": "Register a new farm plot that has been planted.",
            "parameters": {
                "type": "object",
                "properties": {
                    "commodity": {"type": "string"},
                    "plot_id": {"type": "string"},
                    "quantity": {"type": "number"},
                    "date_planted": {"type": "string", "description": "YYYY-MM-DD"},
                    "expected_harvest_date": {"type": "string", "description": "YYYY-MM-DD"},
                },
                "required": ["commodity", "plot_id", "quantity", "date_planted", "expected_harvest_date"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "harvest_plot",
            "description": "Mark a farm plot as harvested and add the harvested quantity to inventory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "plot_id_or_row_id": {"type": "string", "description": "The plot_id or numeric row id"},
                    "commodity": {"type": "string"},
                    "quantity": {"type": "number"},
                },
                "required": ["plot_id_or_row_id", "commodity", "quantity"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_inventory",
            "description": "List current warehouse inventory by commodity.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "create_shipment",
            "description": "Create a shipment of a commodity from the warehouse to a destination market. Decrements inventory.",
            "parameters": {
                "type": "object",
                "properties": {
                    "truck_id": {"type": "string"},
                    "commodity": {"type": "string"},
                    "quantity": {"type": "number"},
                    "destination_market": {"type": "string"},
                },
                "required": ["truck_id", "commodity", "quantity", "destination_market"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_active_shipments",
            "description": "List shipments that are IN_TRANSIT or ARRIVED.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
    {
        "type": "function",
        "function": {
            "name": "log_sale",
            "description": "Log a sale of a commodity at a market and price.",
            "parameters": {
                "type": "object",
                "properties": {
                    "commodity": {"type": "string"},
                    "quantity": {"type": "number"},
                    "price_per_unit": {"type": "number"},
                    "market": {"type": "string"},
                },
                "required": ["commodity", "quantity", "price_per_unit", "market"],
            },
        },
    },
    {
        "type": "function",
        "function": {
            "name": "get_financial_summary",
            "description": "Get total revenue, total sales count, and average sale value.",
            "parameters": {"type": "object", "properties": {}, "required": []},
        },
    },
]


def _get_price_forecast(client, user_id, commodity, state="All"):
    return market_service.get_price_forecast_stats(client, commodity, state)


def _find_best_market(client, user_id, commodity):
    return market_service.find_best_market_for_commodity(client, commodity)


def _find_best_commodity(client, user_id, market):
    return market_service.find_best_commodity_for_market(client, market)


def _get_farm_plots(client, user_id, status=None):
    return farm_service.get_farm_plots(client, status)


def _add_farm_plot(client, user_id, commodity, plot_id, quantity, date_planted, expected_harvest_date):
    return farm_service.add_farm_plot(client, commodity, plot_id, quantity, date_planted, expected_harvest_date)


def _harvest_plot(client, user_id, plot_id_or_row_id, commodity, quantity):
    row_id = plot_id_or_row_id
    if not str(plot_id_or_row_id).isdigit():
        matches = client.table("farm_plots").select("id").eq("plot_id", plot_id_or_row_id).execute().data
        if not matches:
            return {"success": False, "message": f"No plot found with plot_id '{plot_id_or_row_id}'."}
        row_id = matches[0]["id"]
    return farm_service.harvest_plot(client, int(row_id), commodity, quantity)


def _get_inventory(client, user_id):
    return inventory_service.get_inventory(client)


def _create_shipment(client, user_id, truck_id, commodity, quantity, destination_market):
    return logistics_service.create_shipment(client, truck_id, commodity, quantity, destination_market)


def _get_active_shipments(client, user_id):
    return logistics_service.get_active_shipments(client)


def _log_sale(client, user_id, commodity, quantity, price_per_unit, market):
    return finance_service.log_sale(client, commodity, quantity, price_per_unit, market)


def _get_financial_summary(client, user_id):
    return finance_service.get_financial_summary(client)


TOOL_DISPATCH = {
    "get_price_forecast": _get_price_forecast,
    "find_best_market": _find_best_market,
    "find_best_commodity": _find_best_commodity,
    "get_farm_plots": _get_farm_plots,
    "add_farm_plot": _add_farm_plot,
    "harvest_plot": _harvest_plot,
    "get_inventory": _get_inventory,
    "create_shipment": _create_shipment,
    "get_active_shipments": _get_active_shipments,
    "log_sale": _log_sale,
    "get_financial_summary": _get_financial_summary,
}
