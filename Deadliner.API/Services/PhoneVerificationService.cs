using System.Security.Cryptography;
using System.Text.RegularExpressions;
using Microsoft.Extensions.Caching.Memory;

namespace Deadliner.API.Services;

/// <summary>
/// Сервис валидации номеров телефонов и подтверждения через одноразовые коды (SMS/OTP)
/// </summary>
public class PhoneVerificationService
{
    private readonly IMemoryCache _cache;
    private readonly ILogger<PhoneVerificationService> _logger;

    // Регулярное выражение для номеров Республики Беларусь (+375 и 80)
    // Коды операторов: 29, 33, 44, 25 (мобильные) и 17 (городской Минск)
    private static readonly Regex BelarusPhoneRegex = new(
        @"^(\+?375|80)(29|25|33|44|17)\d{7}$",
        RegexOptions.Compiled);

    public PhoneVerificationService(IMemoryCache cache, ILogger<PhoneVerificationService> logger)
    {
        _cache = cache;
        _logger = logger;
    }

    /// <summary>
    /// Нормализует номер телефона к единому международному формату: +375XXXXXXXXX
    /// Удаляет пробелы, скобки, дефисы.
    /// </summary>
    public string? NormalizePhone(string? phone)
    {
        if (string.IsNullOrWhiteSpace(phone))
            return null;

        // Оставляем только цифры и знак плюс в начале
        string digits = new string(phone.Where(char.IsDigit).ToArray());

        if (digits.StartsWith("80") && digits.Length == 11)
        {
            // Формат 80XXXXXXXXX -> +375XXXXXXXXX
            return "+375" + digits.Substring(2);
        }
        else if (digits.StartsWith("375") && digits.Length == 12)
        {
            return "+" + digits;
        }
        else if (digits.Length == 9)
        {
            // Ввели только код и номер, например 291234567
            return "+375" + digits;
        }

        return phone.Trim();
    }

    /// <summary>
    /// Проверяет, является ли номер валидным номером телефона РБ
    /// </summary>
    public bool IsValidBelarusPhone(string? phone)
    {
        string? normalized = NormalizePhone(phone);
        if (string.IsNullOrEmpty(normalized))
            return false;

        return BelarusPhoneRegex.IsMatch(normalized);
    }

    /// <summary>
    /// Генерирует и «отправляет» 4-значный проверочный SMS-код
    /// </summary>
    public (bool Success, string Message, string? TestCode) SendCode(string rawPhone)
    {
        string? phone = NormalizePhone(rawPhone);
        if (string.IsNullOrEmpty(phone) || !IsValidBelarusPhone(phone))
        {
            return (false, "Неверный формат номера. Допустимый формат: +375 (XX) XXX-XX-XX", null);
        }

        // Проверяем ограничение частоты запросов (rate limiting) - не чаще 1 раза в 30 секунд
        string rateLimitKey = $"sms_ratelimit_{phone}";
        if (_cache.TryGetValue(rateLimitKey, out _))
        {
            return (false, "Подождите 30 секунд перед повторной отправкой кода", null);
        }

        // Генерация криптостойкого 4-значного кода (1000..9999)
        int codeInt = RandomNumberGenerator.GetInt32(1000, 10000);
        string code = codeInt.ToString();

        // Сохранение кода в кэше с временем жизни 3 минуты
        string cacheKey = $"sms_code_{phone}";
        _cache.Set(cacheKey, code, TimeSpan.FromMinutes(3));
        _cache.Set(rateLimitKey, true, TimeSpan.FromSeconds(30));

        // Логирование в консоль сервера (эмуляция реального SMS-шлюза)
        _logger.LogInformation("=================================================");
        _logger.LogInformation("📲 [SMS-ШЛЮЗ СИСТЕМЫ ДИСПЕТЧЕРИЗАЦИИ МИКМЕБЕЛЬ]");
        _logger.LogInformation("Номер получателя: {Phone}", phone);
        _logger.LogInformation("Проверочный код безопасности: {Code}", code);
        _logger.LogInformation("Срок действия: 3 минуты");
        _logger.LogInformation("=================================================");

        return (true, $"SMS-код отправлен на номер {phone}", code);
    }

    /// <summary>
    /// Проверяет введенный пользователем код подтверждения
    /// </summary>
    public bool VerifyCode(string rawPhone, string inputCode)
    {
        string? phone = NormalizePhone(rawPhone);
        if (string.IsNullOrEmpty(phone) || string.IsNullOrWhiteSpace(inputCode))
            return false;

        string cacheKey = $"sms_code_{phone}";
        if (_cache.TryGetValue(cacheKey, out string? expectedCode))
        {
            if (expectedCode != null && expectedCode == inputCode.Trim())
            {
                // Код верен — удаляем из кэша одноразовый код и помечаем номер как подтвержденный на 15 минут
                _cache.Remove(cacheKey);
                _cache.Set($"phone_verified_{phone}", true, TimeSpan.FromMinutes(15));
                return true;
            }
        }

        return false;
    }

    /// <summary>
    /// Проверяет, был ли номер предварительно успешно подтвержден кодом (для регистрации или смены телефона)
    /// </summary>
    public bool IsPhoneVerified(string rawPhone)
    {
        string? phone = NormalizePhone(rawPhone);
        if (string.IsNullOrEmpty(phone))
            return false;

        return _cache.TryGetValue($"phone_verified_{phone}", out bool verified) && verified;
    }
}
