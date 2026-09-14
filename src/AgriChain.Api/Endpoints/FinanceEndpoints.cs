using AgriChain.Infrastructure.Services;

namespace AgriChain.Api.Endpoints;

public record LogSaleRequest(string Commodity, decimal Quantity, decimal PricePerUnit, string Market);

public static class FinanceEndpoints
{
    public static void MapFinanceEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/finance").RequireAuthorization();

        group.MapGet("/sales", async (FinanceService svc) => Results.Ok(await svc.GetSalesDataAsync()));

        group.MapPost("/sales", async (LogSaleRequest req, FinanceService svc) =>
            Results.Ok(await svc.LogSaleAsync(req.Commodity, req.Quantity, req.PricePerUnit, req.Market)));

        group.MapGet("/summary", async (FinanceService svc) => Results.Ok(await svc.GetFinancialSummaryAsync()));
    }
}
