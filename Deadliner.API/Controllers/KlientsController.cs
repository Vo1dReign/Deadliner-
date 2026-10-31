using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;
using Deadliner.API.Services;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class KlientyController : ControllerBase
{
    private readonly DeadlinerContext _context;
    private readonly PhoneVerificationService _phoneService;

    public KlientyController(DeadlinerContext context, PhoneVerificationService phoneService)
    {
        _context = context;
        _phoneService = phoneService;
    }
    
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Klient>>> GetAll()
    {
        return await _context.Klienty.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Klient>> GetById(int id)
    {
        var klient = await _context.Klienty.FindAsync(id);

        if (klient == null)
            return NotFound(new { message = "Заказчик не найден" });

        return klient;
    }

    [HttpPost]
    public async Task<ActionResult<Klient>> Create(Klient klient)
    {
        if (string.IsNullOrWhiteSpace(klient.FioNazvanie))
            return BadRequest(new { message = "Наименование или ФИО заказчика обязательно для заполнения" });

        klient.FioNazvanie = klient.FioNazvanie.Trim();
        klient.Telefon = _phoneService.NormalizePhone(klient.Telefon);
        if (!string.IsNullOrWhiteSpace(klient.AdresObekta))
            klient.AdresObekta = klient.AdresObekta.Trim();

        _context.Klienty.Add(klient);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = klient.Id }, klient);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Klient klient)
    {
        if (id != klient.Id)
            return BadRequest(new { message = "Несоответствие идентификатора заказчика" });

        if (string.IsNullOrWhiteSpace(klient.FioNazvanie))
            return BadRequest(new { message = "Наименование или ФИО заказчика не может быть пустым" });

        var existing = await _context.Klienty.FindAsync(id);
        if (existing == null)
            return NotFound(new { message = "Заказчик не найден" });

        existing.FioNazvanie = klient.FioNazvanie.Trim();
        existing.Telefon = _phoneService.NormalizePhone(klient.Telefon);
        existing.AdresObekta = klient.AdresObekta?.Trim();

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var klient = await _context.Klienty
            .Include(k => k.Zakazy)
            .FirstOrDefaultAsync(k => k.Id == id);

        if (klient == null)
            return NotFound(new { message = "Заказчик не найден" });

        if (klient.Zakazy.Any())
        {
            return BadRequest(new { message = "Нельзя удалить заказчика, у которого есть оформленные производственные заказы" });
        }

        _context.Klienty.Remove(klient);
        await _context.SaveChangesAsync();

        return NoContent();
    }
}
