using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class ZakazyController : ControllerBase
{
    private readonly DeadlinerContext _context;

    public ZakazyController(DeadlinerContext context)
    {
        _context = context;
    }
    
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Zakaz>>> GetAll()
    {
        return await _context.Zakazy
        .Include(z => z.Klient)
        .Include(z => z.EtapyZakaza)
        .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Zakaz>> GetById(int id)
    {
        var zakaz = await _context.Zakazy
        .Include(z => z.Klient)
        .Include(z => z.EtapyZakaza)
        .Include(z => z.Izdeliya)
        .FirstOrDefaultAsync(z => z.Id == id);

        if (zakaz == null)
            return NotFound();

        return zakaz;
    }

    [HttpPost]
    public async Task<ActionResult<Zakaz>> Create(Zakaz zakaz)
    {
        zakaz.DataPriema = DateOnly.FromDateTime(DateTime.Today);
        zakaz.Status = "в работе";

        _context.Zakazy.Add(zakaz);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new {id = zakaz.Id}, zakaz);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Zakaz zakaz)
    {
        if(id != zakaz.Id)
            return BadRequest();

        _context.Entry(zakaz).State = EntityState.Modified;

        try
        {
            await _context.SaveChangesAsync();
        }
        catch (DbUpdateConcurrencyException)
        {
            if (!_context.Zakazy.Any(z => z.Id == id))
                return NotFound();
            throw;
        }

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var zakaz = await _context.Zakazy.FindAsync(id);

        if (zakaz == null)
            return NotFound();

        _context.Zakazy.Remove(zakaz);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}