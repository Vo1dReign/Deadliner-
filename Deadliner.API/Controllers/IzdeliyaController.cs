using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class IzdeliyaController : ControllerBase
{
    private readonly DeadlinerContext _db;

    public IzdeliyaController(DeadlinerContext db)
    {
        _db = db;
    }

    [HttpGet]
    public async Task<IActionResult> GetByZakaz([FromQuery] int zakazId)
    {
        var items = await _db.Izdeliya
            .Where(i => i.IdZakaza == zakazId || i.ZakazId == zakazId)
            .ToListAsync();
        return Ok(items);
    }

    [HttpPost]
    public async Task<IActionResult> Create([FromBody] Izdelie item)
    {
        if (item == null)
        {
            return BadRequest(new { message = "Данные изделия не переданы" });
        }

        if (item.ZakazId <= 0 && item.IdZakaza > 0) item.ZakazId = item.IdZakaza;
        if (item.IdZakaza <= 0 && item.ZakazId > 0) item.IdZakaza = item.ZakazId;

        if (item.ZakazId <= 0)
        {
            return BadRequest(new { message = "Не указан идентификатор заказа (zakazId)" });
        }

        var zakazExists = await _db.Zakazy.AnyAsync(z => z.Id == item.ZakazId);
        if (!zakazExists)
        {
            return NotFound(new { message = $"Заказ с ID {item.ZakazId} не найден в базе данных" });
        }

        if (string.IsNullOrWhiteSpace(item.Naimenovanie))
        {
            return BadRequest(new { message = "Наименование изделия обязательно для заполнения" });
        }

        if (item.Kolichestvo <= 0)
        {
            item.Kolichestvo = 1;
        }

        item.Zakaz = null;

        _db.Izdeliya.Add(item);
        await _db.SaveChangesAsync();
        return Ok(item);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] Izdelie item)
    {
        var existing = await _db.Izdeliya.FindAsync(id);
        if (existing == null) return NotFound();

        existing.Naimenovanie = item.Naimenovanie;
        existing.Kolichestvo = item.Kolichestvo > 0 ? item.Kolichestvo : 1;
        existing.Harakteristiki = item.Harakteristiki;

        await _db.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id)
    {
        var item = await _db.Izdeliya.FindAsync(id);
        if (item == null) return NotFound();

        _db.Izdeliya.Remove(item);
        await _db.SaveChangesAsync();
        return Ok();
    }
}
