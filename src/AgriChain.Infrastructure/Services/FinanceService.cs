using AgriChain.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Infrastructure.Services;

public class FinanceService(AgriChainDbContext db)
{
    public async Task<Sale> LogSaleAsync(string commodity, decimal quantity, decimal pricePerUnit, string market)
    {
        var sale = new Sale
        {
            Commodity = commodity,
            Quantity = quantity,
            PricePerUnit = pricePerUnit,
            TotalRevenue = quantity * pricePerUnit,
            Market = market,
            SoldAt = DateTimeOffset.UtcNow,
        };
        db.Sales.Add(sale);
        await db.SaveChangesAsync();
        return sale;
    }

    public async Task<List<Sale>> GetSalesDataAsync() =>
        await db.Sales.OrderByDescending(s => s.SoldAt).ToListAsync();

    public async Task<Dictionary<string, object>> GetFinancialSummaryAsync()
    {
        var sales = await GetSalesDataAsync();
        if (sales.Count == 0)
            return new() { ["totalRevenue"] = 0m, ["totalSales"] = 0, ["avgSaleValue"] = 0m, ["byCommodity"] = new List<object>() };

        var totalRevenue = sales.Sum(s => s.TotalRevenue);
        var totalSales = sales.Count;
        var avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0m;
        var byCommodity = sales
            .GroupBy(s => s.Commodity)
            .Select(g => new { commodity = g.Key, revenue = Math.Round(g.Sum(s => s.TotalRevenue), 2) })
            .OrderByDescending(x => x.revenue)
            .ToList();

        return new()
        {
            ["totalRevenue"] = Math.Round(totalRevenue, 2),
            ["totalSales"] = totalSales,
            ["avgSaleValue"] = Math.Round(avgSaleValue, 2),
            ["byCommodity"] = byCommodity,
        };
    }
}
