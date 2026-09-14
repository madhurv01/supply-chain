using System.Security.Cryptography;
using System.Text;
using AgriChain.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Infrastructure.Services;

public class LogisticsService(AgriChainDbContext db)
{
    public const double WarehouseLat = 21.1458;
    public const double WarehouseLon = 79.0882; // Nagpur, roughly central India

    /// <summary>
    /// Deterministically map a market name to a plausible lat/lon within India's bounding box.
    /// Ported exactly from backend/services/logistics.py's _market_to_latlon (MD5 hash based).
    /// </summary>
    public static (double Lat, double Lon) MarketToLatLon(string marketName)
    {
        var digest = MD5.HashData(Encoding.UTF8.GetBytes(marketName));
        var hex = Convert.ToHexString(digest).ToLowerInvariant();
        var fracLat = Convert.ToUInt32(hex[..8], 16) / (double)0xFFFFFFFF;
        var fracLon = Convert.ToUInt32(hex[8..16], 16) / (double)0xFFFFFFFF;
        var lat = 8.0 + fracLat * (35.0 - 8.0);
        var lon = 68.0 + fracLon * (97.0 - 68.0);
        return (lat, lon);
    }

    public async Task<Dictionary<string, object?>> CreateShipmentAsync(string truckId, string commodity, decimal quantity, string destinationMarket)
    {
        var (destLat, destLon) = MarketToLatLon(destinationMarket);

        var existing = await db.InventoryItems.FirstOrDefaultAsync(i => i.Commodity == commodity);
        if (existing is null || existing.Quantity < quantity)
            return new() { ["success"] = false, ["message"] = "Insufficient inventory for this commodity." };

        existing.Quantity -= quantity;

        var shipment = new Shipment
        {
            TruckId = truckId,
            Commodity = commodity,
            Quantity = quantity,
            DestinationMarket = destinationMarket,
            OriginLat = WarehouseLat,
            OriginLon = WarehouseLon,
            DestinationLat = destLat,
            DestinationLon = destLon,
            CurrentLat = WarehouseLat,
            CurrentLon = WarehouseLon,
            Progress = 0,
            Status = "IN_TRANSIT",
            CreatedAt = DateTimeOffset.UtcNow,
        };
        db.Shipments.Add(shipment);
        await db.SaveChangesAsync();
        return new() { ["success"] = true, ["shipment"] = shipment };
    }

    public async Task<List<Shipment>> GetActiveShipmentsAsync() =>
        await db.Shipments.Where(s => s.Status == "IN_TRANSIT" || s.Status == "ARRIVED")
            .OrderByDescending(s => s.CreatedAt).ToListAsync();

    public async Task<Dictionary<string, object>> UpdateAllShipmentLocationsAsync(decimal stepProgress = 0.02m)
    {
        var rows = await db.Shipments.Where(s => s.Status == "IN_TRANSIT").ToListAsync();
        foreach (var row in rows)
        {
            var newProgress = Math.Min(1.0m, row.Progress + stepProgress);
            row.CurrentLat = row.OriginLat + (row.DestinationLat - row.OriginLat) * (double)newProgress;
            row.CurrentLon = row.OriginLon + (row.DestinationLon - row.OriginLon) * (double)newProgress;
            row.Progress = newProgress;
            row.Status = newProgress >= 1.0m ? "ARRIVED" : "IN_TRANSIT";
        }
        await db.SaveChangesAsync();
        return new() { ["updated"] = rows.Count };
    }

    public async Task<Dictionary<string, object>> DeliverShipmentAsync(long shipmentId)
    {
        var shipment = await db.Shipments.FindAsync(shipmentId);
        if (shipment is not null)
        {
            shipment.Status = "SOLD";
            await db.SaveChangesAsync();
        }
        return new() { ["success"] = true };
    }
}
