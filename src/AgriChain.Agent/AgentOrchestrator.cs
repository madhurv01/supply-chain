using System.Text.Json;
using System.Text.Json.Nodes;
using AgriChain.Agent.Tools;

namespace AgriChain.Agent;

public record ToolTrace(string Tool, JsonObject Arguments, object? Result);

public record AgentChatResult(string Reply, List<ToolTrace> ToolCalls);

public class AgentOrchestrator(GroqClient groqClient, AgentTools agentTools)
{
    private const string SystemPrompt =
        "You are Agri-Chain OS's AI operations agent. You help farm operators with price forecasting, " +
        "market analysis, farm plot management, inventory, logistics (shipments), route optimization, crop " +
        "grading, and finance/sales. You have tools to look up and act on all of this data directly — use " +
        "them instead of guessing. Be concise. Always use ₹ for currency. After answering, proactively " +
        "suggest a sensible next action when relevant (e.g. suggest shipping ready inventory, or logging a " +
        "sale for an arrived shipment).";

    private const int MaxIterations = 6;

    public async Task<AgentChatResult> RunChatAsync(Guid? userId, List<(string Role, string Content)> messages)
    {
        if (!groqClient.IsConfigured)
        {
            return new AgentChatResult(
                "The AI agent is not configured yet. Add a GROQ_API_KEY environment variable " +
                "(get a free key at console.groq.com) and restart the backend to enable it.",
                []);
        }

        var dispatch = agentTools.BuildDispatch(userId);
        var chatMessages = new JsonArray
        {
            new JsonObject { ["role"] = "system", ["content"] = SystemPrompt },
        };
        foreach (var (role, content) in messages)
            chatMessages.Add(new JsonObject { ["role"] = role, ["content"] = content });

        var trace = new List<ToolTrace>();

        for (var i = 0; i < MaxIterations; i++)
        {
            JsonObject response;
            try
            {
                response = await groqClient.ChatWithToolsAsync(chatMessages, AgentTools.Schema);
            }
            catch (Exception ex)
            {
                return new AgentChatResult(
                    $"The AI agent's model provider returned an error: {ex.Message}", trace);
            }
            var choice = response["choices"]?[0]?["message"]?.AsObject();
            if (choice is null)
                return new AgentChatResult("The AI agent returned an unexpected response.", trace);

            var toolCalls = choice["tool_calls"]?.AsArray();
            if (toolCalls is null || toolCalls.Count == 0)
            {
                var content = choice["content"]?.GetValue<string>() ?? "";
                return new AgentChatResult(content, trace);
            }

            var assistantMsg = new JsonObject
            {
                ["role"] = "assistant",
                ["content"] = choice["content"]?.GetValue<string>() ?? "",
                ["tool_calls"] = JsonNode.Parse(toolCalls.ToJsonString()),
            };
            chatMessages.Add(assistantMsg);

            foreach (var tcNode in toolCalls)
            {
                var tc = tcNode!.AsObject();
                var id = tc["id"]!.GetValue<string>();
                var name = tc["function"]!["name"]!.GetValue<string>();
                var argsRaw = tc["function"]!["arguments"]?.GetValue<string>() ?? "{}";

                JsonObject args;
                try
                {
                    args = JsonNode.Parse(argsRaw)?.AsObject() ?? [];
                }
                catch (JsonException)
                {
                    args = [];
                }

                object? result;
                if (!dispatch.TryGetValue(name, out var fn))
                {
                    result = new Dictionary<string, object> { ["error"] = $"Unknown tool '{name}'" };
                }
                else
                {
                    try
                    {
                        result = await fn(args);
                    }
                    catch (Exception ex)
                    {
                        result = new Dictionary<string, object> { ["error"] = ex.Message };
                    }
                }

                trace.Add(new ToolTrace(name, args, result));
                chatMessages.Add(new JsonObject
                {
                    ["role"] = "tool",
                    ["tool_call_id"] = id,
                    ["content"] = JsonSerializer.Serialize(result),
                });
            }
        }

        return new AgentChatResult("I reached the maximum number of tool-call steps. Please refine your request.", trace);
    }
}
