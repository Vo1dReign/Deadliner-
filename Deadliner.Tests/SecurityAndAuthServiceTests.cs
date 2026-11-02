using Deadliner.API.Services;
using Microsoft.Extensions.Caching.Memory;
using Microsoft.Extensions.Logging.Abstractions;
using Xunit;

namespace Deadliner.Tests;

/// <summary>
/// Модульные тесты подсистем криптографии и SMS-верификации телефонов
/// Сервисы: PasswordHasherService, PhoneVerificationService
/// </summary>
public class SecurityAndAuthServiceTests
{
    private readonly PasswordHasherService _hasher = new();
    private readonly PhoneVerificationService _phoneService;

    public SecurityAndAuthServiceTests()
    {
        var memoryCache = new MemoryCache(new MemoryCacheOptions());
        var logger = NullLogger<PhoneVerificationService>.Instance;
        _phoneService = new PhoneVerificationService(memoryCache, logger);
    }

    [Fact]
    public void Test_PasswordHasher_GeneratesPbkdf2Hash()
    {
        string rawPassword = "SecurePassword123!";

        string hash = _hasher.HashPassword(rawPassword);

        Assert.NotNull(hash);
        Assert.StartsWith("PBKDF2$100000$", hash);
        Assert.NotEqual(rawPassword, hash);
    }

    [Fact]
    public void Test_PasswordHasher_VerifyValidPassword()
    {
        string rawPassword = "admin123";
        string hash = _hasher.HashPassword(rawPassword);

        var (isValid, needsRehash) = _hasher.VerifyPassword(rawPassword, hash);

        Assert.True(isValid);
        Assert.False(needsRehash);
    }

    [Fact]
    public void Test_PasswordHasher_RejectsInvalidPassword()
    {
        string rawPassword = "admin123";
        string wrongPassword = "wrongPassword";
        string hash = _hasher.HashPassword(rawPassword);

        var (isValid, _) = _hasher.VerifyPassword(wrongPassword, hash);

        Assert.False(isValid);
    }

    [Fact]
    public void Test_PasswordHasher_LegacyPlaintext_SupportAndFlagRehash()
    {
        string rawPassword = "legacy_admin_pass";
        string storedPlaintext = "legacy_admin_pass";

        var (isValid, needsRehash) = _hasher.VerifyPassword(rawPassword, storedPlaintext);

        Assert.True(isValid);
        Assert.True(needsRehash); // Требует немедленного хэширования в БД
    }

    [Theory]
    [InlineData("+375 (29) 609-35-12", "+375296093512")]
    [InlineData("80296093512", "+375296093512")]
    [InlineData("296093512", "+375296093512")]
    [InlineData("+375445931852", "+375445931852")]
    public void Test_PhoneVerification_NormalizePhone(string input, string expected)
    {
        string? normalized = _phoneService.NormalizePhone(input);

        Assert.Equal(expected, normalized);
    }

    [Theory]
    [InlineData("+375296093512", true)]  // A1/МТС 29
    [InlineData("+375445931852", true)]  // A1 44
    [InlineData("+375331234567", true)]  // МТС 33
    [InlineData("+375251234567", true)]  // Life 25
    [InlineData("+375172223344", true)]  // Минск город 17
    [InlineData("+79991234567", false)]  // Номер РФ не должен приниматься валидатором РБ
    [InlineData("12345", false)]         // Неполный номер
    public void Test_PhoneVerification_IsValidBelarusPhone(string phone, bool expected)
    {
        bool isValid = _phoneService.IsValidBelarusPhone(phone);

        Assert.Equal(expected, isValid);
    }

    [Fact]
    public void Test_PhoneVerification_SendAndVerifyCodeFlow()
    {
        string phone = "+375 (29) 111-22-33";

        // 1. Отправка кода
        var sendResult = _phoneService.SendCode(phone);
        Assert.True(sendResult.Success);
        Assert.NotNull(sendResult.TestCode);
        Assert.Equal(4, sendResult.TestCode.Length);

        // 2. Проверка неверного кода
        bool wrongVerify = _phoneService.VerifyCode(phone, "0000");
        Assert.False(wrongVerify);

        // 3. Проверка верного кода
        bool validVerify = _phoneService.VerifyCode(phone, sendResult.TestCode);
        Assert.True(validVerify);

        // 4. Проверка, что номер помечен как подтвержденный в кэше
        bool isVerified = _phoneService.IsPhoneVerified(phone);
        Assert.True(isVerified);
    }
}
