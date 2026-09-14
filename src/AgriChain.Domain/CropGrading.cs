namespace AgriChain.Domain;

public class CropGrading
{
    public long Id { get; set; }
    public Guid? UserId { get; set; }
    public string ImageRef { get; set; } = string.Empty;
    public string Commodity { get; set; } = string.Empty;
    public string Grade { get; set; } = string.Empty;
    public string DefectsJson { get; set; } = "[]";
    public double Confidence { get; set; }
    public DateTimeOffset CreatedAt { get; set; }
}
