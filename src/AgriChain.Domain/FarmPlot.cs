namespace AgriChain.Domain;

public class FarmPlot
{
    public long Id { get; set; }
    public string Commodity { get; set; } = string.Empty;
    public string PlotId { get; set; } = string.Empty;
    public decimal QuantityPlanted { get; set; }
    public DateOnly DatePlanted { get; set; }
    public DateOnly ExpectedHarvestDate { get; set; }
    public string Status { get; set; } = "GROWING";
    public DateTimeOffset CreatedAt { get; set; }
}
