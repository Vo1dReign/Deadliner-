using System.Data;
using System.Globalization;
using System.Text;
using System.Text.RegularExpressions;
using ExcelDataReader;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Models;

namespace Deadliner.API.Services;

public class Excel1CImportService
{
    private readonly DeadlinerContext _context;

    public Excel1CImportService(DeadlinerContext context)
    {
        _context = context;
        Encoding.RegisterProvider(CodePagesEncodingProvider.Instance);
    }

    /// <summary>
    /// Парсинг загруженного файла Excel (.xls / .xlsx) и формирование предпросмотра
    /// </summary>
    public async Task<List<Import1CPreviewItemDto>> ParseExcelPreviewAsync(Stream fileStream, int defaultProdDays = 14)
    {
        var previewList = new List<Import1CPreviewItemDto>();

        using var reader = ExcelReaderFactory.CreateReader(fileStream);
        var dataSet = reader.AsDataSet();

        if (dataSet.Tables.Count == 0)
            return previewList;

        var table = dataSet.Tables[0];
        if (table.Rows.Count < 2)
            return previewList;

        // Поиск строки с заголовками колонок
        int headerRowIndex = -1;
        int colDocNum = -1;
        int colDate = -1;
        int colClient = -1;
        int colContract = -1;
        int colCurrency = -1;
        int colAmount = -1;
        int colAuthor = -1;
        int colComment = -1;

        for (int r = 0; r < Math.Min(15, table.Rows.Count); r++)
        {
            var row = table.Rows[r];
            for (int c = 0; c < table.Columns.Count; c++)
            {
                string text = row[c]?.ToString()?.Trim().ToLowerInvariant() ?? "";
                if (text.Contains("контрагент") || text.Contains("покупатель") || text.Contains("клиент")) colClient = c;
                if (text.Contains("дата") || text.Contains("дата документа")) colDate = c;
                if (text == "№" || text == "номер" || text.Contains("номер документа")) colDocNum = c;
                if (text.Contains("договор") || text.Contains("спецификация")) colContract = c;
                if (text.Contains("валюта")) colCurrency = c;
                if (text.Contains("сумма всего") || text == "сумма" || text.Contains("сумма с ндс")) colAmount = c;
                if (text.Contains("автор") || text.Contains("менеджер") || text.Contains("ответственный")) colAuthor = c;
                if (text.Contains("комментарий") || text.Contains("примечание")) colComment = c;
            }

            if (colClient != -1 && (colDate != -1 || colAmount != -1))
            {
                headerRowIndex = r;
                break;
            }
        }

        if (headerRowIndex == -1 || colClient == -1)
            throw new InvalidOperationException("Не удалось определить структуру файла 1С: колонка «Контрагент» не найдена.");

        // Загружаем существующих клиентов для сопоставления
        var existingClients = await _context.Klienty.ToListAsync();
        var clientMap = new Dictionary<string, Klient>(StringComparer.OrdinalIgnoreCase);
        foreach (var k in existingClients)
        {
            if (!string.IsNullOrWhiteSpace(k.FioNazvanie) && !clientMap.ContainsKey(k.FioNazvanie.Trim()))
            {
                clientMap[k.FioNazvanie.Trim()] = k;
            }
        }

        // Читаем строки с данными
        int previewRowCounter = 1;
        for (int r = headerRowIndex + 1; r < table.Rows.Count; r++)
        {
            var row = table.Rows[r];

            string clientName = colClient != -1 ? row[colClient]?.ToString()?.Trim() ?? "" : "";
            if (string.IsNullOrWhiteSpace(clientName))
                continue;

            // Игнорируем строки итогов
            if (clientName.StartsWith("итого", StringComparison.OrdinalIgnoreCase) || 
                clientName.StartsWith("всего", StringComparison.OrdinalIgnoreCase))
                continue;

            string docNum = colDocNum != -1 ? row[colDocNum]?.ToString()?.Trim() ?? "" : "";
            string contract = colContract != -1 ? row[colContract]?.ToString()?.Trim() ?? "" : "";
            string currency = colCurrency != -1 ? row[colCurrency]?.ToString()?.Trim() ?? "BYN" : "BYN";
            string author = colAuthor != -1 ? row[colAuthor]?.ToString()?.Trim() ?? "" : "";
            string comment = colComment != -1 ? row[colComment]?.ToString()?.Trim() ?? "" : "";

            // Парсинг даты
            DateOnly orderDate = DateOnly.FromDateTime(DateTime.Today);
            if (colDate != -1 && row[colDate] != null)
            {
                orderDate = ParseDateOnly(row[colDate]);
            }

            // Парсинг суммы
            decimal amount = 0;
            if (colAmount != -1 && row[colAmount] != null)
            {
                amount = ParseDecimalAmount(row[colAmount]);
            }

            // Извлечение возможного адреса из комментария
            string? extractedAddress = ExtractAddressFromText(comment) ?? ExtractAddressFromText(contract);

            bool isExisting = clientMap.TryGetValue(clientName, out var matchedClient);

            DateOnly planShipDate = orderDate.AddDays(Math.Max(3, defaultProdDays));

            previewList.Add(new Import1CPreviewItemDto
            {
                RowIndex = previewRowCounter++,
                DocNumber = docNum,
                ClientName = clientName,
                IsExistingClient = isExisting,
                ExistingClientId = matchedClient?.Id,
                OrderDate = orderDate,
                PlanShipDate = planShipDate,
                Amount = amount,
                Currency = string.IsNullOrWhiteSpace(currency) ? "BYN" : currency.ToUpperInvariant(),
                Author = author,
                Address = extractedAddress,
                Comment = comment,
                Contract = contract,
                Selected = true
            });
        }

        return previewList;
    }

    /// <summary>
    /// Выполнение непосредственного импорта подтвержденных заказов в базу данных DeadLiner
    /// </summary>
    public async Task<Import1CResultDto> ImportConfirmedOrdersAsync(List<Import1CPreviewItemDto> items, int? defaultManagerId = null)
    {
        var selectedItems = items.Where(i => i.Selected).ToList();
        if (selectedItems.Count == 0)
        {
            return new Import1CResultDto
            {
                Success = false,
                Message = "Не выбрано ни одной строки для импорта."
            };
        }

        int targetManagerId = defaultManagerId ?? 1;
        var allStaff = await _context.Sotrudniki.ToListAsync();

        var catalogStages = await _context.EtapYProizvodstva
            .OrderBy(e => e.PoryadkovyNomer)
            .ToListAsync();

        int createdOrdersCount = 0;
        int newClientsCount = 0;
        var createdOrderIds = new List<int>();

        foreach (var item in selectedItems)
        {
            // 1. Поиск или создание контрагента
            Klient? klient = null;
            if (item.ExistingClientId.HasValue)
            {
                klient = await _context.Klienty.FindAsync(item.ExistingClientId.Value);
            }

            if (klient == null)
            {
                klient = await _context.Klienty
                    .FirstOrDefaultAsync(k => k.FioNazvanie.ToLower() == item.ClientName.ToLower());
            }

            if (klient == null)
            {
                klient = new Klient
                {
                    FioNazvanie = item.ClientName.Trim(),
                    AdresObekta = item.Address
                };
                _context.Klienty.Add(klient);
                await _context.SaveChangesAsync();
                newClientsCount++;
            }
            else if (string.IsNullOrWhiteSpace(klient.AdresObekta) && !string.IsNullOrWhiteSpace(item.Address))
            {
                klient.AdresObekta = item.Address;
                await _context.SaveChangesAsync();
            }

            // 2. Определение менеджера
            int orderManagerId = targetManagerId;
            if (!string.IsNullOrWhiteSpace(item.Author))
            {
                var matchedManager = allStaff.FirstOrDefault(s => 
                    s.Fio.Contains(item.Author, StringComparison.OrdinalIgnoreCase) ||
                    item.Author.Contains(s.Fio, StringComparison.OrdinalIgnoreCase));
                if (matchedManager != null)
                {
                    orderManagerId = matchedManager.Id;
                }
            }

            // 3. Создание заказа
            var zakaz = new Zakaz
            {
                IdKlienta = klient.Id,
                IdMenedzhera = orderManagerId,
                DataPriema = item.OrderDate,
                PlanDataOtgruzki = item.PlanShipDate,
                SummaPredoplaty = item.Amount,
                Status = "в работе"
            };

            _context.Zakazy.Add(zakaz);
            await _context.SaveChangesAsync();
            createdOrderIds.Add(zakaz.Id);
            createdOrdersCount++;

            // 4. Добавление записи изделия по спецификации
            string itemName = !string.IsNullOrWhiteSpace(item.DocNumber)
                ? $"Наряд-заказ №{item.DocNumber}"
                : $"Мебельный заказ от {item.OrderDate:dd.MM.yyyy}";

            string details = !string.IsNullOrWhiteSpace(item.Contract) ? item.Contract : "";
            if (!string.IsNullOrWhiteSpace(item.Comment))
            {
                details = string.IsNullOrWhiteSpace(details) ? item.Comment : $"{details}; {item.Comment}";
            }

            var izdelie = new Izdelie
            {
                IdZakaza = zakaz.Id,
                ZakazId = zakaz.Id,
                Zakaz = zakaz,
                Naimenovanie = itemName,
                Kolichestvo = 1,
                Harakteristiki = string.IsNullOrWhiteSpace(details) ? "Мебельные изделия по спецификации 1С" : details
            };
            _context.Izdeliya.Add(izdelie);

            // 5. Автоматическая генерация этапов цеха
            if (catalogStages.Count > 0)
            {
                int totalDays = Math.Max(1, zakaz.PlanDataOtgruzki.DayNumber - zakaz.DataPriema.DayNumber);
                double step = (double)totalDays / catalogStages.Count;

                for (int s = 0; s < catalogStages.Count; s++)
                {
                    int addDays = (int)Math.Max(1, Math.Round((s + 1) * step));
                    if (addDays > totalDays) addDays = totalDays;

                    _context.EtapyZakazov.Add(new EtapZakaza
                    {
                        IdZakaza = zakaz.Id,
                        ZakazId = zakaz.Id,
                        Zakaz = zakaz,
                        IdEtapa = catalogStages[s].Id,
                        EtapId = catalogStages[s].Id,
                        Etap = catalogStages[s],
                        PlanData = zakaz.DataPriema.AddDays(addDays),
                        Status = "не начат"
                    });
                }
            }

            // 6. Фиксация в журнале аудита
            _context.ZhurnalIzmenenii.Add(new ZhurnalIzmenenii
            {
                IdZakaza = zakaz.Id,
                IdSotrudnika = orderManagerId,
                DataIzmenenia = DateTime.Now,
                OpisanieIzmenenia = $"Заказ импортирован из 1С: наряд №{item.DocNumber}, контрагент «{klient.FioNazvanie}», сумма {item.Amount:N2} {item.Currency}."
            });

            await _context.SaveChangesAsync();
        }

        return new Import1CResultDto
        {
            Success = true,
            TotalImported = createdOrdersCount,
            NewClientsCreated = newClientsCount,
            CreatedOrderIds = createdOrderIds,
            Message = $"Успешно импортировано {createdOrdersCount} заказов. Создано новых контрагентов в базе: {newClientsCount}."
        };
    }

    private static DateOnly ParseDateOnly(object val)
    {
        if (val is DateTime dt)
            return DateOnly.FromDateTime(dt);

        string s = val.ToString()?.Trim() ?? "";
        if (DateTime.TryParseExact(s, new[] { "dd.MM.yyyy", "dd.MM.yyyy HH:mm:ss", "yyyy-MM-dd", "d.M.yyyy" }, 
            CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            return DateOnly.FromDateTime(parsed);
        }

        if (DateTime.TryParse(s, CultureInfo.GetCultureInfo("ru-RU"), DateTimeStyles.None, out var parsedRu))
        {
            return DateOnly.FromDateTime(parsedRu);
        }

        return DateOnly.FromDateTime(DateTime.Today);
    }

    private static decimal ParseDecimalAmount(object val)
    {
        if (val is decimal dec) return dec;
        if (val is double d) return Convert.ToDecimal(d);
        if (val is int i) return Convert.ToDecimal(i);
        if (val is long l) return Convert.ToDecimal(l);

        string s = val.ToString()?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(s)) return 0;

        // Удаление пробелов, неразрывных пробелов и знаков валют
        s = s.Replace("\u00A0", "").Replace("\u202F", "").Replace(" ", "");
        s = s.Replace(',', '.');

        // Оставляем только цифры, точку и знак минус
        s = Regex.Replace(s, @"[^\d\.\-]", "");

        if (decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var result))
        {
            return result;
        }

        return 0;
    }

    private static string? ExtractAddressFromText(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        // Если содержит ключевые слова адреса, извлекаем фрагмент
        if (Regex.IsMatch(text, @"(г\.|ул\.|пер\.|пр\.|пр-т|д\.|магазин №)", RegexOptions.IgnoreCase))
        {
            return text.Trim();
        }

        return null;
    }
}
