using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Services;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LoginController : ControllerBase
{
    private readonly DeadlinerContext _db;
    private readonly PasswordHasherService _hasher;
    private readonly PhoneVerificationService _phoneService;

    public LoginController(
        DeadlinerContext db, 
        PasswordHasherService hasher,
        PhoneVerificationService phoneService)
    {
        _db = db;
        _hasher = hasher;
        _phoneService = phoneService;
    }

    [HttpPost]
    public async Task<IActionResult> Login([FromBody] LoginRequest req)
    {
        if (req == null || string.IsNullOrWhiteSpace(req.Login) || string.IsNullOrWhiteSpace(req.Parol))
        {
            return BadRequest(new { message = "Введите логин и пароль" });
        }

        var loginInput = req.Login.Trim();
        var parolInput = req.Parol.Trim();

        // Нормализация номера телефона, если пользователь вводит телефон вместо логина
        var normalizedPhone = _phoneService.NormalizePhone(loginInput);
        var cleanDigits = new string(loginInput.Where(char.IsDigit).ToArray());

        // Ищем сотрудника по совпадению логина или номера телефона
        var sotrudnik = await _db.Sotrudniki
            .Include(s => s.Rol)
            .FirstOrDefaultAsync(s => 
                s.Login.ToLower() == loginInput.ToLower() ||
                (normalizedPhone != null && s.Telefon != null && s.Telefon == normalizedPhone) ||
                (s.Telefon != null && s.Telefon == loginInput) ||
                (!string.IsNullOrEmpty(cleanDigits) && cleanDigits.Length >= 7 && s.Telefon != null && s.Telefon.Contains(cleanDigits)));

        if (sotrudnik == null)
            return Unauthorized(new { message = "Неверный логин или пароль" });

        // Проверка пароля через криптографический PBKDF2 хэшер
        var (isValid, needsRehash) = _hasher.VerifyPassword(parolInput, sotrudnik.Parol);
        if (!isValid)
            return Unauthorized(new { message = "Неверный логин или пароль" });

        // Бесшовный перехэш: если пароль хранился в открытом виде (legacy), хэшируем его прямо сейчас!
        if (needsRehash)
        {
            sotrudnik.Parol = _hasher.HashPassword(parolInput);
            await _db.SaveChangesAsync();
        }

        return Ok(new
        {
            id = sotrudnik.Id,
            fio = sotrudnik.Fio,
            rol = sotrudnik.Rol?.Nazvanie ?? "Сотрудник",
            login = sotrudnik.Login,
            telefon = sotrudnik.Telefon,
            idRoli = sotrudnik.IdRoli,
            foto = sotrudnik.Foto
        });
    }
}

public class LoginRequest
{
    public string Login { get; set; } = string.Empty;
    public string Parol { get; set; } = string.Empty;
}
