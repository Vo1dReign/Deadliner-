namespace Deadliner.API.Models;

/// <summary>
/// Роль пользователя в системе (Менеджер, Администратор, Сотрудник цеха и т.д.)
/// </summary>
public class Rol
{
    public int Id { get; set; }

    public string Nazvanie { get; set; } = string.Empty;

    // Навигационное свойство — один роль может быть у многих сотрудников
    public ICollection<Sotrudnik> Sotrudniki { get; set; } = new List<Sotrudnik>();

    // Навигационное свойство — роль может быть ответственной за этапы производства
    public ICollection<EtapProizvodstva> EtapyProizvodstva { get; set; } = new List<EtapProizvodstva>();
}
