using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class KlientyController : ControllerBase
{
    private readonly DeadlinerContext _context;

    public KlientyController(DeadlinerContext context)
    {
        _context = context;
    }
    
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Klient>>> GetAll()
    {
        return await _context.Klienty.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Klient>> GetById(int id)
    {
        var Klient = await _context.Klienty.FindAsync(id);

        if (Klient == null)
            return NotFound();

        return Klient;
    }

    [HttpPost]
    public async Task<ActionResult<Klient>> Create(Klient Klient)
    {
        _context.Klienty.Add(Klient);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new {id = Klient.Id}, Klient);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Klient Klient)
    {
        if(id != Klient.Id)
            return BadRequest();

        _context.Entry(Klient).State = EntityState.Modified;
        await _context.SaveChangesAsync();

        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var klient = await _context.Klienty.FindAsync(id);

        if (klient == null)
            return NotFound();

        _context.Klienty.Remove(klient);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}