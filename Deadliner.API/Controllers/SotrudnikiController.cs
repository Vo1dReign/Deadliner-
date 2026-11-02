using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;
using Deadliner.API.Services;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class SotrudnikiController : ControllerBase
{
    private readonly DeadlinerContext _context;
    private readonly PasswordHasherService _hasher;
    private readonly PhoneVerificationService _phoneService;

    public SotrudnikiController(
        DeadlinerContext context,
        PasswordHasherService hasher,
        PhoneVerificationService phoneService)
    {
        _context = context;
        _hasher = hasher;
        _phoneService = phoneService;
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
    public async Task<IActionResult> Create([FromBody] CreateSotrudnikDto dto)
    {
        if (dto == null)
            return BadRequest(new { message = "Данные не переданы" });

        if (string.IsNullOrWhiteSpace(dto.Fio))
            return BadRequest(new { message = "Укажите ФИО сотрудника" });

        if (string.IsNullOrWhiteSpace(dto.Login) || dto.Login.Trim().Length < 3)
            return BadRequest(new { message = "Логин должен содержать не менее 3 символов" });

        if (string.IsNullOrWhiteSpace(dto.Parol) || dto.Parol.Trim().Length < 6)
            return BadRequest(new { message = "Пароль должен содержать не менее 6 символов" });

        // Валидация и нормализация номера телефона
        string? normalizedPhone = _phoneService.NormalizePhone(dto.Telefon);
        if (!string.IsNullOrEmpty(dto.Telefon) && !_phoneService.IsValidBelarusPhone(dto.Telefon))
        {
            return BadRequest(new { message = "Некорректный номер телефона. Формат: +375 (XX) XXX-XX-XX" });
        }

        // Проверка подтверждения номера телефона:
        if (!string.IsNullOrEmpty(normalizedPhone))
        {
            // 1. Проверяем, был ли номер уже предварительно подтверждён через кнопку в интерфейсе (/api/auth/verify-code)
            bool isAlreadyVerified = _phoneService.IsPhoneVerified(normalizedPhone);

            // 2. Если номер еще не подтвержден в кэше, но передан код — проверяем код
            if (!isAlreadyVerified)
            {
                if (!string.IsNullOrEmpty(dto.VerificationCode))
                {
                    bool codeValid = _phoneService.VerifyCode(normalizedPhone, dto.VerificationCode);
                    if (!codeValid)
                    {
                        return BadRequest(new { message = "Неверный проверочный SMS-код или срок его действия истёк" });
                    }
                }
                else
                {
                    return BadRequest(new { message = "Номер телефона не подтверждён. Подтвердите номер SMS-кодом перед регистрацией." });
                }
            }
        }

        var cleanLogin = dto.Login.Trim().ToLower();

        // Проверка уникальности логина
        bool loginExists = await _context.Sotrudniki.AnyAsync(s => s.Login.ToLower() == cleanLogin);
        if (loginExists)
        {
            return BadRequest(new { message = $"Пользователь с логином «{dto.Login.Trim()}» уже зарегистрирован" });
        }

        // Проверка уникальности телефона
        if (!string.IsNullOrEmpty(normalizedPhone))
        {
            bool phoneExists = await _context.Sotrudniki.AnyAsync(s => s.Telefon == normalizedPhone);
            if (phoneExists)
            {
                return BadRequest(new { message = $"Сотрудник с номером {normalizedPhone} уже зарегистрирован" });
            }
        }

        // Создание учетной записи с хэшированием пароля PBKDF2
        var sotrudnik = new Sotrudnik
        {
            Fio = dto.Fio.Trim(),
            Telefon = normalizedPhone,
            IdRoli = dto.IdRoli > 0 ? dto.IdRoli : (dto.RolId > 0 ? dto.RolId : 1004),
            Login = dto.Login.Trim(),
            Parol = _hasher.HashPassword(dto.Parol.Trim()),
            Foto = dto.Foto
        };

        _context.Sotrudniki.Add(sotrudnik);
        await _context.SaveChangesAsync();

        return CreatedAtAction(nameof(GetById), new { id = sotrudnik.Id }, sotrudnik);
    }

    [HttpGet("roli")]
    public async Task<ActionResult<IEnumerable<Rol>>> GetRoles()
    {
        return await _context.Roli
            .Where(r => r.Id != 2 && r.Nazvanie != "Менеджер")
            .ToListAsync();
    }

    [HttpPut("{id}")]
    public async Task<IActionResult> Update(int id, [FromBody] UpdateSotrudnikDto updated)
    {
        var existing = await _context.Sotrudniki.FindAsync(id);
        if (existing == null)
            return NotFound(new { message = "Сотрудник не найден" });

        if (!string.IsNullOrWhiteSpace(updated.Fio))
            existing.Fio = updated.Fio.Trim();

        if (!string.IsNullOrWhiteSpace(updated.Telefon))
        {
            string? norm = _phoneService.NormalizePhone(updated.Telefon);
            if (!_phoneService.IsValidBelarusPhone(norm))
            {
                return BadRequest(new { message = "Некорректный номер телефона" });
            }

            // Проверяем уникальность телефона среди других сотрудников
            bool phoneConflict = await _context.Sotrudniki.AnyAsync(s => s.Id != id && s.Telefon == norm);
            if (phoneConflict)
            {
                return BadRequest(new { message = "Этот номер телефона уже используется другим сотрудником" });
            }

            existing.Telefon = norm;
        }

        if (updated.IdRoli > 0)
        {
            existing.IdRoli = updated.IdRoli;
        }

        if (!string.IsNullOrWhiteSpace(updated.Login))
        {
            var newLogin = updated.Login.Trim().ToLower();
            bool loginConflict = await _context.Sotrudniki.AnyAsync(s => s.Id != id && s.Login.ToLower() == newLogin);
            if (loginConflict)
            {
                return BadRequest(new { message = "Этот логин уже занят другим сотрудником" });
            }
            existing.Login = updated.Login.Trim();
        }

        // Хэширование пароля при смене
        if (!string.IsNullOrWhiteSpace(updated.Parol))
        {
            if (updated.Parol.Trim().Length < 6)
            {
                return BadRequest(new { message = "Пароль должен быть не менее 6 символов" });
            }
            existing.Parol = _hasher.HashPassword(updated.Parol.Trim());
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
        // Нельзя удалить главного администратора (Id = 1)
        if (id == 1)
        {
            return BadRequest(new { message = "Нельзя удалить учётную запись Главного Администратора" });
        }

        var sotrudnik = await _context.Sotrudniki.FindAsync(id);
        if (sotrudnik == null) 
            return NotFound();
            
        _context.Sotrudniki.Remove(sotrudnik);
        await _context.SaveChangesAsync();
        return NoContent();
    }
}

public class CreateSotrudnikDto
{
    public string Fio { get; set; } = string.Empty;
    public string? Telefon { get; set; }
    public int IdRoli { get; set; }
    public int RolId { get; set; }
    public string Login { get; set; } = string.Empty;
    public string Parol { get; set; } = string.Empty;
    public string? VerificationCode { get; set; }
    public string? Foto { get; set; }
}

public class UpdateSotrudnikDto
{
    public string? Fio { get; set; }
    public string? Telefon { get; set; }
    public int IdRoli { get; set; }
    public string? Login { get; set; }
    public string? Parol { get; set; }
    public string? Foto { get; set; }
}

public class PhotoDto
{
    public string? Foto { get; set; }
}
