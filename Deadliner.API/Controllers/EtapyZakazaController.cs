using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Services;
using Deadliner.API.Models;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EtapyZakazaController : ControllerBase
{
    private readonly DeadlinerContext _context;
    private readonly DeadlineCalculatorService _calculator;

    public EtapyZakazaController(DeadlinerContext context, DeadlineCalculatorService calculator)
    {
        _context = context;
        _calculator = calculator;
    }

[HttpGet("zakaz/{zakazId}")]
public async Task<ActionResult<IEnumerable<EtapZakaza>>> GetZakaz(int zakazId)
    {
        return await _context.EtapyZakazov
            .Include(e => e.Etap)
            .Include(e => e.Sotrudnik)
            .Where(e => e.IdZakaza == zakazId)
            .OrderBy(e => e.Etap.PoryadkovyNomer)
            .ToListAsync();
    }
[HttpPost("{id}/complete")]
public async Task<IActionResult> Complete(int id)
    {
        var etap = await _context.EtapyZakazov
            .Include(e => e.Zakaz)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (etap == null) return NotFound();

        etap.FactData = DateOnly.FromDateTime(DateTime.Today);
        etap.Status = "завершён";

        etap.Zakaz.Status = _calculator.GetStatus(etap.Zakaz);

        await _context.SaveChangesAsync();
        return NoContent();
    }
}