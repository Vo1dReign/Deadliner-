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
            .OrderByDescending(z => z.Id)
            .ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Zakaz>> GetById(int id)
    {
        var zakaz = await _context.Zakazy
            .Include(z => z.Klient)
            .Include(z => z.Menedzher)
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

        return CreatedAtAction(nameof(GetById), new { id = zakaz.Id }, zakaz);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, Zakaz zakaz)
    {
        if (id != zakaz.Id)
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

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusUpdateRequest req)
    {
        var zakaz = await _context.Zakazy
            .Include(z => z.Klient)
            .FirstOrDefaultAsync(z => z.Id == id);

        if (zakaz == null)
            return NotFound();

        string oldStatus = zakaz.Status;
        zakaz.Status = req.Status;

        if ((req.Status == "отгружен" || req.Status == "завершён") && !zakaz.FactDataOtgruzki.HasValue)
        {
            zakaz.FactDataOtgruzki = DateOnly.FromDateTime(DateTime.Today);
        }

        // Фиксация в журнале аудита
        _context.ZhurnalIzmenenii.Add(new ZhurnalIzmenenii
        {
            IdZakaza = zakaz.Id,
            IdSotrudnika = req.SotrudnikId ?? 1,
            DataIzmenenia = DateTime.Now,
            OpisanieIzmenenia = $"Статус заказа изменён с «{oldStatus}» на «{req.Status}»."
        });

        await _context.SaveChangesAsync();
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

    /// <summary>
    /// Сводная статистика и KPI (текущий vs прошлый месяц, соблюдение сроков)
    /// </summary>
    [HttpGet("stats")]
    public async Task<IActionResult> GetStats()
    {
        var allOrders = await _context.Zakazy
            .Include(z => z.Klient)
            .ToListAsync();

        var today = DateOnly.FromDateTime(DateTime.Today);
        var firstDayCurrentMonth = new DateOnly(today.Year, today.Month, 1);
        var prevMonthDate = firstDayCurrentMonth.AddMonths(-1);
        var firstDayPrevMonth = new DateOnly(prevMonthDate.Year, prevMonthDate.Month, 1);
        var lastDayPrevMonth = firstDayCurrentMonth.AddDays(-1);

        int totalOrders = allOrders.Count;
        int activeOrders = allOrders.Count(o => o.Status != "отгружен" && o.Status != "завершён");
        int shippedOrders = allOrders.Count(o => o.Status == "отгружен" || o.Status == "завершён");
        int overdueOrders = allOrders.Count(o => o.Status == "просрочен" || 
            (o.FactDataOtgruzki.HasValue && o.FactDataOtgruzki.Value > o.PlanDataOtgruzki) ||
            (!o.FactDataOtgruzki.HasValue && today > o.PlanDataOtgruzki && o.Status != "отгружен" && o.Status != "завершён"));

        // Заказы текущего месяца (по дате отгрузки или дате приема)
        var curMonthOrders = allOrders.Where(o => o.DataPriema >= firstDayCurrentMonth || 
            (o.FactDataOtgruzki.HasValue && o.FactDataOtgruzki.Value >= firstDayCurrentMonth)).ToList();
        
        int curShipped = curMonthOrders.Count(o => o.Status == "отгружен" || o.Status == "завершён");
        int curOverdue = curMonthOrders.Count(o => 
            (o.FactDataOtgruzki.HasValue && o.FactDataOtgruzki.Value > o.PlanDataOtgruzki) ||
            (!o.FactDataOtgruzki.HasValue && today > o.PlanDataOtgruzki));
        int curOnTime = curShipped - curMonthOrders.Count(o => o.FactDataOtgruzki.HasValue && o.FactDataOtgruzki.Value > o.PlanDataOtgruzki);
        if (curOnTime < 0) curOnTime = 0;
        double curAdherence = curMonthOrders.Count > 0 
            ? Math.Round(((double)(curMonthOrders.Count - curOverdue) / curMonthOrders.Count) * 100, 1)
            : 100.0;

        // Заказы прошлого месяца
        var prevMonthOrders = allOrders.Where(o => 
            (o.DataPriema >= firstDayPrevMonth && o.DataPriema <= lastDayPrevMonth) ||
            (o.FactDataOtgruzki.HasValue && o.FactDataOtgruzki.Value >= firstDayPrevMonth && o.FactDataOtgruzki.Value <= lastDayPrevMonth)).ToList();

        int prevShipped = prevMonthOrders.Count(o => o.Status == "отгружен" || o.Status == "завершён");
        int prevOverdue = prevMonthOrders.Count(o => 
            (o.FactDataOtgruzki.HasValue && o.FactDataOtgruzki.Value > o.PlanDataOtgruzki) ||
            (!o.FactDataOtgruzki.HasValue && o.PlanDataOtgruzki < firstDayCurrentMonth));
        int prevOnTime = prevShipped - prevMonthOrders.Count(o => o.FactDataOtgruzki.HasValue && o.FactDataOtgruzki.Value > o.PlanDataOtgruzki);
        if (prevOnTime < 0) prevOnTime = 0;
        double prevAdherence = prevMonthOrders.Count > 0 
            ? Math.Round(((double)(prevMonthOrders.Count - prevOverdue) / prevMonthOrders.Count) * 100, 1)
            : 100.0;

        return Ok(new
        {
            totalOrders,
            activeOrders,
            shippedOrders,
            overdueOrders,
            currentMonth = new
            {
                name = firstDayCurrentMonth.ToString("MMMM yyyy", new System.Globalization.CultureInfo("ru-RU")),
                total = curMonthOrders.Count,
                shipped = curShipped,
                onTime = curOnTime,
                overdue = curOverdue,
                adherenceRate = curAdherence
            },
            prevMonth = new
            {
                name = firstDayPrevMonth.ToString("MMMM yyyy", new System.Globalization.CultureInfo("ru-RU")),
                total = prevMonthOrders.Count,
                shipped = prevShipped,
                onTime = prevOnTime,
                overdue = prevOverdue,
                adherenceRate = prevAdherence
            }
        });
    }

    /// <summary>
    /// Архив отгруженных и закрытых заказов предприятия
    /// </summary>
    [HttpGet("history")]
    public async Task<ActionResult<IEnumerable<object>>> GetHistory()
    {
        var shipped = await _context.Zakazy
            .Include(z => z.Klient)
            .Include(z => z.Menedzher)
            .Include(z => z.Izdeliya)
            .Where(z => z.Status == "отгружен" || z.Status == "завершён" || z.FactDataOtgruzki.HasValue)
            .OrderByDescending(z => z.FactDataOtgruzki ?? z.PlanDataOtgruzki)
            .ToListAsync();

        var result = shipped.Select(z =>
        {
            var factDate = z.FactDataOtgruzki ?? z.PlanDataOtgruzki;
            bool wasOnTime = factDate <= z.PlanDataOtgruzki;
            int delayDays = wasOnTime ? 0 : factDate.DayNumber - z.PlanDataOtgruzki.DayNumber;

            return new
            {
                z.Id,
                z.DataPriema,
                z.PlanDataOtgruzki,
                FactDataOtgruzki = z.FactDataOtgruzki,
                z.SummaPredoplaty,
                z.Status,
                KlientFio = z.Klient?.FioNazvanie ?? "—",
                KlientTelefon = z.Klient?.Telefon ?? "—",
                MenedzherFio = z.Menedzher?.Fio ?? "—",
                IzdeliyaCount = z.Izdeliya.Count,
                IzdeliyaList = string.Join(", ", z.Izdeliya.Select(i => i.Naimenovanie)),
                WasOnTime = wasOnTime,
                DelayDays = delayDays
            };
        });

        return Ok(result);
    }
}

public class StatusUpdateRequest
{
    public string Status { get; set; } = string.Empty;
    public int? SotrudnikId { get; set; }
}