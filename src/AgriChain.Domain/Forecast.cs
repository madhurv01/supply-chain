namespace AgriChain.Domain;

public class Forecast
{
    public long Id { get; set; }
    public Guid? UserId { get; set; }
    public string Kind { get; set; } = string.Empty;
    public string QueryJson { get; set; } = "{}";
    public string Report { get; set; } = string.Empty;
    public DateTimeOffset CreatedAt { get; set; }
}
