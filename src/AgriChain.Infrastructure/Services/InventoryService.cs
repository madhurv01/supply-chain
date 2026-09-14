using AgriChain.Domain;
using Microsoft.EntityFrameworkCore;

namespace AgriChain.Infrastructure.Services;

public class InventoryService(AgriChainDbContext db)
{
    public async Task<List<InventoryItem>> GetInventoryAsync() =>
        await db.InventoryItems.Where(i => i.Quantity > 0).ToListAsync();
}
