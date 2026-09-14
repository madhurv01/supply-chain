namespace AgriChain.Domain;

public class Sale
{
    public long Id { get; set; }
    public string Commodity { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public decimal PricePerUnit { get; set; }
    public decimal TotalRevenue { get; set; }
    public string Market { get; set; } = string.Empty;
    public DateTimeOffset SoldAt { get; set; }
}
