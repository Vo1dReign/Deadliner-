namespace Deadliner.API.Models;

/// <summary>
/// Справочник этапов производства (Раскрой, Покраска, Сборка и т.д.)
/// Настраивается администратором без изменения кода
/// </summary>
public class EtapProizvodstva
{
    public int Id { get; set; }

    public string Nazvanie { get; set; } = string.Empty;

    // Порядок прохождения этапа (1, 2, 3...)
    public int PoryadkovyNomer { get; set; }

    // "базовый" или "промежуточный"
    public string TipEtapa { get; set; } = "базовый";

    // Какая роль отвечает за этот этап (может быть null)
    public int? IdRoliOtvetstvennogo { get; set; }

    // Навигационные свойства
    public Rol? RolOtvetstvennogo { get; set; }
    public ICollection<EtapZakaza> EtapyZakazov { get; set; } = new List<EtapZakaza>();
}
