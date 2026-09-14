namespace AgriChain.Domain;

public class Shipment
{
    public long Id { get; set; }
    public string TruckId { get; set; } = string.Empty;
    public string Commodity { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string DestinationMarket { get; set; } = string.Empty;
    public double OriginLat { get; set; }
    public double OriginLon { get; set; }
    public double DestinationLat { get; set; }
    public double DestinationLon { get; set; }
    public double CurrentLat { get; set; }
    public double CurrentLon { get; set; }
    public decimal Progress { get; set; }
    public string Status { get; set; } = "IN_TRANSIT";
    public DateTimeOffset CreatedAt { get; set; }
}
