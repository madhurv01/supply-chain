using AgriChain.Infrastructure.Services;

namespace AgriChain.Api.Endpoints;

public record MarketForecastRequest(string Commodity, string? State);
public record MarketAnalyzeRequest(string Mode, string Value);

public static class MarketEndpoints
{
    public static void MapMarketEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/market").RequireAuthorization();

        group.MapGet("/commodities", async (MarketService svc) => Results.Ok(await svc.GetDistinctCommoditiesAsync()));

        group.MapGet("/markets", async (MarketService svc) => Results.Ok(await svc.GetDistinctMarketsAsync()));

        group.MapPost("/forecast", async (MarketForecastRequest req, MarketService svc) =>
            Results.Ok(await svc.GetPriceForecastStatsAsync(req.Commodity, req.State ?? "All")));

        group.MapPost("/analyze", async (MarketAnalyzeRequest req, MarketService svc) =>
        {
            var result = req.Mode == "best_market_for_commodity"
                ? await svc.FindBestMarketForCommodityAsync(req.Value)
                : await svc.FindBestCommodityForMarketAsync(req.Value);

            if (result.TryGetValue("found", out var found) && found is false)
                return Results.Ok(result);

            return Results.Ok(new
            {
                topRecommendation = result["top_recommendation"],
                topPrice = result["top_price"],
                chartData = ((List<Dictionary<string, object>>)result["chart_data"]!)
                    .Select(x => new { label = x["name"], value = x["avg_price"] }),
            });
        });
    }
}
