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
        await EnsureStagesForOrderAsync(zakazId);

        return await _context.EtapyZakazov
            .Include(e => e.Etap)
                .ThenInclude(ep => ep.RolOtvetstvennogo)
            .Include(e => e.Sotrudnik)
                .ThenInclude(s => s!.Rol)
            .Where(e => e.IdZakaza == zakazId)
            .OrderBy(e => e.Etap != null ? e.Etap.PoryadkovyNomer : 0)
            .ToListAsync();
    }

    private async Task EnsureStagesForOrderAsync(int zakazId)
    {
        bool hasStages = await _context.EtapyZakazov.AnyAsync(e => e.IdZakaza == zakazId);
        if (hasStages) return;

        var zakaz = await _context.Zakazy.FindAsync(zakazId);
        if (zakaz == null) return;

        var catalog = await _context.EtapYProizvodstva
            .OrderBy(p => p.PoryadkovyNomer)
            .ToListAsync();

        if (catalog.Count == 0) return;

        int totalDays = Math.Max(1, zakaz.PlanDataOtgruzki.DayNumber - zakaz.DataPriema.DayNumber);
        double step = (double)totalDays / catalog.Count;

        for (int i = 0; i < catalog.Count; i++)
        {
            int addDays = (int)Math.Max(1, Math.Round((i + 1) * step));
            if (addDays > totalDays) addDays = totalDays;

            var newStage = new EtapZakaza
            {
                IdZakaza = zakaz.Id,
                IdEtapa = catalog[i].Id,
                Zakaz = zakaz,
                Etap = catalog[i],
                PlanData = zakaz.DataPriema.AddDays(addDays),
                Status = "не начат"
            };
            _context.EtapyZakazov.Add(newStage);
        }
        await _context.SaveChangesAsync();
    }

    /// <summary>
    /// Получение активных задач и мини-дедлайнов для конкретного сотрудника (или для цеха)
    /// </summary>
    [HttpGet("my/{sotrudnikId}")]
    public async Task<IActionResult> GetMyTasks(int sotrudnikId, [FromQuery] bool allForSupervisor = false)
    {
        var user = await _context.Sotrudniki
            .Include(s => s.Rol)
            .FirstOrDefaultAsync(s => s.Id == sotrudnikId);

        if (user == null)
            return NotFound(new { message = "Сотрудник не найден" });

        // Убеждаемся, что у активных заказов сгенерированы этапы
        var ordersWithoutStages = await _context.Zakazy
            .Where(z => z.Status != "отгружен" && z.Status != "завершён" && !_context.EtapyZakazov.Any(e => e.IdZakaza == z.Id))
            .Select(z => z.Id)
            .ToListAsync();

        foreach (var orderId in ordersWithoutStages)
        {
            await EnsureStagesForOrderAsync(orderId);
        }

        bool isSupervisor = user.IdRoli == 1 || (user.Rol != null && user.Rol.Nazvanie.ToLower().Contains("начальник"));

        var query = _context.EtapyZakazov
            .Include(e => e.Etap)
                .ThenInclude(ep => ep.RolOtvetstvennogo)
            .Include(e => e.Zakaz)
                .ThenInclude(z => z.Klient)
            .Include(e => e.Sotrudnik)
            .Where(e => e.Status != "завершён" && e.Zakaz.Status != "отгружен" && e.Zakaz.Status != "завершён");

        // Если не супервайзер или супервайзер смотрит именно свои личные задачи:
        if (!isSupervisor || !allForSupervisor)
        {
            query = query.Where(e => e.IdSotrudnika == sotrudnikId || 
                                    (e.IdSotrudnika == null && e.Etap.IdRoliOtvetstvennogo == user.IdRoli));
        }

        var list = await query
            .OrderBy(e => e.PlanData)
            .ThenBy(e => e.Etap.PoryadkovyNomer)
            .ToListAsync();

        var today = DateOnly.FromDateTime(DateTime.Today);

        var result = list.Select(e =>
        {
            int daysLeft = e.PlanData.DayNumber - today.DayNumber;
            bool canComplete = isSupervisor || 
                               (e.IdSotrudnika == sotrudnikId) || 
                               (e.IdSotrudnika == null && (e.Etap.IdRoliOtvetstvennogo == null || e.Etap.IdRoliOtvetstvennogo == user.IdRoli));

            return new
            {
                e.Id,
                e.IdZakaza,
                e.IdEtapa,
                e.IdSotrudnika,
                SotrudnikFio = e.Sotrudnik?.Fio ?? "Не назначен",
                PlanData = e.PlanData.ToString("yyyy-MM-dd"),
                FactData = e.FactData.HasValue ? e.FactData.Value.ToString("yyyy-MM-dd") : null,
                e.Status,
                EtapNazvanie = e.Etap?.Nazvanie ?? $"Этап #{e.IdEtapa}",
                Poryadok = e.Etap?.PoryadkovyNomer ?? 0,
                IdRoliOtvetstvennogo = e.Etap?.IdRoliOtvetstvennogo,
                RolNazvanie = e.Etap?.RolOtvetstvennogo?.Nazvanie ?? "Сотрудник цеха",
                ZakazNomer = e.Zakaz.Id,
                KlientFio = e.Zakaz.Klient?.FioNazvanie ?? "—",
                KlientTelefon = e.Zakaz.Klient?.Telefon ?? "—",
                ZakazStatus = e.Zakaz.Status,
                PlanDataOtgruzki = e.Zakaz.PlanDataOtgruzki.ToString("yyyy-MM-dd"),
                DaysLeft = daysLeft,
                CanComplete = canComplete,
                IsDirectAssignee = e.IdSotrudnika == sotrudnikId
            };
        });

        return Ok(result);
    }

    /// <summary>
    /// Назначение исполнителя и/или мини-дедлайна на этап
    /// </summary>
    [HttpPut("{id}")]
    public async Task<IActionResult> UpdateEtap(int id, [FromBody] UpdateEtapDto dto)
    {
        var etap = await _context.EtapyZakazov
            .Include(e => e.Etap)
            .Include(e => e.Zakaz)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (etap == null)
            return NotFound(new { message = "Этап заказа не найден" });

        bool changed = false;
        var changeParts = new List<string>();

        if (dto.IdSotrudnika.HasValue && etap.IdSotrudnika != dto.IdSotrudnika.Value)
        {
            etap.IdSotrudnika = dto.IdSotrudnika.Value;
            var emp = await _context.Sotrudniki.FindAsync(dto.IdSotrudnika.Value);
            etap.Sotrudnik = emp;
            changeParts.Add($"назначен исполнитель {emp?.Fio ?? $"#{dto.IdSotrudnika.Value}"}");
            changed = true;
        }

        if (dto.PlanData.HasValue && etap.PlanData != dto.PlanData.Value)
        {
            changeParts.Add($"изменён мини-дедлайн с {etap.PlanData:dd.MM.yyyy} на {dto.PlanData.Value:dd.MM.yyyy}");
            etap.PlanData = dto.PlanData.Value;
            changed = true;
        }

        if (!string.IsNullOrEmpty(dto.Status) && etap.Status != dto.Status)
        {
            changeParts.Add($"статус: {dto.Status}");
            etap.Status = dto.Status;
            changed = true;
        }

        if (changed)
        {
            _context.ZhurnalIzmenenii.Add(new ZhurnalIzmenenii
            {
                IdZakaza = etap.IdZakaza,
                IdSotrudnika = dto.IdSotrudnika ?? 1,
                DataIzmenenia = DateTime.Now,
                OpisanieIzmenenia = $"Этап «{etap.Etap.Nazvanie}»: {string.Join(", ", changeParts)}."
            });
        }

        await _context.SaveChangesAsync();
        return Ok(etap);
    }

    /// <summary>
    /// Завершение этапа сотрудником с разграничением прав и аудитом соблюдения мини-дедлайна
    /// </summary>
    [HttpPost("{id}/complete")]
    public async Task<IActionResult> Complete(int id, [FromBody] CompleteEtapDto? dto = null)
    {
        var etap = await _context.EtapyZakazov
            .Include(e => e.Etap)
                .ThenInclude(ep => ep.RolOtvetstvennogo)
            .Include(e => e.Zakaz)
            .Include(e => e.Sotrudnik)
            .FirstOrDefaultAsync(e => e.Id == id);

        if (etap == null)
            return NotFound(new { message = "Этап заказа не найден" });

        int actualSotrudnikId = dto?.SotrudnikId ?? etap.IdSotrudnika ?? 1;
        var performer = await _context.Sotrudniki
            .Include(s => s.Rol)
            .FirstOrDefaultAsync(s => s.Id == actualSotrudnikId);

        if (performer == null)
            return BadRequest(new { message = "Исполнитель не найден в системе" });

        // Проверка ролевого доступа:
        bool isSupervisor = performer.IdRoli == 1 || (performer.Rol != null && performer.Rol.Nazvanie.ToLower().Contains("начальник"));
        bool isDirectAssignee = etap.IdSotrudnika.HasValue && etap.IdSotrudnika.Value == performer.Id;
        bool isRoleMatch = etap.IdSotrudnika == null && 
            (etap.Etap.IdRoliOtvetstvennogo == null || etap.Etap.IdRoliOtvetstvennogo == performer.IdRoli);

        if (!isSupervisor && !isDirectAssignee && !isRoleMatch)
        {
            string requiredRole = etap.Etap.RolOtvetstvennogo?.Nazvanie ?? "ответственный специалист";
            return StatusCode(403, new { 
                message = $"Отклонено: завершить этот этап может только назначенный исполнитель или должность «{requiredRole}»." 
            });
        }

        var today = DateOnly.FromDateTime(DateTime.Today);
        etap.FactData = today;
        etap.Status = "завершён";

        if (etap.IdSotrudnika == null)
        {
            etap.IdSotrudnika = performer.Id;
            etap.Sotrudnik = performer;
        }

        // Вычисляем соблюдение мини-дедлайна
        string deadlineResult;
        if (today <= etap.PlanData)
        {
            deadlineResult = $"в срок (дедлайн: {etap.PlanData:dd.MM.yyyy})";
        }
        else
        {
            int overdueDays = today.DayNumber - etap.PlanData.DayNumber;
            deadlineResult = $"просрочен на {overdueDays} дн. (план был: {etap.PlanData:dd.MM.yyyy})";
        }

        string performerTitle = performer.Rol?.Nazvanie ?? "Сотрудник";
        var log = new ZhurnalIzmenenii
        {
            IdZakaza = etap.IdZakaza,
            IdSotrudnika = performer.Id,
            DataIzmenenia = DateTime.Now,
            OpisanieIzmenenia = $"Этап «{etap.Etap.Nazvanie}» завершён. Исполнитель: {performer.Fio} ({performerTitle}). Мини-дедлайн: {deadlineResult}."
        };
        _context.ZhurnalIzmenenii.Add(log);

        // Проверяем, все ли этапы заказа завершены
        var allStages = await _context.EtapyZakazov
            .Where(e => e.IdZakaza == etap.IdZakaza)
            .ToListAsync();

        bool allCompleted = allStages.All(s => s.Id == etap.Id || s.Status == "завершён");
        if (allCompleted)
        {
            etap.Zakaz.Status = "готов к отгрузке";
            _context.ZhurnalIzmenenii.Add(new ZhurnalIzmenenii
            {
                IdZakaza = etap.IdZakaza,
                IdSotrudnika = performer.Id,
                DataIzmenenia = DateTime.Now,
                OpisanieIzmenenia = "Все производственные этапы завершены. Заказ переведён в статус «готов к отгрузке»."
            });
        }
        else
        {
            etap.Zakaz.Status = _calculator.GetStatus(etap.Zakaz);
        }

        await _context.SaveChangesAsync();

        return Ok(new
        {
            success = true,
            status = etap.Status,
            factData = today.ToString("yyyy-MM-dd"),
            deadlineResult = deadlineResult,
            orderStatus = etap.Zakaz.Status
        });
    }
}

public class UpdateEtapDto
{
    public int? IdSotrudnika { get; set; }
    public DateOnly? PlanData { get; set; }
    public string? Status { get; set; }
}

public class CompleteEtapDto
{
    public int? SotrudnikId { get; set; }
}