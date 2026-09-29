namespace Deadliner.API.Models;

/// <summary>
/// Сотрудник предприятия — пользователь системы
/// </summary>
public class Sotrudnik
{
    public int Id { get; set; }

    public string Fio { get; set; } = string.Empty;

    public string? Telefon { get; set; }

    // Внешний ключ — к какой роли относится сотрудник
    public int IdRoli { get; set; }

    public string Login { get; set; } = string.Empty;

    // Пароль хранится в виде хэша (не открытый текст!)
    public string Parol { get; set; } = string.Empty;

    // Навигационное свойство — объект роли
    public Rol Rol { get; set; } = null!;

    // Навигационные свойства — связанные данные
    public ICollection<Zakaz> Zakazy { get; set; } = new List<Zakaz>();
    public ICollection<EtapZakaza> EtapyZakazov { get; set; } = new List<EtapZakaza>();
    public ICollection<ZhurnalIzmenenii> ZhurnalIzmenenii { get; set; } = new List<ZhurnalIzmenenii>();
}
