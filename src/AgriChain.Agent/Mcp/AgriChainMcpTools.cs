using System.ComponentModel;
using AgriChain.Infrastructure.Services;
using ModelContextProtocol.Server;

namespace AgriChain.Agent.Mcp;

/// <summary>
/// Exposes the same 13 capabilities as the agent's tool-calling loop (11 ported from the
/// Python backend's agent/tools.py plus the 2 new AI features) as MCP tools, so any MCP-compatible
/// client (not just the in-app Groq agent) can drive Agri-Chain OS.
/// </summary>
[McpServerToolType]
public class AgriChainMcpTools(
    MarketService marketService,
    FarmService farmService,
    InventoryService inventoryService,
    LogisticsService logisticsService,
    FinanceService financeService,
    RoutingOptimizer routingOptimizer,
    CropGradingService cropGradingService)
{
    [McpServerTool(Name = "get_price_forecast"), Description("Get price forecast statistics (avg price, volatility, best market, demand) for a commodity.")]
    public Task<Dictionary<string, object?>> GetPriceForecast(string commodity, string state = "All") =>
        marketService.GetPriceForecastStatsAsync(commodity, state);

    [McpServerTool(Name = "find_best_market"), Description("Find the top 5 markets by average price for a given commodity.")]
    public Task<Dictionary<string, object?>> FindBestMarket(string commodity) =>
        marketService.FindBestMarketForCommodityAsync(commodity);

    [McpServerTool(Name = "find_best_commodity"), Description("Find the top 5 commodities by average price for a given market.")]
    public Task<Dictionary<string, object?>> FindBestCommodity(string market) =>
        marketService.FindBestCommodityForMarketAsync(market);

    [McpServerTool(Name = "get_farm_plots"), Description("List farm plots, optionally filtered by status (GROWING or HARVESTED).")]
    public Task<object> GetFarmPlots(string? status = null) =>
        farmService.GetFarmPlotsAsync(status).ContinueWith(t => (object)t.Result);

    [McpServerTool(Name = "add_farm_plot"), Description("Register a new farm plot that has been planted.")]
    public Task<object> AddFarmPlot(string commodity, string plotId, decimal quantity, string datePlanted, string expectedHarvestDate) =>
        farmService.AddFarmPlotAsync(commodity, plotId, quantity, DateOnly.Parse(datePlanted), DateOnly.Parse(expectedHarvestDate))
            .ContinueWith(t => (object)t.Result);

    [McpServerTool(Name = "harvest_plot"), Description("Mark a farm plot as harvested by its row id and add the harvested quantity to inventory.")]
    public Task<Dictionary<string, object>> HarvestPlot(long plotRowId, string commodity, decimal quantity) =>
        farmService.HarvestPlotAsync(plotRowId, commodity, quantity);

    [McpServerTool(Name = "get_inventory"), Description("List current warehouse inventory by commodity.")]
    public Task<object> GetInventory() => inventoryService.GetInventoryAsync().ContinueWith(t => (object)t.Result);

    [McpServerTool(Name = "create_shipment"), Description("Create a shipment of a commodity from the warehouse to a destination market. Decrements inventory.")]
    public Task<Dictionary<string, object?>> CreateShipment(string truckId, string commodity, decimal quantity, string destinationMarket) =>
        logisticsService.CreateShipmentAsync(truckId, commodity, quantity, destinationMarket);

    [McpServerTool(Name = "get_active_shipments"), Description("List shipments that are IN_TRANSIT or ARRIVED.")]
    public Task<object> GetActiveShipments() => logisticsService.GetActiveShipmentsAsync().ContinueWith(t => (object)t.Result);

    [McpServerTool(Name = "log_sale"), Description("Log a sale of a commodity at a market and price.")]
    public Task<object> LogSale(string commodity, decimal quantity, decimal pricePerUnit, string market) =>
        financeService.LogSaleAsync(commodity, quantity, pricePerUnit, market).ContinueWith(t => (object)t.Result);

    [McpServerTool(Name = "get_financial_summary"), Description("Get total revenue, total sales count, and average sale value.")]
    public Task<Dictionary<string, object>> GetFinancialSummary() => financeService.GetFinancialSummaryAsync();

    [McpServerTool(Name = "optimize_shipment_route"), Description("Compute the best destination markets for shipping a commodity, ranked by net expected value (price, distance, transit time, spoilage risk, transport cost).")]
    public Task<Dictionary<string, object?>> OptimizeShipmentRoute(string commodity, decimal quantity) =>
        routingOptimizer.OptimizeShipmentRouteAsync(commodity, quantity);

    [McpServerTool(Name = "grade_crop_photo"), Description("Grade a crop photo (base64-encoded JPEG/PNG) for quality, returning grade A/B/C, defects, and confidence.")]
    public Task<Dictionary<string, object?>> GradeCropPhoto(string imageBase64, string commodity) =>
        cropGradingService.GradeCropPhotoAsync(imageBase64, commodity, null);
}
