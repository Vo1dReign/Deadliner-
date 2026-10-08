using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ZhurnalIzmeneniiController : ControllerBase
{
    private readonly DeadlinerContext _context;

    public ZhurnalIzmeneniiController(DeadlinerContext context)
    {
        _context = context;
    }

    [HttpGet("zakaz/{zakazId}")]
    public async Task<ActionResult<IEnumerable<ZhurnalIzmenenii>>> GetByZakaz(int zakazId)
    {
        return await _context.ZhurnalIzmenenii
            .Include(z => z.Sotrudnik)
            .Where(z => z.IdZakaza == zakazId)
            .OrderByDescending(z => z.DataIzmenenia)
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<ZhurnalIzmenenii>> Create(ZhurnalIzmenenii log)
    {
        log.DataIzmenenia = DateTime.Now;
        log.Zakaz = null!;
        log.Sotrudnik = null!;

        _context.ZhurnalIzmenenii.Add(log);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetByZakaz), new { zakazId = log.IdZakaza }, log);
    }
}