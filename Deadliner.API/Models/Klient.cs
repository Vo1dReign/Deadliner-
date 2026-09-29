namespace Deadliner.API.Models;

/// <summary>
/// Клиент — заказчик мебели
/// </summary>
public class Klient
{
    public int Id { get; set; }

    // ФИО для физлица или название организации
    public string FioNazvanie { get; set; } = string.Empty;

    public string? Telefon { get; set; }

    public string? AdresObekta { get; set; }

    // Навигационное свойство — у клиента может быть много заказов
    public ICollection<Zakaz> Zakazy { get; set; } = new List<Zakaz>();
}
