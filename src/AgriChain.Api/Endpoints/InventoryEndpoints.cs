using AgriChain.Infrastructure.Services;

namespace AgriChain.Api.Endpoints;

public static class InventoryEndpoints
{
    public static void MapInventoryEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapGet("/inventory", async (InventoryService svc) => Results.Ok(await svc.GetInventoryAsync()))
            .RequireAuthorization();
    }
}
