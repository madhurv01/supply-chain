using System.Text;
using AgriChain.Agent;
using AgriChain.Agent.Mcp;
using AgriChain.Agent.Tools;
using AgriChain.Api.Endpoints;
using AgriChain.Api.Security;
using AgriChain.Domain;
using AgriChain.Infrastructure;
using AgriChain.Infrastructure.Services;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.AspNetCore.Identity;
using Microsoft.EntityFrameworkCore;
using Microsoft.IdentityModel.Tokens;

var builder = WebApplication.CreateBuilder(args);

// --- Database ---------------------------------------------------------
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection")
    ?? "Host=localhost;Database=agrichain;Username=postgres;Password=REPLACE_ME";

builder.Services.AddDbContext<AgriChainDbContext>(options =>
    options.UseNpgsql(connectionString));

// --- Identity + JWT -----------------------------------------------------
builder.Services
    .AddIdentityCore<AppUser>(options =>
    {
        options.Password.RequiredLength = 8;
        options.Password.RequireNonAlphanumeric = false;
        options.Password.RequireUppercase = false;
        options.User.RequireUniqueEmail = true;
    })
    .AddRoles<IdentityRole<Guid>>()
    .AddEntityFrameworkStores<AgriChainDbContext>()
    .AddSignInManager()
    .AddDefaultTokenProviders();

var jwtSecret = builder.Configuration["Jwt:Secret"]!;
var jwtIssuer = builder.Configuration["Jwt:Issuer"]!;

builder.Services.AddAuthentication(options =>
{
    options.DefaultAuthenticateScheme = JwtBearerDefaults.AuthenticationScheme;
    options.DefaultChallengeScheme = JwtBearerDefaults.AuthenticationScheme;
})
.AddJwtBearer(options =>
{
    options.TokenValidationParameters = new TokenValidationParameters
    {
        ValidateIssuer = true,
        ValidIssuer = jwtIssuer,
        ValidateAudience = true,
        ValidAudience = jwtIssuer,
        ValidateIssuerSigningKey = true,
        IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtSecret)),
        ValidateLifetime = true,
    };
});
builder.Services.AddAuthorization();
builder.Services.AddScoped<JwtTokenService>();

// --- CORS -----------------------------------------------------------
builder.Services.AddCors(options =>
{
    options.AddPolicy("AngularDev", policy =>
        policy.WithOrigins("http://localhost:4200")
            .AllowAnyHeader()
            .AllowAnyMethod());
});

// --- App services -----------------------------------------------------
builder.Services.AddScoped<MarketService>();
builder.Services.AddScoped<FarmService>();
builder.Services.AddScoped<InventoryService>();
builder.Services.AddScoped<LogisticsService>();
builder.Services.AddScoped<FinanceService>();
builder.Services.AddScoped<ForecastService>();
builder.Services.AddScoped<RoutingOptimizer>();
builder.Services.AddScoped<CropGradingService>();
builder.Services.AddScoped<AgentTools>();
builder.Services.AddScoped<AgentOrchestrator>();

builder.Services.AddHttpClient<GroqClient>();
builder.Services.AddScoped(sp =>
{
    var httpClient = sp.GetRequiredService<IHttpClientFactory>().CreateClient(nameof(GroqClient));
    var apiKey = builder.Configuration["Groq:ApiKey"] ?? Environment.GetEnvironmentVariable("GROQ_API_KEY") ?? "";
    return new GroqClient(httpClient, apiKey);
});

// --- MCP server (ModelContextProtocol.AspNetCore 2.2.0) ---------------
// Exposes the same tool set as AgentOrchestrator's tool-calling loop over MCP's HTTP/SSE transport.
builder.Services.AddMcpServer()
    .WithHttpTransport()
    .WithTools<AgriChainMcpTools>();

// --- Swagger / OpenAPI --------------------------------------------------
builder.Services.AddEndpointsApiExplorer();
builder.Services.AddSwaggerGen();

var app = builder.Build();

app.UseSwagger();
app.UseSwaggerUI();

app.UseCors("AngularDev");
app.UseAuthentication();
app.UseAuthorization();

app.MapGet("/health", () => Results.Ok(new { status = "ok" }));

app.MapAuthEndpoints();
app.MapMarketEndpoints();
app.MapForecastEndpoints();
app.MapFarmEndpoints();
app.MapInventoryEndpoints();
app.MapLogisticsEndpoints();
app.MapFinanceEndpoints();
app.MapAgentEndpoints();
app.MapGradingEndpoints();

app.MapMcp("/mcp");

// --- Demo user seed (dev only) -----------------------------------------
// Runs once at startup so the demo login keeps working out of the box. Guarded so a failed DB
// connection (e.g. the placeholder password in appsettings.Development.json) logs a warning
// instead of crashing the whole app at boot.
if (app.Environment.IsDevelopment())
{
    using var scope = app.Services.CreateScope();
    var logger = scope.ServiceProvider.GetRequiredService<ILogger<Program>>();
    try
    {
        var userManager = scope.ServiceProvider.GetRequiredService<UserManager<AppUser>>();
        const string demoEmail = "demo@agrichain.app";
        const string demoPassword = "Demo!2026Pass";

        var existing = await userManager.FindByEmailAsync(demoEmail);
        if (existing is null)
        {
            var demoUser = new AppUser { UserName = demoEmail, Email = demoEmail, EmailConfirmed = true };
            var result = await userManager.CreateAsync(demoUser, demoPassword);
            if (!result.Succeeded)
                logger.LogWarning("Could not seed demo user: {Errors}", string.Join(", ", result.Errors.Select(e => e.Description)));
        }
    }
    catch (Exception ex)
    {
        logger.LogWarning(ex, "Skipping demo user seeding — database is not reachable yet (expected until a real connection string is configured).");
    }
}

app.Run();
