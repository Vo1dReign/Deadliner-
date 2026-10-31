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
    
    /// <summary>
    /// Получение списка заказов с поддержкой фильтрации, поиска, сортировки и пагинации
    /// </summary>
    [HttpGet]
    public async Task<IActionResult> GetAll(
        [FromQuery] string? search = null,
        [FromQuery] string? status = null,
        [FromQuery] int? klientId = null,
        [FromQuery] int? menedzherId = null,
        [FromQuery] DateOnly? dateFrom = null,
        [FromQuery] DateOnly? dateTo = null,
        [FromQuery] string? dateType = "otgruzka",
        [FromQuery] string? urgency = null,
        [FromQuery] string? sortBy = "id",
        [FromQuery] string? sortDir = "desc",
        [FromQuery] int? page = null,
        [FromQuery] int? pageSize = null)
    {
        IQueryable<Zakaz> query = _context.Zakazy
            .Include(z => z.Klient)
            .Include(z => z.Menedzher)
                .ThenInclude(m => m!.Rol)
            .Include(z => z.EtapyZakaza);

        // 1. Полнотекстовый контекстный поиск (номер, клиент, телефон, адрес объекта, менеджер)
        if (!string.IsNullOrWhiteSpace(search))
        {
            var s = search.Trim().ToLower();
            query = query.Where(z =>
                z.Id.ToString().Contains(s) ||
                (z.Klient != null && (
                    z.Klient.FioNazvanie.ToLower().Contains(s) ||
                    (z.Klient.Telefon != null && z.Klient.Telefon.ToLower().Contains(s)) ||
                    (z.Klient.AdresObekta != null && z.Klient.AdresObekta.ToLower().Contains(s))
                )) ||
                (z.Menedzher != null && z.Menedzher.Fio.ToLower().Contains(s))
            );
        }

        // 2. Фильтрация по статусу
        if (!string.IsNullOrWhiteSpace(status) && !status.Equals("all", StringComparison.OrdinalIgnoreCase))
        {
            var st = status.Trim().ToLower();
            if (st == "в работе")
                query = query.Where(z => z.Status == "в работе");
            else if (st == "просрочен")
                query = query.Where(z => z.Status == "просрочен");
            else if (st == "готов к отгрузке")
                query = query.Where(z => z.Status == "готов к отгрузке");
            else if (st == "отгружен")
                query = query.Where(z => z.Status == "отгружен");
            else if (st == "завершён" || st == "завершен")
                query = query.Where(z => z.Status == "завершён" || z.Status == "завершен");
            else
                query = query.Where(z => z.Status.ToLower() == st);
        }

        // 3. Фильтрация по контрагенту (клиенту)
        if (klientId.HasValue && klientId.Value > 0)
        {
            query = query.Where(z => z.IdKlienta == klientId.Value);
        }

        // 4. Фильтрация по менеджеру проекта
        if (menedzherId.HasValue && menedzherId.Value > 0)
        {
            query = query.Where(z => z.IdMenedzhera == menedzherId.Value);
        }

        // 5. Фильтрация по календарному периоду (приём или отгрузка)
        bool filterByPriem = string.Equals(dateType, "priem", StringComparison.OrdinalIgnoreCase);
        if (filterByPriem)
        {
            if (dateFrom.HasValue)
                query = query.Where(z => z.DataPriema >= dateFrom.Value);
            if (dateTo.HasValue)
                query = query.Where(z => z.DataPriema <= dateTo.Value);
        }
        else
        {
            if (dateFrom.HasValue)
                query = query.Where(z => z.PlanDataOtgruzki >= dateFrom.Value);
            if (dateTo.HasValue)
                query = query.Where(z => z.PlanDataOtgruzki <= dateTo.Value);
        }

        // 6. Фильтрация по зонам срочности (зеленая, желтая, красная)
        if (!string.IsNullOrWhiteSpace(urgency))
        {
            var u = urgency.Trim().ToLower();
            var today = DateOnly.FromDateTime(DateTime.Today);
            var threshRed = today.AddDays(2);
            var threshYellowStart = today.AddDays(3);
            var threshYellowEnd = today.AddDays(7);

            if (u == "red")
            {
                query = query.Where(z => z.PlanDataOtgruzki <= threshRed || z.Status == "просрочен");
            }
            else if (u == "yellow")
            {
                query = query.Where(z => z.PlanDataOtgruzki >= threshYellowStart && z.PlanDataOtgruzki <= threshYellowEnd &&
                    z.Status != "просрочен" && z.Status != "отгружен" && z.Status != "завершён");
            }
            else if (u == "green")
            {
                query = query.Where(z => z.PlanDataOtgruzki > threshYellowEnd &&
                    z.Status != "просрочен" && z.Status != "отгружен" && z.Status != "завершён");
            }
        }

        // 7. Сортировка данных
        bool isAsc = string.Equals(sortDir, "asc", StringComparison.OrdinalIgnoreCase);
        query = (sortBy?.ToLower()) switch
        {
            "id" => isAsc ? query.OrderBy(z => z.Id) : query.OrderByDescending(z => z.Id),
            "klient" => isAsc 
                ? query.OrderBy(z => z.Klient != null ? z.Klient.FioNazvanie : "") 
                : query.OrderByDescending(z => z.Klient != null ? z.Klient.FioNazvanie : ""),
            "datapriema" or "datepriem" => isAsc ? query.OrderBy(z => z.DataPriema) : query.OrderByDescending(z => z.DataPriema),
            "plandataotgruzki" or "deadline" => isAsc ? query.OrderBy(z => z.PlanDataOtgruzki) : query.OrderByDescending(z => z.PlanDataOtgruzki),
            "status" => isAsc ? query.OrderBy(z => z.Status) : query.OrderByDescending(z => z.Status),
            _ => isAsc ? query.OrderBy(z => z.Id) : query.OrderByDescending(z => z.Id)
        };

        int totalCount = await query.CountAsync();
        Response.Headers["X-Total-Count"] = totalCount.ToString();

        // 8. Постраничная пагинация (если передан параметр page)
        if (page.HasValue && page.Value > 0)
        {
            int size = pageSize.HasValue && pageSize.Value > 0 ? pageSize.Value : 10;
            int pageNum = page.Value;
            int totalPages = (int)Math.Ceiling((double)totalCount / size);
            if (totalPages == 0) totalPages = 1;

            var items = await query.Skip((pageNum - 1) * size).Take(size).ToListAsync();

            return Ok(new PagedResult<Zakaz>
            {
                TotalCount = totalCount,
                Page = pageNum,
                PageSize = size,
                TotalPages = totalPages,
                Items = items
            });
        }

        // Если пагинация не запрошена — отдаем полный отфильтрованный список (обратная совместимость)
        var allItems = await query.ToListAsync();
        return Ok(allItems);
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Zakaz>> GetById(int id)
    {
        var zakaz = await _context.Zakazy
            .Include(z => z.Klient)
            .Include(z => z.Menedzher)
                .ThenInclude(m => m!.Rol)
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
        if (zakaz.IdKlienta <= 0)
            return BadRequest(new { message = "Выберите или укажите заказчика" });

        var today = DateOnly.FromDateTime(DateTime.Today);
        if (zakaz.DataPriema == default)
            zakaz.DataPriema = today;

        if (zakaz.PlanDataOtgruzki < zakaz.DataPriema)
        {
            return BadRequest(new { message = "Плановая дата отгрузки не может быть раньше даты приёма заказа" });
        }

        if (zakaz.SummaPredoplaty < 0)
            return BadRequest(new { message = "Сумма предоплаты не может быть отрицательной" });

        zakaz.Status = "в работе";

        _context.Zakazy.Add(zakaz);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = zakaz.Id }, zakaz);
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateZakazDto dto)
    {
        var existing = await _context.Zakazy
            .Include(z => z.Klient)
            .Include(z => z.Menedzher)
            .FirstOrDefaultAsync(z => z.Id == id);

        if (existing == null)
            return NotFound(new { message = "Заказ не найден" });

        if (dto.SotrudnikId.HasValue)
        {
            var user = await _context.Sotrudniki.Include(s => s.Rol).FirstOrDefaultAsync(s => s.Id == dto.SotrudnikId.Value);
            bool isSupervisor = user != null && (user.IdRoli == 1 || (user.Rol != null && user.Rol.Nazvanie.ToLower().Contains("начальник")));
            bool isProjectManager = existing.IdMenedzhera == dto.SotrudnikId.Value;
            if (!isSupervisor && !isProjectManager)
            {
                return StatusCode(403, new { message = "Редактировать заказ может только назначенный менеджер проекта или администратор." });
            }
        }

        var changes = new List<string>();

        int? newClientId = dto.IdKlienta ?? dto.KlientId;
        if (newClientId.HasValue && newClientId.Value != existing.IdKlienta)
        {
            var oldClient = existing.Klient?.FioNazvanie ?? $"#{existing.IdKlienta}";
            var newClient = await _context.Klienty.FindAsync(newClientId.Value);
            existing.IdKlienta = newClientId.Value;
            existing.Klient = newClient;
            changes.Add($"клиент: «{oldClient}» → «{newClient?.FioNazvanie ?? $"#{newClientId.Value}"}»");
        }

        int? newManagerId = dto.IdMenedzhera ?? dto.MenedzherId;
        if (newManagerId.HasValue && newManagerId.Value != existing.IdMenedzhera)
        {
            var oldMgr = existing.Menedzher?.Fio ?? $"#{existing.IdMenedzhera}";
            var newMgr = await _context.Sotrudniki.FindAsync(newManagerId.Value);
            existing.IdMenedzhera = newManagerId.Value;
            existing.Menedzher = newMgr;
            changes.Add($"менеджер проекта: «{oldMgr}» → «{newMgr?.Fio ?? $"#{newManagerId.Value}"}»");
        }

        if (dto.SummaPredoplaty.HasValue && dto.SummaPredoplaty.Value != existing.SummaPredoplaty)
        {
            changes.Add($"предоплата: {existing.SummaPredoplaty:N2} → {dto.SummaPredoplaty.Value:N2}");
            existing.SummaPredoplaty = dto.SummaPredoplaty.Value;
        }

        if (dto.PlanDataOtgruzki.HasValue && dto.PlanDataOtgruzki.Value != existing.PlanDataOtgruzki)
        {
            changes.Add($"дедлайн отгрузки: {existing.PlanDataOtgruzki:dd.MM.yyyy} → {dto.PlanDataOtgruzki.Value:dd.MM.yyyy}");
            existing.PlanDataOtgruzki = dto.PlanDataOtgruzki.Value;
        }

        if (!string.IsNullOrWhiteSpace(dto.Status) && dto.Status != existing.Status)
        {
            changes.Add($"статус: «{existing.Status}» → «{dto.Status}»");
            existing.Status = dto.Status;
            if ((dto.Status == "отгружен" || dto.Status == "завершён") && !existing.FactDataOtgruzki.HasValue)
            {
                existing.FactDataOtgruzki = DateOnly.FromDateTime(DateTime.Today);
            }
            else if (dto.Status == "в работе")
            {
                existing.FactDataOtgruzki = null;
            }
        }

        if (changes.Count > 0 || !string.IsNullOrWhiteSpace(dto.Note))
        {
            string desc = changes.Count > 0 
                ? $"Корректировка параметров заказа менеджером: {string.Join("; ", changes)}."
                : "Параметры заказа сохранены без изменений.";
            if (!string.IsNullOrWhiteSpace(dto.Note))
            {
                desc += $" Примечание: {dto.Note.Trim()}";
            }

            _context.ZhurnalIzmenenii.Add(new ZhurnalIzmenenii
            {
                IdZakaza = existing.Id,
                IdSotrudnika = dto.SotrudnikId ?? 1,
                DataIzmenenia = DateTime.Now,
                OpisanieIzmenenia = desc
            });
        }

        await _context.SaveChangesAsync();
        return Ok(existing);
    }

    [HttpPut("{id}/status")]
    public async Task<IActionResult> UpdateStatus(int id, [FromBody] StatusUpdateRequest req)
    {
        var zakaz = await _context.Zakazy
            .Include(z => z.Klient)
            .FirstOrDefaultAsync(z => z.Id == id);

        if (zakaz == null)
            return NotFound();

        if (req.SotrudnikId.HasValue)
        {
            var user = await _context.Sotrudniki.Include(s => s.Rol).FirstOrDefaultAsync(s => s.Id == req.SotrudnikId.Value);
            bool isSupervisor = user != null && (user.IdRoli == 1 || (user.Rol != null && user.Rol.Nazvanie.ToLower().Contains("начальник")));
            bool isProjectManager = zakaz.IdMenedzhera == req.SotrudnikId.Value;
            if (!isSupervisor && !isProjectManager)
            {
                return StatusCode(403, new { message = "Изменять статус заказа может только назначенный менеджер проекта или администратор." });
            }
        }

        string oldStatus = zakaz.Status;
        zakaz.Status = req.Status;

        if ((req.Status == "отгружен" || req.Status == "завершён") && !zakaz.FactDataOtgruzki.HasValue)
        {
            zakaz.FactDataOtgruzki = DateOnly.FromDateTime(DateTime.Today);
        }
        else if (req.Status == "в работе")
        {
            zakaz.FactDataOtgruzki = null;
        }

        string logText = $"Статус заказа изменён менеджером с «{oldStatus}» на «{req.Status}».";
        if (!string.IsNullOrWhiteSpace(req.Note))
        {
            logText += $" Комментарий: {req.Note.Trim()}";
        }

        // Фиксация в журнале аудита
        _context.ZhurnalIzmenenii.Add(new ZhurnalIzmenenii
        {
            IdZakaza = zakaz.Id,
            IdSotrudnika = req.SotrudnikId ?? 1,
            DataIzmenenia = DateTime.Now,
            OpisanieIzmenenia = logText
        });

        await _context.SaveChangesAsync();
        return NoContent();
    }

    [HttpDelete("{id}")]
    public async Task<IActionResult> Delete(int id, [FromQuery] int? sotrudnikId = null)
    {
        var zakaz = await _context.Zakazy
            .Include(z => z.Izdeliya)
            .Include(z => z.EtapyZakaza)
            .Include(z => z.ZhurnalIzmenenii)
            .FirstOrDefaultAsync(z => z.Id == id);

        if (zakaz == null)
            return NotFound();

        if (!sotrudnikId.HasValue)
        {
            return StatusCode(401, new { message = "Требуется авторизация сотрудника для удаления заказа." });
        }

        var user = await _context.Sotrudniki.Include(s => s.Rol).FirstOrDefaultAsync(s => s.Id == sotrudnikId.Value);
        if (user == null)
        {
            return StatusCode(401, new { message = "Сотрудник не найден в системе." });
        }

        bool isSupervisor = user.IdRoli == 1 || (user.Rol != null && user.Rol.Nazvanie.ToLower().Contains("начальник"));
        bool isProjectManager = zakaz.IdMenedzhera == sotrudnikId.Value;
        if (!isSupervisor && !isProjectManager)
        {
            return StatusCode(403, new { message = "Удалить заказ может только назначенный менеджер проекта или администратор." });
        }

        _context.ZhurnalIzmenenii.RemoveRange(zakaz.ZhurnalIzmenenii);
        _context.EtapyZakazov.RemoveRange(zakaz.EtapyZakaza);
        _context.Izdeliya.RemoveRange(zakaz.Izdeliya);
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
    public string? Note { get; set; }
}

public class UpdateZakazDto
{
    public int? IdKlienta { get; set; }
    public int? KlientId { get; set; }
    public int? IdMenedzhera { get; set; }
    public int? MenedzherId { get; set; }
    public decimal? SummaPredoplaty { get; set; }
    public DateOnly? PlanDataOtgruzki { get; set; }
    public string? Status { get; set; }
    public int? SotrudnikId { get; set; }
    public string? Note { get; set; }
}
