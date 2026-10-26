using System.ComponentModel.DataAnnotations.Schema;
using System.Text.Json.Serialization;

namespace Deadliner.API.Models;

public class Izdelie
{
    public int Id { get; set; }

    public int IdZakaza { get; set; }
    public int ZakazId { get; set; }

    public string Naimenovanie { get; set; } = string.Empty;
    public int Kolichestvo { get; set; } = 1;
    public string? Harakteristiki { get; set; }

    // Навигационное свойство
    [ForeignKey("ZakazId")]
    [JsonIgnore]
    public Zakaz? Zakaz { get; set; }
}
