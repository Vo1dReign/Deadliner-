using Deadliner.API.Models;
using Deadliner.API.Services;
using Xunit;

namespace Deadliner.Tests;

/// <summary>
/// Модульные тесты алгоритмов расчета сроков и порогов (День 20 УП РСПО)
/// Сервис: DeadlineCalculatorService
/// </summary>
public class DeadlineCalculatorServiceTests
{
    private readonly DeadlineCalculatorService _calculator = new();

    private readonly List<PorogSrochnosti> _standardThresholds = new()
    {
        new PorogSrochnosti { Id = 1, Cvet = "зелёный", DneyOt = 8, DneyDo = 999 },
        new PorogSrochnosti { Id = 2, Cvet = "жёлтый", DneyOt = 3, DneyDo = 7 },
        new PorogSrochnosti { Id = 3, Cvet = "красный", DneyOt = 0, DneyDo = 2 }
    };

    [Fact]
    public void Test_CalculateDaysLeft_NormalDate()
    {
        // Плановая отгрузка через 10 дней от текущей даты
        var today = DateOnly.FromDateTime(DateTime.Today);
        var planDate = today.AddDays(10);

        int daysLeft = _calculator.GetDaysLeft(planDate);

        Assert.Equal(10, daysLeft);
    }

    [Fact]
    public void Test_CalculateDaysLeft_Today()
    {
        // Граничное условие дедлайна «сегодня» (остаток 0 дней)
        var today = DateOnly.FromDateTime(DateTime.Today);

        int daysLeft = _calculator.GetDaysLeft(today);

        Assert.Equal(0, daysLeft);
    }

    [Fact]
    public void Test_CalculateDaysLeft_Overdue()
    {
        // Плановая отгрузка была 5 дней назад (просрочка)
        var today = DateOnly.FromDateTime(DateTime.Today);
        var planDate = today.AddDays(-5);

        int daysLeft = _calculator.GetDaysLeft(planDate);

        Assert.Equal(-5, daysLeft);
    }

    [Fact]
    public void Test_CalculateThreshold_Green()
    {
        // Запас 12 дней должен попасть в зеленую зону (порог от 8 дней)
        int daysLeft = 12;

        string color = _calculator.GetColor(daysLeft, _standardThresholds);

        Assert.Equal("зелёный", color);
    }

    [Fact]
    public void Test_CalculateThreshold_Yellow()
    {
        // Запас 5 дней должен попасть в жёлтую зону внимания (3..7 дней)
        int daysLeft = 5;

        string color = _calculator.GetColor(daysLeft, _standardThresholds);

        Assert.Equal("жёлтый", color);
    }

    [Fact]
    public void Test_CalculateThreshold_Red()
    {
        // 1 день — критический срок (0..2 дня), красный статус
        int criticalDays = 1;
        string criticalColor = _calculator.GetColor(criticalDays, _standardThresholds);
        Assert.Equal("красный", criticalColor);

        // Отрицательное число дней (просрочка) — безусловно красный статус
        int overdueDays = -4;
        string overdueColor = _calculator.GetColor(overdueDays, _standardThresholds);
        Assert.Equal("красный", overdueColor);
    }

    [Fact]
    public void Test_CalculateStatus_Shipped()
    {
        var zakaz = new Zakaz
        {
            Id = 1,
            PlanDataOtgruzki = DateOnly.FromDateTime(DateTime.Today.AddDays(-2)),
            FactDataOtgruzki = DateOnly.FromDateTime(DateTime.Today.AddDays(-2))
        };

        string status = _calculator.GetStatus(zakaz);

        Assert.Equal("отгружен", status);
    }

    [Fact]
    public void Test_CalculateStatus_Overdue()
    {
        var zakaz = new Zakaz
        {
            Id = 2,
            PlanDataOtgruzki = DateOnly.FromDateTime(DateTime.Today.AddDays(-3)),
            FactDataOtgruzki = null
        };

        string status = _calculator.GetStatus(zakaz);

        Assert.Equal("просрочен", status);
    }

    [Fact]
    public void Test_CalculateStatus_InProgress()
    {
        var zakaz = new Zakaz
        {
            Id = 3,
            PlanDataOtgruzki = DateOnly.FromDateTime(DateTime.Today.AddDays(7)),
            FactDataOtgruzki = null
        };

        string status = _calculator.GetStatus(zakaz);

        Assert.Equal("в работе", status);
    }
}
