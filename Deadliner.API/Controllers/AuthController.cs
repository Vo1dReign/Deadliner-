using Microsoft.AspNetCore.Mvc;
using Deadliner.API.Services;

namespace Deadliner.API.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly PhoneVerificationService _phoneService;

    public AuthController(PhoneVerificationService phoneService)
    {
        _phoneService = phoneService;
    }

    /// <summary>
    /// Отправка проверочного SMS-кода на номер телефона сотрудника
    /// </summary>
    [HttpPost("send-code")]
    public IActionResult SendCode([FromBody] SendCodeDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Telefon))
            return BadRequest(new { message = "Укажите номер телефона" });

        var result = _phoneService.SendCode(dto.Telefon);
        if (!result.Success)
            return BadRequest(new { message = result.Message });

        // В учебном/демонстрационном режиме возвращаем testCode для мгновенного тестирования в браузере
        return Ok(new
        {
            success = true,
            message = result.Message,
            testCode = result.TestCode, // Для удобства защиты и демонстрации без реального шлюза
            phone = _phoneService.NormalizePhone(dto.Telefon)
        });
    }

    /// <summary>
    /// Проверка введенного одноразового кода
    /// </summary>
    [HttpPost("verify-code")]
    public IActionResult VerifyCode([FromBody] VerifyCodeDto dto)
    {
        if (dto == null || string.IsNullOrWhiteSpace(dto.Telefon) || string.IsNullOrWhiteSpace(dto.Code))
            return BadRequest(new { message = "Укажите номер телефона и проверочный код" });

        bool isValid = _phoneService.VerifyCode(dto.Telefon, dto.Code);
        if (!isValid)
            return BadRequest(new { success = false, message = "Неверный проверочный код или срок его действия истёк" });

        return Ok(new
        {
            success = true,
            message = "Номер телефона успешно подтверждён!",
            phone = _phoneService.NormalizePhone(dto.Telefon)
        });
    }
}

public class SendCodeDto
{
    public string Telefon { get; set; } = string.Empty;
}

public class VerifyCodeDto
{
    public string Telefon { get; set; } = string.Empty;
    public string Code { get; set; } = string.Empty;
}
