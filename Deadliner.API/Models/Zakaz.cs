namespace Deadliner.API.Models;

/// <summary>
/// Заказ — основная сущность системы
/// </summary>
public class Zakaz
{
    public int Id { get; set; }

    // Внешние ключи
    public int IdKlienta { get; set; }
    public int IdMenedzhera { get; set; }

    public DateOnly DataPriema { get; set; }

    public decimal SummaPredoplaty { get; set; } = 0;

    public DateOnly PlanDataOtgruzki { get; set; }

    // null = ещё не отгружен
    public DateOnly? FactDataOtgruzki { get; set; }

    // "в работе", "просрочен", "завершён"
    public string Status { get; set; } = "в работе";

    // Навигационные свойства
    [System.ComponentModel.DataAnnotations.Schema.ForeignKey("IdKlienta")]
    public Klient? Klient { get; set; }
    
    [System.ComponentModel.DataAnnotations.Schema.ForeignKey("IdMenedzhera")]
    public Sotrudnik? Menedzher { get; set; }

    public ICollection<Izdelie> Izdeliya { get; set; } = new List<Izdelie>();
    public ICollection<EtapZakaza> EtapyZakaza { get; set; } = new List<EtapZakaza>();
    public ICollection<ZhurnalIzmenenii> ZhurnalIzmenenii { get; set; } = new List<ZhurnalIzmenenii>();
}
