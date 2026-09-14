using AgriChain.Api.Security;
using AgriChain.Domain;
using Microsoft.AspNetCore.Identity;

namespace AgriChain.Api.Endpoints;

public record RegisterRequest(string Email, string Password);
public record LoginRequest(string Email, string Password);
public record AuthResponse(string Token, string Email, string UserId);

public static class AuthEndpoints
{
    public static void MapAuthEndpoints(this IEndpointRouteBuilder app)
    {
        var group = app.MapGroup("/auth");

        group.MapPost("/register", async (RegisterRequest req, UserManager<AppUser> userManager, JwtTokenService jwt) =>
        {
            var user = new AppUser { UserName = req.Email, Email = req.Email };
            var result = await userManager.CreateAsync(user, req.Password);
            if (!result.Succeeded)
                return Results.BadRequest(new { errors = result.Errors.Select(e => e.Description) });

            var token = jwt.CreateToken(user);
            return Results.Ok(new AuthResponse(token, user.Email!, user.Id.ToString()));
        });

        group.MapPost("/login", async (LoginRequest req, UserManager<AppUser> userManager, JwtTokenService jwt) =>
        {
            var user = await userManager.FindByEmailAsync(req.Email);
            if (user is null || !await userManager.CheckPasswordAsync(user, req.Password))
                return Results.Unauthorized();

            var token = jwt.CreateToken(user);
            return Results.Ok(new AuthResponse(token, user.Email!, user.Id.ToString()));
        });
    }
}
