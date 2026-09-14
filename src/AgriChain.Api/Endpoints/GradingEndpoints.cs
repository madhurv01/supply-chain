using AgriChain.Agent;

namespace AgriChain.Api.Endpoints;

public static class GradingEndpoints
{
    public static void MapGradingEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/grading/analyze", async (HttpRequest request, CropGradingService svc) =>
        {
            if (!request.HasFormContentType)
                return Results.BadRequest(new { message = "Expected multipart/form-data with an image file and commodity field." });

            var form = await request.ReadFormAsync();
            var file = form.Files.GetFile("image") ?? form.Files.FirstOrDefault();
            var commodity = form["commodity"].ToString();

            if (file is null || file.Length == 0)
                return Results.BadRequest(new { message = "No image file provided." });
            if (string.IsNullOrWhiteSpace(commodity))
                return Results.BadRequest(new { message = "commodity field is required." });

            using var ms = new MemoryStream();
            await file.CopyToAsync(ms);
            var base64 = Convert.ToBase64String(ms.ToArray());

            var userId = request.HttpContext.User.GetUserId();
            var result = await svc.GradeCropPhotoAsync(base64, commodity, userId);
            return Results.Ok(result);
        }).RequireAuthorization().DisableAntiforgery();
    }
}
