using AgriChain.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Infrastructure.Services;

public class FarmService(AgriChainDbContext db)
{
    public async Task<FarmPlot> AddFarmPlotAsync(string commodity, string plotId, decimal quantity, DateOnly datePlanted, DateOnly expectedHarvestDate)
    {
        var plot = new FarmPlot
        {
            Commodity = commodity,
            PlotId = plotId,
            QuantityPlanted = quantity,
            DatePlanted = datePlanted,
            ExpectedHarvestDate = expectedHarvestDate,
            Status = "GROWING",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.FarmPlots.Add(plot);
        await db.SaveChangesAsync();
        return plot;
    }

    public async Task<List<FarmPlot>> GetFarmPlotsAsync(string? status = null)
    {
        var query = db.FarmPlots.AsQueryable();
        if (!string.IsNullOrWhiteSpace(status))
            query = query.Where(p => p.Status == status);
        return await query.OrderByDescending(p => p.CreatedAt).ToListAsync();
    }

    public async Task<Dictionary<string, object>> HarvestPlotAsync(long plotRowId, string commodity, decimal quantity)
    {
        var plot = await db.FarmPlots.FindAsync(plotRowId);
        if (plot is not null)
        {
            plot.Status = "HARVESTED";
        }

        var existing = await db.InventoryItems.FirstOrDefaultAsync(i => i.Commodity == commodity);
        if (existing is not null)
        {
            existing.Quantity += quantity;
        }
        else
        {
            db.InventoryItems.Add(new InventoryItem { Commodity = commodity, Quantity = quantity, Unit = "KG" });
        }

        await db.SaveChangesAsync();
        return new() { ["success"] = true };
    }
}
