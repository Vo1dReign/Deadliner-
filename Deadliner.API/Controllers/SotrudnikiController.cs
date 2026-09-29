using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SotrudnikiController : ControllerBase
{
    private readonly DeadlinerContext _context;

    public SotrudnikiController(DeadlinerContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Sotrudnik>>> GetAll()
    {
        return await _context.Sotrudniki
            .Include(s => s.Rol)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Sotrudnik>> GetById(int id)
    {
        var sotrudnik = await _context.Sotrudniki
            .Include(s => s.Rol)
            .FirstOrDefaultAsync(s => s.Id == id);

        if (sotrudnik == null)
            return NotFound();

         return sotrudnik;
    }

    [HttpPost]
    public async Task<ActionResult<Sotrudnik>> Create(Sotrudnik sotrudnik)
    {
        _context.Sotrudniki.Add(sotrudnik);
        await _context.SaveChangesAsync();
        return CreatedAtAction(nameof(GetById), new {id = sotrudnik.Id}, sotrudnik);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var sotrudnik = await _context.Sotrudniki.FindAsync(id);
        if (sotrudnik == null) 
            return NotFound();
            _context.Sotrudniki.Remove(sotrudnik);
            await _context.SaveChangesAsync();
            return NoContent();
    }

}