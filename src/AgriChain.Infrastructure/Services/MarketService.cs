using AgriChain.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Infrastructure.Services;

public class MarketService(AgriChainDbContext db)
{
    public async Task<Dictionary<string, object?>> GetPriceForecastStatsAsync(string commodity, string state = "All", string market = "All")
    {
        var query = db.MarketPrices.AsQueryable();
        if (!string.IsNullOrWhiteSpace(commodity))
            query = query.Where(r => EF.Functions.ILike(r.Commodity, $"%{commodity}%"));
        if (!string.IsNullOrWhiteSpace(state) && state != "All")
            query = query.Where(r => EF.Functions.ILike(r.State, $"%{state}%"));
        if (!string.IsNullOrWhiteSpace(market) && market != "All")
            query = query.Where(r => EF.Functions.ILike(r.Market, $"%{market}%"));

        var rows = await query.ToListAsync();
        if (rows.Count == 0)
            return new() { ["found"] = false, ["message"] = $"No data found for '{commodity}' in the specified region." };

        var prices = rows.Select(r => (double)r.ModalPrice).ToList();
        var avgPrice = prices.Average();
        var variance = prices.Select(p => (p - avgPrice) * (p - avgPrice)).Average();
        var stdDev = Math.Sqrt(variance);
        var volatility = avgPrice > 0 ? stdDev / avgPrice * 100 : 0;

        var bestRow = rows.OrderByDescending(r => r.ModalPrice).First();
        var bestMarket = $"{bestRow.Market}, {bestRow.State}";
        var demandIndicator = rows.Select(r => r.Market).Distinct().Count();

        return new()
        {
            ["found"] = true,
            ["commodity"] = commodity,
            ["avgPrice"] = Math.Round(avgPrice, 2),
            ["volatility"] = Math.Round(volatility, 2),
            ["topMarket"] = bestMarket,
            ["topPrice"] = Math.Round((double)bestRow.ModalPrice, 2),
            ["demandIndicator"] = demandIndicator,
        };
    }

    private static List<Dictionary<string, object>> Top5ByGroup(IEnumerable<MarketPrice> rows, Func<MarketPrice, string?> groupKey)
    {
        var groups = rows
            .Where(r => !string.IsNullOrEmpty(groupKey(r)))
            .GroupBy(groupKey)
            .Select(g => new { Name = g.Key!, Avg = g.Average(r => (double)r.ModalPrice) })
            .OrderByDescending(x => x.Avg)
            .Take(5)
            .Select(x => new Dictionary<string, object> { ["name"] = x.Name, ["avg_price"] = Math.Round(x.Avg, 2) })
            .ToList();
        return groups;
    }

    public async Task<Dictionary<string, object?>> FindBestMarketForCommodityAsync(string commodity)
    {
        var rows = await db.MarketPrices.Where(r => r.Commodity == commodity).ToListAsync();
        if (rows.Count == 0)
            return new() { ["found"] = false, ["message"] = $"No data found for '{commodity}'." };
        var top5 = Top5ByGroup(rows, r => r.Market);
        if (top5.Count == 0)
            return new() { ["found"] = false, ["message"] = $"No price data found for '{commodity}'." };
        return new()
        {
            ["found"] = true,
            ["query_value"] = commodity,
            ["top_recommendation"] = top5[0]["name"],
            ["top_price"] = top5[0]["avg_price"],
            ["chart_data"] = top5,
        };
    }

    public async Task<Dictionary<string, object?>> FindBestCommodityForMarketAsync(string market)
    {
        var rows = await db.MarketPrices.Where(r => r.Market == market).ToListAsync();
        if (rows.Count == 0)
            return new() { ["found"] = false, ["message"] = $"No data found for '{market}'." };
        var top5 = Top5ByGroup(rows, r => r.Commodity);
        if (top5.Count == 0)
            return new() { ["found"] = false, ["message"] = $"No price data found for '{market}'." };
        return new()
        {
            ["found"] = true,
            ["query_value"] = market,
            ["top_recommendation"] = top5[0]["name"],
            ["top_price"] = top5[0]["avg_price"],
            ["chart_data"] = top5,
        };
    }

    public async Task<List<string>> GetDistinctCommoditiesAsync() =>
        await db.MarketPrices.Select(r => r.Commodity).Distinct().OrderBy(x => x).ToListAsync();

    public async Task<List<string>> GetDistinctMarketsAsync() =>
        await db.MarketPrices.Select(r => r.Market).Distinct().OrderBy(x => x).ToListAsync();
}
