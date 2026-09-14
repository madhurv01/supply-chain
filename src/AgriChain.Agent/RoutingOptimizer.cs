using AgriChain.Infrastructure;
using AgriChain.Infrastructure.Services;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Agent;

public class RoutingOptimizer(AgriChainDbContext db)
{
    private const double AvgTruckSpeedKmh = 40.0;
    private const double TransportCostPerKm = 15.0; // INR

    // Static perishability lookup: spoilage rate as a fraction of value lost per hour in transit.
    // Matched by commodity-name keyword; unknown commodities default to "medium".
    private static readonly (string[] Keywords, double SpoilageRatePerHour)[] PerishabilityTable =
    [
        (["leafy", "spinach", "lettuce", "cabbage", "coriander", "methi"], 0.02),
        (["tomato", "berry", "berries", "strawberry"], 0.015),
        (["banana", "mango", "papaya", "grape", "fruit", "apple", "orange", "guava"], 0.008),
        (["onion", "potato", "brinjal", "cauliflower", "cucumber", "vegetable"], 0.005),
        (["wheat", "rice", "grain", "pulse", "dal", "gram", "maize", "cereal", "millet"], 0.0005),
    ];
    private const double DefaultSpoilageRatePerHour = 0.006; // medium, for unmatched commodities

    private static double SpoilageRateFor(string commodity)
    {
        var lower = commodity.ToLowerInvariant();
        foreach (var (keywords, rate) in PerishabilityTable)
        {
            if (keywords.Any(lower.Contains))
                return rate;
        }
        return DefaultSpoilageRatePerHour;
    }

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

    public async Task<Dictionary<string, object?>> OptimizeShipmentRouteAsync(string commodity, decimal quantity)
    {
        var markets = await db.MarketPrices
            .Where(m => m.Commodity == commodity)
            .GroupBy(m => m.Market)
            .Select(g => new { Market = g.Key, ModalPrice = g.Average(x => x.ModalPrice) })
            .ToListAsync();

        if (markets.Count == 0)
            return new() { ["found"] = false, ["message"] = $"No market price data found for '{commodity}'." };

        var spoilageRate = SpoilageRateFor(commodity);
        var qty = (double)quantity;

        var scored = markets.Select(m =>
        {
            var (lat, lon) = LogisticsService.MarketToLatLon(m.Market);
            var distanceKm = HaversineKm(LogisticsService.WarehouseLat, LogisticsService.WarehouseLon, lat, lon);
            var transitHours = distanceKm / AvgTruckSpeedKmh;
            var price = (double)m.ModalPrice;
            var spoilageLossFraction = Math.Min(1.0, spoilageRate * transitHours);
            var transportCost = distanceKm * TransportCostPerKm;
            var netScore = price * qty * (1 - spoilageLossFraction) - transportCost;

            return new
            {
                Market = m.Market,
                Price = Math.Round(price, 2),
                DistanceKm = Math.Round(distanceKm, 1),
                TransitHours = Math.Round(transitHours, 1),
                SpoilageLossPct = Math.Round(spoilageLossFraction * 100, 2),
                TransportCost = Math.Round(transportCost, 2),
                NetScore = Math.Round(netScore, 2),
            };
        })
        .OrderByDescending(x => x.NetScore)
        .Take(3)
        .ToList();

        var recommendations = scored.Select(s => new Dictionary<string, object>
        {
            ["market"] = s.Market,
            ["price_per_unit"] = s.Price,
            ["distance_km"] = s.DistanceKm,
            ["estimated_transit_hours"] = s.TransitHours,
            ["estimated_spoilage_loss_pct"] = s.SpoilageLossPct,
            ["estimated_transport_cost"] = s.TransportCost,
            ["net_expected_value"] = s.NetScore,
            ["reasoning"] =
                $"At ₹{s.Price}/unit, {s.DistanceKm}km away (~{s.TransitHours}h transit), " +
                $"estimated spoilage loss {s.SpoilageLossPct}%, transport cost ₹{s.TransportCost}. " +
                $"Net expected value for {qty} units: ₹{s.NetScore}.",
        }).ToList();

        return new()
        {
            ["found"] = true,
            ["commodity"] = commodity,
            ["quantity"] = qty,
            ["spoilage_rate_per_hour"] = spoilageRate,
            ["top_recommendations"] = recommendations,
        };
    }
}
