using System.Text.Json;
using AgriChain.Domain;
using AgriChain.Infrastructure;

namespace AgriChain.Agent;

public class CropGradingService(GroqClient groqClient, AgriChainDbContext db)
{
    private const string PromptTemplate =
        "You are an agricultural produce quality inspector. Examine this photo of {0}. " +
        "Respond with ONLY a JSON object (no prose, no markdown fences) of the exact shape: " +
        "{{\"grade\": \"A\"|\"B\"|\"C\", \"defects\": [string, ...], \"confidence\": number between 0 and 1, \"notes\": string}}. " +
        "Grade A = premium/export quality, no visible defects. Grade B = minor blemishes, sellable at standard market. " +
        "Grade C = significant defects, spoilage or damage, only fit for discount/processing sale.";

    public async Task<Dictionary<string, object?>> GradeCropPhotoAsync(string imageBase64, string commodity, Guid? userId)
    {
        if (!groqClient.IsConfigured)
        {
            return new()
            {
                ["success"] = false,
                ["message"] = "The AI agent is not configured yet. Set GROQ_API_KEY to enable crop grading.",
            };
        }

        var prompt = string.Format(PromptTemplate, commodity);
        string raw;
        try
        {
            raw = await groqClient.VisionAsync(prompt, imageBase64);
        }
        catch (Exception ex)
        {
            return new()
            {
                ["success"] = false,
                ["message"] = $"The AI agent's vision model provider returned an error: {ex.Message}",
            };
        }
        var jsonText = ExtractFirstJsonObject(raw);

        string grade = "B";
        List<string> defects = [];
        double confidence = 0.5;
        string notes = raw;

        if (jsonText is not null)
        {
            try
            {
                using var doc = JsonDocument.Parse(jsonText);
                var root = doc.RootElement;
                if (root.TryGetProperty("grade", out var g)) grade = g.GetString() ?? grade;
                if (root.TryGetProperty("defects", out var d) && d.ValueKind == JsonValueKind.Array)
                    defects = d.EnumerateArray().Select(x => x.GetString() ?? "").Where(x => x.Length > 0).ToList();
                if (root.TryGetProperty("confidence", out var c) && c.ValueKind is JsonValueKind.Number)
                    confidence = c.GetDouble();
                if (root.TryGetProperty("notes", out var n)) notes = n.GetString() ?? notes;
            }
            catch (JsonException)
            {
                // Fall back to defaults; raw model text is preserved in notes.
            }
        }

        var grading = new CropGrading
        {
            UserId = userId,
            ImageRef = "inline-upload",
            Commodity = commodity,
            Grade = grade,
            DefectsJson = JsonSerializer.Serialize(defects),
            Confidence = confidence,
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.CropGradings.Add(grading);
        await db.SaveChangesAsync();

        return new()
        {
            ["success"] = true,
            ["grade"] = grade,
            ["defects"] = defects,
            ["confidence"] = confidence,
            ["notes"] = notes,
            ["gradingId"] = grading.Id,
        };
    }

    private static string? ExtractFirstJsonObject(string text)
    {
        var start = text.IndexOf('{');
        if (start < 0) return null;
        var depth = 0;
        for (var i = start; i < text.Length; i++)
        {
            if (text[i] == '{') depth++;
            else if (text[i] == '}')
            {
                depth--;
                if (depth == 0) return text[start..(i + 1)];
            }
        }
        return null;
    }
}
