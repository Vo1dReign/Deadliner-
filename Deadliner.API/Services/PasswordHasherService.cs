using System.Security.Cryptography;

namespace Deadliner.API.Services;

/// <summary>
/// Криптографический сервис для безопасного хэширования и проверки паролей (PBKDF2-HMAC-SHA256)
/// </summary>
public class PasswordHasherService
{
    private const int SaltSize = 16; // 128 bit
    private const int KeySize = 32;  // 256 bit
    private const int Iterations = 100_000;

    /// <summary>
    /// Создает криптостойкий хэш пароля с уникальной солью
    /// Формат: PBKDF2$100000$saltBase64$hashBase64
    /// </summary>
    public string HashPassword(string password)
    {
        if (string.IsNullOrEmpty(password))
            throw new ArgumentException("Пароль не может быть пустым", nameof(password));

        byte[] salt = RandomNumberGenerator.GetBytes(SaltSize);
        byte[] hash = Rfc2898DeriveBytes.Pbkdf2(
            password,
            salt,
            Iterations,
            HashAlgorithmName.SHA256,
            KeySize);

        return $"PBKDF2${Iterations}${Convert.ToBase64String(salt)}${Convert.ToBase64String(hash)}";
    }

    /// <summary>
    /// Проверяет совпадение пароля с сохраненным хэшем.
    /// Поддерживает безопасный переход со старых открытых паролей (legacy).
    /// </summary>
    /// <returns>
    /// IsValid: верен ли пароль;
    /// NeedsRehash: нужно ли обновить пароль в базе на новый PBKDF2 хэш.
    /// </returns>
    public (bool IsValid, bool NeedsRehash) VerifyPassword(string providedPassword, string storedHashOrPlain)
    {
        if (string.IsNullOrEmpty(providedPassword) || string.IsNullOrEmpty(storedHashOrPlain))
            return (false, false);

        // 1. Проверка формата PBKDF2
        if (storedHashOrPlain.StartsWith("PBKDF2$"))
        {
            var parts = storedHashOrPlain.Split('$');
            if (parts.Length != 4)
                return (false, false);

            if (!int.TryParse(parts[1], out int iterations))
                return (false, false);

            byte[] salt = Convert.FromBase64String(parts[2]);
            byte[] expectedHash = Convert.FromBase64String(parts[3]);

            byte[] actualHash = Rfc2898DeriveBytes.Pbkdf2(
                providedPassword,
                salt,
                iterations,
                HashAlgorithmName.SHA256,
                expectedHash.Length);

            bool matches = CryptographicOperations.FixedTimeEquals(actualHash, expectedHash);
            return (matches, false);
        }

        // 2. Обратная совместимость для старых открытых паролей (legacy plaintext)
        // Если в базе лежит старый незахэшированный пароль (например 'admin123')
        if (providedPassword == storedHashOrPlain)
        {
            // Пароль верный, но требует немедленного перехэширования в БД!
            return (true, true);
        }

        return (false, false);
    }
}
