namespace AgriChain.Domain;

public class MarketPrice
{
    public long Id { get; set; }
    public string Commodity { get; set; } = string.Empty;
    public string State { get; set; } = string.Empty;
    public string Market { get; set; } = string.Empty;
    public decimal MinPrice { get; set; }
    public decimal MaxPrice { get; set; }
    public decimal ModalPrice { get; set; }
    public DateOnly PriceDate { get; set; }
}
