using Deadliner.API.Models;

namespace Deadliner.API.Services;

public class DeadlineCalculatorService
{
    public int GetDaysLeft(DateOnly planDate)
    {
        return planDate.DayNumber - DateOnly.FromDateTime(DateTime.Today).DayNumber;
    }

    public string GetColor(int daysLeft, List<PorogSrochnosti>porogi)
    {
        foreach (var porog in porogi)
        {
            if (daysLeft >= porog.DneyOt && daysLeft <= porog.DneyDo)
                return porog.Cvet;
        }
        return daysLeft < 0 ? "красный" : "зелёный";
    }

    public string GetStatus(Zakaz zakaz)
    {
        if (zakaz.FactDataOtgruzki.HasValue)
            return "завершен";

        if (DateOnly.FromDateTime(DateTime.Today)> zakaz.PlanDataOtgruzki)
            return "просрочен";

        return "в работе";
    }
}