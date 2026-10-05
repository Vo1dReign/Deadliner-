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
        var sotrudnik = await _db.Sotrudniki
            .Include(s => s.Rol)
            .FirstOrDefaultAsync(s => s.Login == req.Login && s.Parol == req.Parol);

        if (sotrudnik == null)
            return Unauthorized(new { message = "Неверный логин или пароль" });

        return Ok(new
        {
            id = sotrudnik.Id,
            fio = sotrudnik.Fio,
            rol = sotrudnik.Rol.Nazvanie
        });
    }
}

public class LoginRequest
{
    public string Login { get; set; } = string.Empty;
    public string Parol { get; set; } = string.Empty;
}