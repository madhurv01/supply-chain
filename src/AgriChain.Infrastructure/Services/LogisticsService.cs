using System.Security.Cryptography;
using System.Text;
using AgriChain.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Infrastructure.Services;

public class LogisticsService(AgriChainDbContext db)
{
    public const double WarehouseLat = 21.1458;
    public const double WarehouseLon = 79.0882; // Nagpur, roughly central India
    private const double AvgTruckSpeedKmh = 40.0; // must match AgriChain.Agent.RoutingOptimizer's assumption

    private static double HaversineKm(double lat1, double lon1, double lat2, double lon2)
    {
        const double R = 6371.0;
        double ToRad(double d) => d * Math.PI / 180.0;
        var dLat = ToRad(lat2 - lat1);
        var dLon = ToRad(lon2 - lon1);
        var a = Math.Sin(dLat / 2) * Math.Sin(dLat / 2) +
                Math.Cos(ToRad(lat1)) * Math.Cos(ToRad(lat2)) * Math.Sin(dLon / 2) * Math.Sin(dLon / 2);
        var c = 2 * Math.Atan2(Math.Sqrt(a), Math.Sqrt(1 - a));
        return R * c;
    }

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

    public async Task<List<Shipment>> GetActiveShipmentsAsync()
    {
        await RecomputeInTransitProgressAsync();
        return await db.Shipments.Where(s => s.Status == "IN_TRANSIT" || s.Status == "ARRIVED")
            .OrderByDescending(s => s.CreatedAt).ToListAsync();
    }

    /// <summary>
    /// Progress is derived purely from real elapsed time since dispatch versus an estimated
    /// transit duration (great-circle distance / average truck speed) - not a manually
    /// stepped counter. This means shipments keep moving in real time whether or not anyone
    /// is watching the Logistics page, and every viewer/poll sees the same, physically
    /// consistent position - the same way a real fleet-tracking system would compute ETA.
    /// </summary>
    private async Task RecomputeInTransitProgressAsync()
    {
        var rows = await db.Shipments.Where(s => s.Status == "IN_TRANSIT").ToListAsync();
        if (rows.Count == 0)
            return;

        var now = DateTimeOffset.UtcNow;
        foreach (var row in rows)
        {
            var distanceKm = HaversineKm(row.OriginLat, row.OriginLon, row.DestinationLat, row.DestinationLon);
            var estimatedHours = Math.Max(distanceKm / AvgTruckSpeedKmh, 0.1);
            var elapsedHours = (now - row.CreatedAt).TotalHours;
            var newProgress = (decimal)Math.Clamp(elapsedHours / estimatedHours, 0.0, 1.0);

            row.CurrentLat = row.OriginLat + (row.DestinationLat - row.OriginLat) * (double)newProgress;
            row.CurrentLon = row.OriginLon + (row.DestinationLon - row.OriginLon) * (double)newProgress;
            row.Progress = newProgress;
            row.Status = newProgress >= 1.0m ? "ARRIVED" : "IN_TRANSIT";
        }
        await db.SaveChangesAsync();
    }

    public async Task<Dictionary<string, object>> UpdateAllShipmentLocationsAsync(decimal stepProgress = 0.02m)
    {
        // Kept for API back-compat; progress is now computed from real elapsed time on every
        // GetActiveShipmentsAsync call, so this manual step is effectively a no-op refresh.
        await RecomputeInTransitProgressAsync();
        return new() { ["updated"] = await db.Shipments.CountAsync(s => s.Status == "IN_TRANSIT" || s.Status == "ARRIVED") };
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
