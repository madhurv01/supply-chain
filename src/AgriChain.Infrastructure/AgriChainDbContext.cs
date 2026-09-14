using AgriChain.Domain;
using Microsoft.AspNetCore.Identity;
using Microsoft.AspNetCore.Identity.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Infrastructure;

public class AgriChainDbContext(DbContextOptions<AgriChainDbContext> options)
    : IdentityDbContext<AppUser, IdentityRole<Guid>, Guid>(options)
{
    public DbSet<MarketPrice> MarketPrices => Set<MarketPrice>();
    public DbSet<Forecast> Forecasts => Set<Forecast>();
    public DbSet<FarmPlot> FarmPlots => Set<FarmPlot>();
    public DbSet<InventoryItem> InventoryItems => Set<InventoryItem>();
    public DbSet<Shipment> Shipments => Set<Shipment>();
    public DbSet<Sale> Sales => Set<Sale>();
    public DbSet<CropGrading> CropGradings => Set<CropGrading>();

    protected override void OnModelCreating(ModelBuilder builder)
    {
        base.OnModelCreating(builder);

        builder.Entity<MarketPrice>(e =>
        {
            e.ToTable("market_prices");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Commodity).HasColumnName("commodity");
            e.Property(x => x.State).HasColumnName("state");
            e.Property(x => x.Market).HasColumnName("market");
            e.Property(x => x.MinPrice).HasColumnName("min_price");
            e.Property(x => x.MaxPrice).HasColumnName("max_price");
            e.Property(x => x.ModalPrice).HasColumnName("modal_price");
            e.Property(x => x.PriceDate).HasColumnName("price_date");
        });

        builder.Entity<Forecast>(e =>
        {
            e.ToTable("forecasts");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.Kind).HasColumnName("kind");
            e.Property(x => x.QueryJson).HasColumnName("query").HasColumnType("jsonb");
            e.Property(x => x.Report).HasColumnName("report");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        builder.Entity<FarmPlot>(e =>
        {
            e.ToTable("farm_plots");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Commodity).HasColumnName("commodity");
            e.Property(x => x.PlotId).HasColumnName("plot_id");
            e.Property(x => x.QuantityPlanted).HasColumnName("quantity_planted");
            e.Property(x => x.DatePlanted).HasColumnName("date_planted");
            e.Property(x => x.ExpectedHarvestDate).HasColumnName("expected_harvest_date");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        builder.Entity<InventoryItem>(e =>
        {
            e.ToTable("inventory");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Commodity).HasColumnName("commodity");
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.Unit).HasColumnName("unit");
            e.HasIndex(x => x.Commodity).IsUnique();
        });

        builder.Entity<Shipment>(e =>
        {
            e.ToTable("shipments");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.TruckId).HasColumnName("truck_id");
            e.Property(x => x.Commodity).HasColumnName("commodity");
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.DestinationMarket).HasColumnName("destination_market");
            e.Property(x => x.OriginLat).HasColumnName("origin_lat");
            e.Property(x => x.OriginLon).HasColumnName("origin_lon");
            e.Property(x => x.DestinationLat).HasColumnName("destination_lat");
            e.Property(x => x.DestinationLon).HasColumnName("destination_lon");
            e.Property(x => x.CurrentLat).HasColumnName("current_lat");
            e.Property(x => x.CurrentLon).HasColumnName("current_lon");
            e.Property(x => x.Progress).HasColumnName("progress");
            e.Property(x => x.Status).HasColumnName("status");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });

        builder.Entity<Sale>(e =>
        {
            e.ToTable("sales");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.Commodity).HasColumnName("commodity");
            e.Property(x => x.Quantity).HasColumnName("quantity");
            e.Property(x => x.PricePerUnit).HasColumnName("price_per_unit");
            e.Property(x => x.TotalRevenue).HasColumnName("total_revenue");
            e.Property(x => x.Market).HasColumnName("market");
            e.Property(x => x.SoldAt).HasColumnName("sold_at");
        });

        builder.Entity<CropGrading>(e =>
        {
            e.ToTable("crop_gradings");
            e.HasKey(x => x.Id);
            e.Property(x => x.Id).HasColumnName("id");
            e.Property(x => x.UserId).HasColumnName("user_id");
            e.Property(x => x.ImageRef).HasColumnName("image_ref");
            e.Property(x => x.Commodity).HasColumnName("commodity");
            e.Property(x => x.Grade).HasColumnName("grade");
            e.Property(x => x.DefectsJson).HasColumnName("defects_json").HasColumnType("jsonb");
            e.Property(x => x.Confidence).HasColumnName("confidence");
            e.Property(x => x.CreatedAt).HasColumnName("created_at");
        });
    }
}
