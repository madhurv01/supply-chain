using AgriChain.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Infrastructure.Services;

public class ForecastService(AgriChainDbContext db)
{
    public async Task<Forecast> SaveForecastAsync(Guid? userId, string kind, string queryJson, string report)
    {
        var forecast = new Forecast
        {
            UserId = userId,
            Kind = kind,
            QueryJson = queryJson,
            Report = report,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Forecasts.Add(forecast);
        await db.SaveChangesAsync();
        return forecast;
    }

    public async Task<List<Forecast>> GetForecastsAsync(Guid? userId = null, string? kind = null)
    {
        var query = db.Forecasts.AsQueryable();
        if (userId.HasValue)
            query = query.Where(f => f.UserId == userId);
        if (!string.IsNullOrWhiteSpace(kind))
            query = query.Where(f => f.Kind == kind);
        return await query.OrderByDescending(f => f.CreatedAt).ToListAsync();
    }
}
