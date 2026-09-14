using System.Net.Http.Headers;
using System.Net.Http.Json;
using System.Text.Json;
using System.Text.Json.Nodes;

namespace AgriChain.Agent;

public class GroqClient(HttpClient httpClient, string apiKey)
{
    private const string ChatModel = "openai/gpt-oss-120b";
    private const string VisionModel = "qwen/qwen3.8-27b";
    private const string Endpoint = "https://api.groq.com/openai/v1/chat/completions";

    public bool IsConfigured => !string.IsNullOrWhiteSpace(apiKey);

    public async Task<JsonObject> ChatWithToolsAsync(JsonArray messages, JsonArray tools, CancellationToken ct = default)
    {
        var body = new JsonObject
        {
            ["model"] = ChatModel,
            ["messages"] = messages,
            ["tools"] = tools,
            ["tool_choice"] = "auto",
        };
        return await SendAsync(body, ct);
    }

    public async Task<string> VisionAsync(string prompt, string base64Image, CancellationToken ct = default)
    {
        var content = new JsonArray
        {
            new JsonObject { ["type"] = "text", ["text"] = prompt },
            new JsonObject
            {
                ["type"] = "image_url",
                ["image_url"] = new JsonObject { ["url"] = $"data:image/jpeg;base64,{base64Image}" },
            },
        };
        var body = new JsonObject
        {
            ["model"] = VisionModel,
            ["messages"] = new JsonArray
            {
                new JsonObject { ["role"] = "user", ["content"] = content },
            },
        };
        var response = await SendAsync(body, ct);
        return response["choices"]?[0]?["message"]?["content"]?.GetValue<string>() ?? string.Empty;
    }

    private async Task<JsonObject> SendAsync(JsonObject body, CancellationToken ct)
    {
        using var request = new HttpRequestMessage(HttpMethod.Post, Endpoint)
        {
            Content = JsonContent.Create<JsonNode>(body),
        };
        request.Headers.Authorization = new AuthenticationHeaderValue("Bearer", apiKey);

        var response = await httpClient.SendAsync(request, ct);
        var responseBody = await response.Content.ReadAsStringAsync(ct);
        if (!response.IsSuccessStatusCode)
            throw new InvalidOperationException($"Groq API error {(int)response.StatusCode}: {responseBody}");

        return JsonNode.Parse(responseBody)?.AsObject() ?? new JsonObject();
    }
}
