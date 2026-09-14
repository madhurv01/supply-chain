using AgriChain.Infrastructure.Services;

namespace AgriChain.Api.Endpoints;

public static class ForecastEndpoints
{
    public static void MapForecastEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/forecasts", async (string? kind, ForecastService svc) =>
            Results.Ok(await svc.GetForecastsAsync(kind: kind)))
            .RequireAuthorization();
    }
}
