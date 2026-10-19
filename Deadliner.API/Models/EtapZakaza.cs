using System.ComponentModel.DataAnnotations.Schema;

namespace Deadliner.API.Models;

public class EtapZakaza
{
    public int Id { get; set; }

    public int IdZakaza { get; set; }
    public int ZakazId { get; set; }

    public int IdEtapa { get; set; }
    public int EtapId { get; set; }

    public int? IdSotrudnika { get; set; }
    public int? SotrudnikId { get; set; }

    public DateOnly PlanData { get; set; }
    public DateOnly? FactData { get; set; }
    public string Status { get; set; } = "не начат";

    [ForeignKey("ZakazId")]
    public Zakaz Zakaz { get; set; } = null!;

    [ForeignKey("EtapId")]
    public EtapProizvodstva Etap { get; set; } = null!;

    [ForeignKey("SotrudnikId")]
    public Sotrudnik? Sotrudnik { get; set; }
}
