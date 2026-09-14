using AgriChain.Agent;

namespace AgriChain.Api.Endpoints;

public record ChatMessage(string Role, string Content);
public record AgentChatRequest(List<ChatMessage> Messages);

public static class AgentEndpoints
{
    public static void MapAgentEndpoints(this IEndpointRouteBuilder app)
    {
        app.MapPost("/agent/chat", async (AgentChatRequest req, HttpContext ctx, AgentOrchestrator orchestrator) =>
        {
            var userId = ctx.User.GetUserId();
            var result = await orchestrator.RunChatAsync(userId, req.Messages.Select(m => (m.Role, m.Content)).ToList());
            return Results.Ok(new
            {
                reply = result.Reply,
                toolCalls = result.ToolCalls.Select(t => new { name = t.Tool, args = t.Arguments, result = t.Result }),
            });
        }).RequireAuthorization();
    }
}
