namespace Deadliner.API.Models;

/// <summary>
/// Изделие — позиция внутри заказа (конкретный предмет мебели)
/// </summary>
public class Izdelie
{
    public int Id { get; set; }

    public int IdZakaza { get; set; }

    public string Naimenovanie { get; set; } = string.Empty;

    public int Kolichestvo { get; set; } = 1;

    public string? Harakteristiki { get; set; }

    // Навигационное свойство
    public Zakaz Zakaz { get; set; } = null!;
}
