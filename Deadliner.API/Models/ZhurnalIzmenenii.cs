namespace Deadliner.API.Models;

/// <summary>
/// Журнал изменений — история всех действий над заказами
/// </summary>
public class ZhurnalIzmenenii
{
    public int Id { get; set; }

    public int IdZakaza { get; set; }

    public int IdSotrudnika { get; set; }

    // Дата и время изменения (автоматически при создании записи)
    public DateTime DataIzmenenia { get; set; } = DateTime.UtcNow;

    public string? OpisanieIzmenenia { get; set; }

    // Навигационные свойства
    public Zakaz Zakaz { get; set; } = null!;
    public Sotrudnik Sotrudnik { get; set; } = null!;
}
