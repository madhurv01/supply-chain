using System.Text.Json.Nodes;
using AgriChain.Infrastructure;
using AgriChain.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Agent.Tools;

public delegate Task<object?> AgentToolDelegate(JsonObject args);

public class AgentTools(
    MarketService marketService,
    FarmService farmService,
    InventoryService inventoryService,
    LogisticsService logisticsService,
    FinanceService financeService,
    RoutingOptimizer routingOptimizer,
    CropGradingService cropGradingService,
    AgriChainDbContext db)
{
    public static readonly JsonArray Schema = JsonNode.Parse(SchemaJson)!.AsArray();

    private const string SchemaJson = """
    [
      { "type": "function", "function": { "name": "get_price_forecast", "description": "Get price forecast statistics (avg price, volatility, best market, demand) for a commodity.",
        "parameters": { "type": "object", "properties": { "commodity": {"type": "string"}, "state": {"type": "string", "description": "Optional state filter, default 'All'"} }, "required": ["commodity"] } } },
      { "type": "function", "function": { "name": "find_best_market", "description": "Find the top 5 markets by average price for a given commodity.",
        "parameters": { "type": "object", "properties": { "commodity": {"type": "string"} }, "required": ["commodity"] } } },
      { "type": "function", "function": { "name": "find_best_commodity", "description": "Find the top 5 commodities by average price for a given market.",
        "parameters": { "type": "object", "properties": { "market": {"type": "string"} }, "required": ["market"] } } },
      { "type": "function", "function": { "name": "get_farm_plots", "description": "List farm plots, optionally filtered by status (GROWING or HARVESTED).",
        "parameters": { "type": "object", "properties": { "status": {"type": "string"} }, "required": [] } } },
      { "type": "function", "function": { "name": "add_farm_plot", "description": "Register a new farm plot that has been planted.",
        "parameters": { "type": "object", "properties": { "commodity": {"type": "string"}, "plot_id": {"type": "string"}, "quantity": {"type": "number"}, "date_planted": {"type": "string", "description": "YYYY-MM-DD"}, "expected_harvest_date": {"type": "string", "description": "YYYY-MM-DD"} }, "required": ["commodity", "plot_id", "quantity", "date_planted", "expected_harvest_date"] } } },
      { "type": "function", "function": { "name": "harvest_plot", "description": "Mark a farm plot as harvested and add the harvested quantity to inventory.",
        "parameters": { "type": "object", "properties": { "plot_id_or_row_id": {"type": "string", "description": "The plot_id or numeric row id"}, "commodity": {"type": "string"}, "quantity": {"type": "number"} }, "required": ["plot_id_or_row_id", "commodity", "quantity"] } } },
      { "type": "function", "function": { "name": "get_inventory", "description": "List current warehouse inventory by commodity.",
        "parameters": { "type": "object", "properties": {}, "required": [] } } },
      { "type": "function", "function": { "name": "create_shipment", "description": "Create a shipment of a commodity from the warehouse to a destination market. Decrements inventory.",
        "parameters": { "type": "object", "properties": { "truck_id": {"type": "string"}, "commodity": {"type": "string"}, "quantity": {"type": "number"}, "destination_market": {"type": "string"} }, "required": ["truck_id", "commodity", "quantity", "destination_market"] } } },
      { "type": "function", "function": { "name": "get_active_shipments", "description": "List shipments that are IN_TRANSIT or ARRIVED.",
        "parameters": { "type": "object", "properties": {}, "required": [] } } },
      { "type": "function", "function": { "name": "log_sale", "description": "Log a sale of a commodity at a market and price.",
        "parameters": { "type": "object", "properties": { "commodity": {"type": "string"}, "quantity": {"type": "number"}, "price_per_unit": {"type": "number"}, "market": {"type": "string"} }, "required": ["commodity", "quantity", "price_per_unit", "market"] } } },
      { "type": "function", "function": { "name": "get_financial_summary", "description": "Get total revenue, total sales count, and average sale value.",
        "parameters": { "type": "object", "properties": {}, "required": [] } } },
      { "type": "function", "function": { "name": "optimize_shipment_route", "description": "Compute the best destination markets for shipping a commodity, ranked by net expected value (price, distance, transit time, spoilage risk, transport cost).",
        "parameters": { "type": "object", "properties": { "commodity": {"type": "string"}, "quantity": {"type": "number"} }, "required": ["commodity", "quantity"] } } },
      { "type": "function", "function": { "name": "grade_crop_photo", "description": "Grade a crop photo (base64 image) for quality, returning grade A/B/C, defects, and confidence.",
        "parameters": { "type": "object", "properties": { "image_base64": {"type": "string"}, "commodity": {"type": "string"} }, "required": ["image_base64", "commodity"] } } }
    ]
    """;

    private static string? Str(JsonObject args, string key) => args[key]?.GetValue<string>();
    private static decimal Dec(JsonObject args, string key) => args[key]?.GetValue<decimal>() ?? 0m;

    public Dictionary<string, AgentToolDelegate> BuildDispatch(Guid? userId) => new()
    {
        ["get_price_forecast"] = async args =>
            await marketService.GetPriceForecastStatsAsync(Str(args, "commodity")!, Str(args, "state") ?? "All"),

        ["find_best_market"] = async args =>
            await marketService.FindBestMarketForCommodityAsync(Str(args, "commodity")!),

        ["find_best_commodity"] = async args =>
            await marketService.FindBestCommodityForMarketAsync(Str(args, "market")!),

        ["get_farm_plots"] = async args =>
            await farmService.GetFarmPlotsAsync(Str(args, "status")),

        ["add_farm_plot"] = async args =>
            await farmService.AddFarmPlotAsync(
                Str(args, "commodity")!, Str(args, "plot_id")!, Dec(args, "quantity"),
                DateOnly.Parse(Str(args, "date_planted")!), DateOnly.Parse(Str(args, "expected_harvest_date")!)),

        ["harvest_plot"] = async args =>
        {
            var idOrPlotId = Str(args, "plot_id_or_row_id")!;
            long rowId;
            if (long.TryParse(idOrPlotId, out var parsed))
            {
                rowId = parsed;
            }
            else
            {
                var match = await db.FarmPlots.FirstOrDefaultAsync(p => p.PlotId == idOrPlotId);
                if (match is null)
                    return new Dictionary<string, object> { ["success"] = false, ["message"] = $"No plot found with plot_id '{idOrPlotId}'." };
                rowId = match.Id;
            }
            return await farmService.HarvestPlotAsync(rowId, Str(args, "commodity")!, Dec(args, "quantity"));
        },

        ["get_inventory"] = async _ => await inventoryService.GetInventoryAsync(),

        ["create_shipment"] = async args =>
            await logisticsService.CreateShipmentAsync(
                Str(args, "truck_id")!, Str(args, "commodity")!, Dec(args, "quantity"), Str(args, "destination_market")!),

        ["get_active_shipments"] = async _ => await logisticsService.GetActiveShipmentsAsync(),

        ["log_sale"] = async args =>
            await financeService.LogSaleAsync(Str(args, "commodity")!, Dec(args, "quantity"), Dec(args, "price_per_unit"), Str(args, "market")!),

        ["get_financial_summary"] = async _ => await financeService.GetFinancialSummaryAsync(),

        ["optimize_shipment_route"] = async args =>
            await routingOptimizer.OptimizeShipmentRouteAsync(Str(args, "commodity")!, Dec(args, "quantity")),

        ["grade_crop_photo"] = async args =>
            await cropGradingService.GradeCropPhotoAsync(Str(args, "image_base64")!, Str(args, "commodity")!, userId),
    };
}
