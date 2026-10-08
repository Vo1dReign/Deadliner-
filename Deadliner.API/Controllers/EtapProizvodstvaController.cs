using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class EtapProizvodstvaController : ControllerBase
{
    private readonly DeadlinerContext _context;

    public EtapProizvodstvaController(DeadlinerContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<EtapProizvodstva>>> GetAll()
    {
        return await _context.EtapYProizvodstva
            .Include(e => e.RolOtvetstvennogo)
            .OrderBy(e => e.PoryadkovyNomer)
            .ToListAsync();
    }

    [HttpPost]
    public async Task<ActionResult<EtapProizvodstva>> Create(EtapProizvodstva etap)
    {
        etap.RolOtvetstvennogo = null;
        _context.EtapYProizvodstva.Add(etap);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetAll), new { id = etap.Id }, etap);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var etap = await _context.EtapYProizvodstva.FindAsync(id);
        if (etap == null)
            return NotFound();

        _context.EtapYProizvodstva.Remove(etap);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}