using System.Text.Json;
using Deadliner.API.Controllers;
using Deadliner.API.Data;
using Deadliner.API.Models;
using Deadliner.API.Services;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Deadliner.Tests;

/// <summary>
/// Интеграционные тесты LoginController с проверкой PBKDF2 шифрования и авторизации по логину/телефону
/// </summary>
public class LoginControllerTests
{
    private readonly PasswordHasherService _hasher = new();
    private readonly PhoneVerificationService _phoneService;

    public LoginControllerTests()
    {
        var cache = new MemoryCache(new MemoryCacheOptions());
        var logger = NullLogger<PhoneVerificationService>.Instance;
        _phoneService = new PhoneVerificationService(cache, logger);
    }

    private DeadlinerContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<DeadlinerContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new DeadlinerContext(options);

        var adminRole = new Rol { Id = 1, Nazvanie = "Администратор" };
        context.Roli.Add(adminRole);

        // Добавляем администратора с PBKDF2 хэшированным паролем
        context.Sotrudniki.Add(new Sotrudnik
        {
            Id = 1,
            Fio = "Ревенко Евгений",
            Login = "admin",
            Parol = _hasher.HashPassword("admin123"),
            Telefon = "+375296093512",
            IdRoli = 1,
            Rol = adminRole
        });

        // Добавляем сотрудника со старым открытым паролем (legacy plaintext) для теста авто-миграции
        context.Sotrudniki.Add(new Sotrudnik
        {
            Id = 2,
            Fio = "Тестовый Мастер",
            Login = "master",
            Parol = "masterpass1", // Plaintext
            Telefon = "+375445556677",
            IdRoli = 1,
            Rol = adminRole
        });

        context.SaveChanges();
        return context;
    }

    [Fact]
    public async Task Test_Login_ValidCredentials_ReturnsOkAndUserInfo()
    {
        var context = CreateInMemoryContext();
        var controller = new LoginController(context, _hasher, _phoneService);

        var req = new LoginRequest { Login = "admin", Parol = "admin123" };
        var result = await controller.Login(req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        string json = JsonSerializer.Serialize(okResult.Value);
        using var doc = JsonDocument.Parse(json);
        Assert.Equal("admin", doc.RootElement.GetProperty("login").GetString());
        Assert.Equal("Ревенко Евгений", doc.RootElement.GetProperty("fio").GetString());
    }

    [Fact]
    public async Task Test_Login_InvalidPassword_ReturnsUnauthorized()
    {
        var context = CreateInMemoryContext();
        var controller = new LoginController(context, _hasher, _phoneService);

        var req = new LoginRequest { Login = "admin", Parol = "WrongPassword999" };
        var result = await controller.Login(req);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Test_Login_PhoneInsteadOfLogin_ReturnsOk()
    {
        var context = CreateInMemoryContext();
        var controller = new LoginController(context, _hasher, _phoneService);

        // Пользователь вводит телефон в формате +375 (29) 609-35-12 вместо логина
        var req = new LoginRequest { Login = "+375 (29) 609-35-12", Parol = "admin123" };
        var result = await controller.Login(req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        string json = JsonSerializer.Serialize(okResult.Value);
        using var doc = JsonDocument.Parse(json);
        Assert.Equal("admin", doc.RootElement.GetProperty("login").GetString());
    }

    [Fact]
    public async Task Test_Login_NonExistentUser_ReturnsUnauthorized()
    {
        var context = CreateInMemoryContext();
        var controller = new LoginController(context, _hasher, _phoneService);

        var req = new LoginRequest { Login = "unknown_user_404", Parol = "somepass" };
        var result = await controller.Login(req);

        Assert.IsType<UnauthorizedObjectResult>(result);
    }

    [Fact]
    public async Task Test_Login_LegacyPlaintextPassword_SeamlesslyRehashesToPbkdf2()
    {
        var context = CreateInMemoryContext();
        var controller = new LoginController(context, _hasher, _phoneService);

        // Вход пользователя с открытым паролем
        var req = new LoginRequest { Login = "master", Parol = "masterpass1" };
        var result = await controller.Login(req);

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);

        // Проверяем, что в БД пароль был автоматически перехэширован в PBKDF2
        var updatedUser = await context.Sotrudniki.FindAsync(2);
        Assert.NotNull(updatedUser);
        Assert.StartsWith("PBKDF2$100000$", updatedUser.Parol);
    }
}
