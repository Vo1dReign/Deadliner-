namespace Deadliner.API.Models;

/// <summary>
/// Экземпляр этапа для конкретного заказа — плановые/фактические даты, статус, ответственный
/// </summary>
public class EtapZakaza
{
    public int Id { get; set; }

    public int IdZakaza { get; set; }

    // Ссылка на справочник этапов
    public int IdEtapa { get; set; }

    // Кто ответственен за этот этап в данном заказе
    public int? IdSotrudnika { get; set; }

    public DateOnly PlanData { get; set; }

    // null = этап ещё не завершён
    public DateOnly? FactData { get; set; }

    // "не начат", "в работе", "завершён"
    public string Status { get; set; } = "не начат";

    // Навигационные свойства
    public Zakaz Zakaz { get; set; } = null!;
    public EtapProizvodstva Etap { get; set; } = null!;
    public Sotrudnik? Sotrudnik { get; set; }
}
