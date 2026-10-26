using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class LoginController : ControllerBase
{
    private readonly DeadlinerContext _db;

    public LoginController(DeadlinerContext db)
    {
        _db = db;
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

        // Поиск по точному совпадению логина или телефона, без учета регистра
        var cleanInput = new string(loginInput.Where(char.IsDigit).ToArray());

        var sotrudnik = await _db.Sotrudniki
            .Include(s => s.Rol)
            .FirstOrDefaultAsync(s => 
                (s.Login.ToLower() == loginInput.ToLower() || 
                 (s.Telefon != null && s.Telefon == loginInput) ||
                 (!string.IsNullOrEmpty(cleanInput) && cleanInput.Length >= 7 && s.Telefon != null && s.Telefon.Contains(cleanInput))) 
                && s.Parol == parolInput);

        if (sotrudnik == null)
            return Unauthorized(new { message = "Неверный логин или пароль" });

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
