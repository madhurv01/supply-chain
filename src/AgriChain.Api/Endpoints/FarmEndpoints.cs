using AgriChain.Infrastructure.Services;

namespace AgriChain.Api.Endpoints;

public record AddFarmPlotRequest(string Commodity, string PlotId, decimal Quantity, DateOnly DatePlanted, DateOnly ExpectedHarvestDate);
public record HarvestPlotRequest(long PlotRowId, string Commodity, decimal Quantity);

public static class FarmEndpoints
{
    public static void MapFarmEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/farm").RequireAuthorization();

        group.MapGet("/plots", async (string? status, FarmService svc) =>
            Results.Ok(await svc.GetFarmPlotsAsync(status)));

        group.MapPost("/plots", async (AddFarmPlotRequest req, FarmService svc) =>
            Results.Ok(await svc.AddFarmPlotAsync(req.Commodity, req.PlotId, req.Quantity, req.DatePlanted, req.ExpectedHarvestDate)));

        group.MapPost("/harvest", async (HarvestPlotRequest req, FarmService svc) =>
            Results.Ok(await svc.HarvestPlotAsync(req.PlotRowId, req.Commodity, req.Quantity)));
    }
}
