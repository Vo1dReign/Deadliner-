namespace Deadliner.API.Models;

public class EtapZakaza
{
    public int Id { get; set; }

    public int IdZakaza { get; set; }

    public int IdEtapa { get; set; }

    public int? IdSotrudnika { get; set; }

    public DateOnly PlanData { get; set; }

    public DateOnly? FactData { get; set; }
    public string Status { get; set; } = "не начат";

    public Zakaz Zakaz { get; set; } = null!;
    public EtapProizvodstva Etap { get; set; } = null!;
    public Sotrudnik? Sotrudnik { get; set; }
}
