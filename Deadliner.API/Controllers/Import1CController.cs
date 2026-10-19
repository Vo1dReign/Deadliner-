using Microsoft.AspNetCore.Mvc;
using Deadliner.API.Models;
using Deadliner.API.Services;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class Import1CController : ControllerBase
{
    private readonly Excel1CImportService _importService;

    public Import1CController(Excel1CImportService importService)
    {
        _importService = importService;
    }

    /// <summary>
    /// Предпросмотр содержимого выгрузки из 1С перед импортом
    /// </summary>
    [HttpPost("preview")]
    public async Task<ActionResult<List<Import1CPreviewItemDto>>> Preview([FromForm] IFormFile? file, [FromQuery] int defaultProdDays = 14)
    {
        if (file == null || file.Length == 0)
        {
            return BadRequest(new { message = "Файл Excel не выбран или пуст." });
        }

        string ext = Path.GetExtension(file.FileName).ToLowerInvariant();
        if (ext != ".xls" && ext != ".xlsx")
        {
            return BadRequest(new { message = "Поддерживаются только файлы таблиц Excel (.xls, .xlsx)." });
        }

        try
        {
            using var stream = file.OpenReadStream();
            var preview = await _importService.ParseExcelPreviewAsync(stream, defaultProdDays);
            return Ok(preview);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Ошибка обработки файла 1С: {ex.Message}" });
        }
    }

    /// <summary>
    /// Подтверждение и массовый импорт выбранных заказов из 1С в систему DeadLiner
    /// </summary>
    [HttpPost("confirm")]
    public async Task<ActionResult<Import1CResultDto>> Confirm([FromBody] Import1CConfirmRequest req)
    {
        if (req == null || req.Items == null || req.Items.Count == 0)
        {
            return BadRequest(new { message = "Нет данных для импорта." });
        }

        try
        {
            var result = await _importService.ImportConfirmedOrdersAsync(req.Items, req.DefaultManagerId);
            return Ok(result);
        }
        catch (Exception ex)
        {
            return StatusCode(500, new { message = $"Ошибка импорта заказов: {ex.Message}" });
        }
    }
}
