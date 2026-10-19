namespace Deadliner.API.Models;

/// <summary>
/// Элемент предпросмотра строки заказа из 1С (Excel)
/// </summary>
public class Import1CPreviewItemDto
{
    public int RowIndex { get; set; }
    public string DocNumber { get; set; } = string.Empty;
    public string ClientName { get; set; } = string.Empty;
    public bool IsExistingClient { get; set; }
    public int? ExistingClientId { get; set; }
    public DateOnly OrderDate { get; set; }
    public DateOnly PlanShipDate { get; set; }
    public decimal Amount { get; set; }
    public string Currency { get; set; } = "BYN";
    public string? Author { get; set; }
    public string? Address { get; set; }
    public string? Comment { get; set; }
    public string? Contract { get; set; }
    public bool Selected { get; set; } = true;
}

public class Import1CConfirmRequest
{
    public List<Import1CPreviewItemDto> Items { get; set; } = new();
    public int? DefaultManagerId { get; set; }
}

public class Import1CResultDto
{
    public bool Success { get; set; }
    public int TotalImported { get; set; }
    public int NewClientsCreated { get; set; }
    public List<int> CreatedOrderIds { get; set; } = new();
    public string Message { get; set; } = string.Empty;
}
