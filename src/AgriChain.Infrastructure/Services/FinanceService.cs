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
            return new() { ["total_revenue"] = 0m, ["total_sales"] = 0, ["avg_sale_value"] = 0m };

        var totalRevenue = sales.Sum(s => s.TotalRevenue);
        var totalSales = sales.Count;
        var avgSaleValue = totalSales > 0 ? totalRevenue / totalSales : 0m;

        return new()
        {
            ["total_revenue"] = Math.Round(totalRevenue, 2),
            ["total_sales"] = totalSales,
            ["avg_sale_value"] = Math.Round(avgSaleValue, 2),
        };
    }
}
