using Deadliner.API.Controllers;
using Deadliner.API.Data;
using Deadliner.API.Models;
using Microsoft.AspNetCore.Http;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using Xunit;

namespace Deadliner.Tests;

/// <summary>
/// Интеграционные тесты ZakazyController с использованием изолированной InMemory базы данных (День 20 УП РСПО)
/// </summary>
public class ZakazyControllerTests
{
    private DeadlinerContext CreateInMemoryContext()
    {
        var options = new DbContextOptionsBuilder<DeadlinerContext>()
            .UseInMemoryDatabase(databaseName: Guid.NewGuid().ToString())
            .Options;

        var context = new DeadlinerContext(options);

        // Наполнение тестовыми начальными данными
        context.Klienty.Add(new Klient
        {
            Id = 1,
            FioNazvanie = "ООО Тестовый Заказчик",
            Telefon = "+375 (29) 111-22-33",
            AdresObekta = "г. Минск, пр. Победителей 10"
        });

        context.Roli.Add(new Rol { Id = 1, Nazvanie = "Администратор" });
        context.Sotrudniki.Add(new Sotrudnik
        {
            Id = 1,
            Fio = "Иванов И.И.",
            Login = "ivanov",
            Parol = "hash",
            IdRoli = 1
        });

        context.SaveChanges();
        return context;
    }

    private ZakazyController CreateController(DeadlinerContext context)
    {
        var controller = new ZakazyController(context)
        {
            ControllerContext = new ControllerContext
            {
                HttpContext = new DefaultHttpContext()
            }
        };
        return controller;
    }

    [Fact]
    public async Task Test_GetAllZakazy_ReturnsOkWithList()
    {
        var context = CreateInMemoryContext();
        var controller = CreateController(context);

        // Добавляем тестовый заказ
        context.Zakazy.Add(new Zakaz
        {
            IdKlienta = 1,
            IdMenedzhera = 1,
            DataPriema = DateOnly.FromDateTime(DateTime.Today),
            PlanDataOtgruzki = DateOnly.FromDateTime(DateTime.Today.AddDays(14)),
            Status = "в работе"
        });
        await context.SaveChangesAsync();

        var result = await controller.GetAll();

        var okResult = Assert.IsType<OkObjectResult>(result);
        Assert.NotNull(okResult.Value);
    }

    [Fact]
    public async Task Test_GetZakazById_ReturnsOrderWhenExists()
    {
        var context = CreateInMemoryContext();
        var controller = CreateController(context);

        var entry = context.Zakazy.Add(new Zakaz
        {
            IdKlienta = 1,
            IdMenedzhera = 1,
            DataPriema = DateOnly.FromDateTime(DateTime.Today),
            PlanDataOtgruzki = DateOnly.FromDateTime(DateTime.Today.AddDays(7)),
            Status = "в работе"
        });
        await context.SaveChangesAsync();

        int orderId = entry.Entity.Id;
        var actionResult = await controller.GetById(orderId);

        var order = actionResult.Value ?? (actionResult.Result as ObjectResult)?.Value as Zakaz;
        Assert.NotNull(order);
        Assert.Equal(orderId, order.Id);
    }

    [Fact]
    public async Task Test_GetZakazById_ReturnsNotFoundWhenMissing()
    {
        var context = CreateInMemoryContext();
        var controller = CreateController(context);

        var actionResult = await controller.GetById(9999);

        Assert.IsType<NotFoundResult>(actionResult.Result);
    }

    [Fact]
    public async Task Test_CreateZakaz_ValidData_ReturnsCreated()
    {
        var context = CreateInMemoryContext();
        var controller = CreateController(context);

        var newOrder = new Zakaz
        {
            IdKlienta = 1,
            IdMenedzhera = 1,
            DataPriema = DateOnly.FromDateTime(DateTime.Today),
            PlanDataOtgruzki = DateOnly.FromDateTime(DateTime.Today.AddDays(10)),
            SummaPredoplaty = 500
        };

        var actionResult = await controller.Create(newOrder);

        var createdResult = Assert.IsType<CreatedAtActionResult>(actionResult.Result);
        var createdOrder = Assert.IsType<Zakaz>(createdResult.Value);

        Assert.True(createdOrder.Id > 0);
        Assert.Equal("в работе", createdOrder.Status);

        // Проверяем наличие записи в базе
        var inDb = await context.Zakazy.FindAsync(createdOrder.Id);
        Assert.NotNull(inDb);
    }

    [Fact]
    public async Task Test_CreateZakaz_MissingClient_ReturnsBadRequest()
    {
        var context = CreateInMemoryContext();
        var controller = CreateController(context);

        var invalidOrder = new Zakaz
        {
            IdKlienta = 0, // Заказчик не выбран
            PlanDataOtgruzki = DateOnly.FromDateTime(DateTime.Today.AddDays(5))
        };

        var actionResult = await controller.Create(invalidOrder);

        Assert.IsType<BadRequestObjectResult>(actionResult.Result);
    }

    [Fact]
    public async Task Test_CreateZakaz_InvalidDates_ReturnsBadRequest()
    {
        var context = CreateInMemoryContext();
        var controller = CreateController(context);

        var invalidOrder = new Zakaz
        {
            IdKlienta = 1,
            DataPriema = DateOnly.FromDateTime(DateTime.Today),
            PlanDataOtgruzki = DateOnly.FromDateTime(DateTime.Today.AddDays(-3)) // Отгрузка раньше приёма!
        };

        var actionResult = await controller.Create(invalidOrder);

        Assert.IsType<BadRequestObjectResult>(actionResult.Result);
    }
}
