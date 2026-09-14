using AgriChain.Agent;
using AgriChain.Infrastructure.Services;

namespace AgriChain.Api.Endpoints;

public record CreateShipmentRequest(string TruckId, string Commodity, decimal Quantity, string DestinationMarket);
public record OptimizeRouteRequest(string Commodity, decimal Quantity);

public static class LogisticsEndpoints
{
    public static void MapLogisticsEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/logistics").RequireAuthorization();

        group.MapGet("/shipments", async (LogisticsService svc) => Results.Ok(await svc.GetActiveShipmentsAsync()));

        group.MapPost("/shipments", async (CreateShipmentRequest req, LogisticsService svc) =>
            Results.Ok(await svc.CreateShipmentAsync(req.TruckId, req.Commodity, req.Quantity, req.DestinationMarket)));

        group.MapPost("/shipments/advance", async (LogisticsService svc) =>
            Results.Ok(await svc.UpdateAllShipmentLocationsAsync()));

        group.MapPost("/shipments/{id:long}/deliver", async (long id, LogisticsService svc) =>
            Results.Ok(await svc.DeliverShipmentAsync(id)));

        group.MapPost("/optimize-route", async (OptimizeRouteRequest req, RoutingOptimizer optimizer) =>
            Results.Ok(await optimizer.OptimizeShipmentRouteAsync(req.Commodity, req.Quantity)));
    }
}
