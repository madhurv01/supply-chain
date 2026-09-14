using System.Security.Claims;

namespace AgriChain.Api.Endpoints;

public static class EndpointHelpers
{
    public static Guid? GetUserId(this ClaimsPrincipal user)
    {
        var idStr = user.FindFirstValue(ClaimTypes.NameIdentifier) ?? user.FindFirstValue("sub");
        return Guid.TryParse(idStr, out var id) ? id : null;
    }
}
