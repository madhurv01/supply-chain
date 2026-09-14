namespace AgriChain.Domain;

public class InventoryItem
{
    public long Id { get; set; }
    public string Commodity { get; set; } = string.Empty;
    public decimal Quantity { get; set; }
    public string Unit { get; set; } = "KG";
}
