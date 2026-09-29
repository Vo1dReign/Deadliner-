namespace Deadliner.API.Models;

/// <summary>
/// Справочник порогов срочности — определяет цвет индикатора по числу дней до отгрузки
/// Зелёный: 8+ дней, Жёлтый: 3-7 дней, Красный: 0-2 дня (или просрочен)
/// </summary>
public class PorogSrochnosti
{
    public int Id { get; set; }

    // "зелёный", "жёлтый", "красный"
    public string Cvet { get; set; } = string.Empty;

    // Диапазон дней: от DneyOt до DneyDo
    public int DneyOt { get; set; }
    public int DneyDo { get; set; }
}
