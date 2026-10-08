using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class PorogiSrochnostiController : ControllerBase
{
    private readonly DeadlinerContext _context;

    public PorogiSrochnostiController(DeadlinerContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<PorogSrochnosti>>> GetAll()
    {
        return await _context.PorogiSrochnosti.ToListAsync();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, PorogSrochnosti porog)
    {
        if (id != porog.Id)
            return BadRequest();

        var existing = await _context.PorogiSrochnosti.FindAsync(id);
        if (existing == null)
            return NotFound();

        existing.DneyOt = porog.DneyOt;
        existing.DneyDo = porog.DneyDo;

        await _context.SaveChangesAsync();
        return NoContent();
    }
}