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

    [HttpGet("roli")]
    public async Task<ActionResult<IEnumerable<Rol>>> GetRoles()
    {
        return await _context.Roli.ToListAsync();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Sotrudnik updated)
    {
        if (id != updated.Id)
            return BadRequest();

        var existing = await _context.Sotrudniki.FindAsync(id);
        if (existing == null)
            return NotFound();

        existing.Fio = updated.Fio;
        existing.Telefon = updated.Telefon;
        if (updated.IdRoli > 0)
        {
            existing.IdRoli = updated.IdRoli;
        }
        if (!string.IsNullOrWhiteSpace(updated.Login))
        {
            existing.Login = updated.Login;
        }
        if (!string.IsNullOrWhiteSpace(updated.Parol))
        {
            existing.Parol = updated.Parol;
        }
        if (updated.Foto != null)
        {
            existing.Foto = updated.Foto;
        }

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpPut("{id}/foto")]
    public async Task<IActionResult> UpdatePhoto(int id, [FromBody] PhotoDto dto)
    {
        var existing = await _context.Sotrudniki.FindAsync(id);
        if (existing == null)
            return NotFound();

        existing.Foto = dto.Foto;
        await _context.SaveChangesAsync();
        return NoContent();
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

public class PhotoDto
{
    public string? Foto { get; set; }
}