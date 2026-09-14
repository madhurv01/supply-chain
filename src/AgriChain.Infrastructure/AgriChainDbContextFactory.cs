using System.IO;
using Microsoft.EntityFrameworkCore;
using Microsoft.EntityFrameworkCore.Design;
using Microsoft.Extensions.Configuration;

namespace AgriChain.Infrastructure;

/// <summary>
/// Design-time factory used by `dotnet ef migrations add`/`database update`.
/// Reads the real connection string from AgriChain.Api's appsettings (including
/// appsettings.Development.json) when available, so `database update` can run
/// against the actual database — falls back to a dummy value (fine for
/// `migrations add`, which never opens a connection) when the Api appsettings
/// aren't found, e.g. when run from a different working directory.
/// </summary>
public class AgriChainDbContextFactory : IDesignTimeDbContextFactory<AgriChainDbContext>
{
    public AgriChainDbContext CreateDbContext(string[] args)
    {
        var apiProjectPath = Path.Combine(Directory.GetCurrentDirectory(), "..", "AgriChain.Api");
        var configBuilder = new ConfigurationBuilder()
            .SetBasePath(Directory.Exists(apiProjectPath) ? apiProjectPath : Directory.GetCurrentDirectory())
            .AddJsonFile("appsettings.json", optional: true)
            .AddJsonFile("appsettings.Development.json", optional: true)
            .AddEnvironmentVariables();
        var config = configBuilder.Build();

        var connectionString = config.GetConnectionString("DefaultConnection")
            ?? "Host=localhost;Database=design_time_only;Username=postgres;Password=none";

        var optionsBuilder = new DbContextOptionsBuilder<AgriChainDbContext>();
        optionsBuilder.UseNpgsql(connectionString);
        return new AgriChainDbContext(optionsBuilder.Options);
    }
}
