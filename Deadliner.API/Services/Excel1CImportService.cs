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
    /// с интеллектуальным разделением документов, адресов и расчётом сроков
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

        // 1. Поиск строки с заголовками колонок
        int headerRowIndex = -1;
        int colDocNum = -1;
        int colDate = -1;
        int colShipDate = -1;
        int colClient = -1;
        int colContract = -1;
        int colCurrency = -1;
        int colAmount = -1;
        int colAuthor = -1;
        int colAddress = -1;
        int colComment = -1;

        for (int r = 0; r < Math.Min(15, table.Rows.Count); r++)
        {
            var row = table.Rows[r];
            for (int c = 0; c < table.Columns.Count; c++)
            {
                string text = row[c]?.ToString()?.Trim().ToLowerInvariant() ?? "";
                if (string.IsNullOrWhiteSpace(text)) continue;

                if (text.Contains("контрагент") || text.Contains("покупатель") || text.Contains("клиент")) colClient = c;
                
                // Проверяем срок отгрузки до обычной даты
                if (text.Contains("дата отгрузки") || text.Contains("срок отгрузки") || text.Contains("срок поставки") || 
                    text.Contains("дата готовности") || text.Contains("план отгрузки") || text.Contains("дедлайн") || text.Contains("срок исполнения"))
                {
                    colShipDate = c;
                }
                else if (text.Contains("дата") || text.Contains("дата документа") || text == "дата")
                {
                    colDate = c;
                }

                if (text == "№" || text == "номер" || text.Contains("номер документа") || text.Contains("№ наряда")) colDocNum = c;
                if (text.Contains("договор") || text.Contains("спецификация") || text.Contains("основание")) colContract = c;
                if (text.Contains("валюта")) colCurrency = c;
                if (text.Contains("сумма всего") || text == "сумма" || text.Contains("сумма с ндс") || text.Contains("всего")) colAmount = c;
                if (text.Contains("автор") || text.Contains("менеджер") || text.Contains("ответственный")) colAuthor = c;
                if (text.Contains("адрес") || text.Contains("пункт доставки") || text.Contains("место сборки") || text.Contains("объект")) colAddress = c;
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

            // 1. Парсинг даты приёма (если нет — не страшно, ставим сегодняшнюю)
            DateOnly? parsedOrderDate = null;
            if (colDate != -1 && row[colDate] != null)
            {
                parsedOrderDate = TryParseDateOnly(row[colDate]);
            }
            DateOnly orderDate = parsedOrderDate ?? DateOnly.FromDateTime(DateTime.Today);

            // 2. Определение срока отгрузки:
            // а) Ищем в отдельной колонке файла 1С
            DateOnly? explicitShipDate = null;
            if (colShipDate != -1 && row[colShipDate] != null)
            {
                explicitShipDate = TryParseDateOnly(row[colShipDate]);
            }

            // б) Если нет колонки, ищем в тексте комментария (например "отгрузка до 25.10.2026")
            if (explicitShipDate == null && !string.IsNullOrWhiteSpace(comment))
            {
                explicitShipDate = TryExtractDateFromText(comment);
            }

            // в) Если даты отгрузки нет в файле — это штатная ситуация: рассчитываем по производственному нормативу (+14 дн.)
            bool hasExplicitShipDate = explicitShipDate.HasValue;
            DateOnly planShipDate = explicitShipDate ?? orderDate.AddDays(Math.Max(3, defaultProdDays));

            // 3. Парсинг суммы
            decimal amount = 0;
            if (colAmount != -1 && row[colAmount] != null)
            {
                amount = ParseDecimalAmount(row[colAmount]);
            }

            // 4. Определение реального адреса объекта:
            // ВАЖНО: спецификации и договоры из contract НИКОГДА не считаем адресом!
            string? address = null;
            if (colAddress != -1 && row[colAddress] != null)
            {
                string colAddr = row[colAddress]?.ToString()?.Trim() ?? "";
                if (!string.IsNullOrWhiteSpace(colAddr)) address = colAddr;
            }

            if (string.IsNullOrWhiteSpace(address) && !string.IsNullOrWhiteSpace(comment))
            {
                address = ExtractRealAddress(comment);
            }

            // 5. Выделение названия изделия из спецификации/счета
            string? productName = ExtractProductName(contract, comment);

            bool isExisting = clientMap.TryGetValue(clientName, out var matchedClient);

            previewList.Add(new Import1CPreviewItemDto
            {
                RowIndex = previewRowCounter++,
                DocNumber = docNum,
                ClientName = clientName,
                IsExistingClient = isExisting,
                ExistingClientId = matchedClient?.Id,
                OrderDate = orderDate,
                PlanShipDate = planShipDate,
                HasExplicitShipDate = hasExplicitShipDate,
                Amount = amount,
                Currency = string.IsNullOrWhiteSpace(currency) ? "BYN" : currency.ToUpperInvariant(),
                Author = author,
                Address = address,
                Comment = comment,
                Contract = contract,
                ProductName = productName,
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
                    // Записываем адрес ТОЛЬКО если найден реальный адрес объекта
                    AdresObekta = !string.IsNullOrWhiteSpace(item.Address) ? item.Address : null
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
            string itemName = !string.IsNullOrWhiteSpace(item.ProductName)
                ? item.ProductName
                : (!string.IsNullOrWhiteSpace(item.DocNumber)
                    ? $"Наряд-заказ №{item.DocNumber}"
                    : $"Мебельный заказ от {item.OrderDate:dd.MM.yyyy}");

            string details = !string.IsNullOrWhiteSpace(item.Contract) ? $"Основание: {item.Contract}" : "";
            if (!string.IsNullOrWhiteSpace(item.Comment))
            {
                details = string.IsNullOrWhiteSpace(details) ? item.Comment : $"{details}; {item.Comment}";
            }

            var izdelie = new Izdelie
            {
                IdZakaza = zakaz.Id,
                ZakazId = zakaz.Id,
                Zakaz = zakaz,
                Naimenovanie = itemName.Length > 150 ? itemName.Substring(0, 150) : itemName,
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

            // 6. Фиксация в журнале аудита с разграничением документа и адреса
            string docInfo = !string.IsNullOrWhiteSpace(item.Contract) ? $" Документ: {item.Contract}." : "";
            string addrInfo = !string.IsNullOrWhiteSpace(item.Address) ? $" Адрес: {item.Address}." : "";
            string prodInfo = !string.IsNullOrWhiteSpace(item.ProductName) ? $" Изделие: {item.ProductName}." : "";

            _context.ZhurnalIzmenenii.Add(new ZhurnalIzmenenii
            {
                IdZakaza = zakaz.Id,
                IdSotrudnika = orderManagerId,
                DataIzmenenia = DateTime.Now,
                OpisanieIzmenenia = $"Заказ импортирован из 1С: наряд №{item.DocNumber}, контрагент «{klient.FioNazvanie}», сумма {item.Amount:N2} {item.Currency}.{docInfo}{prodInfo}{addrInfo}"
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

    /// <summary>
    /// Безопасный парсинг даты
    /// </summary>
    private static DateOnly? TryParseDateOnly(object val)
    {
        if (val == null) return null;
        if (val is DateTime dt) return DateOnly.FromDateTime(dt);

        string s = val.ToString()?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(s)) return null;

        var formats = new[] { "dd.MM.yyyy", "dd.MM.yyyy HH:mm:ss", "yyyy-MM-dd", "d.M.yyyy", "dd/MM/yyyy", "d/M/yyyy" };
        if (DateTime.TryParseExact(s, formats, CultureInfo.InvariantCulture, DateTimeStyles.None, out var parsed))
        {
            return DateOnly.FromDateTime(parsed);
        }

        if (DateTime.TryParse(s, CultureInfo.GetCultureInfo("ru-RU"), DateTimeStyles.None, out var parsedRu))
        {
            return DateOnly.FromDateTime(parsedRu);
        }

        return null;
    }

    /// <summary>
    /// Поиск даты в текстовом комментарии (например: "отгрузка до 25.10.2026", "срок 18.09.2026")
    /// </summary>
    private static DateOnly? TryExtractDateFromText(string text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        var match = Regex.Match(text, @"(?:до|отгрузк[а-я]*|срок|готовност[а-я]*|дедлайн)[\s\:]+(\d{1,2}[\.\/]\d{1,2}[\.\/]\d{2,4})", RegexOptions.IgnoreCase);
        if (match.Success)
        {
            return TryParseDateOnly(match.Groups[1].Value);
        }

        return null;
    }

    /// <summary>
    /// Парсинг денежной суммы
    /// </summary>
    private static decimal ParseDecimalAmount(object val)
    {
        if (val is decimal dec) return dec;
        if (val is double d) return Convert.ToDecimal(d);
        if (val is int i) return Convert.ToDecimal(i);
        if (val is long l) return Convert.ToDecimal(l);

        string s = val.ToString()?.Trim() ?? "";
        if (string.IsNullOrWhiteSpace(s)) return 0;

        s = s.Replace("\u00A0", "").Replace("\u202F", "").Replace(" ", "");
        s = s.Replace(',', '.');
        s = Regex.Replace(s, @"[^\d\.\-]", "");

        if (decimal.TryParse(s, NumberStyles.Any, CultureInfo.InvariantCulture, out var result))
        {
            return result;
        }

        return 0;
    }

    /// <summary>
    /// Извлечение РЕАЛЬНОГО адреса доставки/монтажа объекта.
    /// Отсекает спецификации, договоры, счета, заметки по ценам.
    /// Не путает "2026 г." (год) с "г. Минск" (город).
    /// </summary>
    private static string? ExtractRealAddress(string? text)
    {
        if (string.IsNullOrWhiteSpace(text)) return null;

        // Отсекаем чисто документы или служебные пометки
        if (Regex.IsMatch(text, @"^\s*(спецификаци|договор|счет|акт|накладн|к\.с\.|спец[\.\s])", RegexOptions.IgnoreCase))
            return null;

        if (Regex.IsMatch(text, @"постави?ть\s+цену", RegexOptions.IgnoreCase))
            return null;

        // Признак 1: Город (с буквой города или названием, но НЕ число + г.)
        bool hasCity = Regex.IsMatch(text, @"(\bг\.\s*[А-ЯA-Z]|\bгород\s+[А-ЯA-Z]|Минск|Брест|Гродно|Витебск|Могилев|Гомель|Москва|Санкт-Петербург|СПБ|Омск|Воронеж|Краснодар|Ставрополь|Альметьевск|Киров|Магнитогорск)", RegexOptions.IgnoreCase);
        
        // Признак 2: Улица / проспект / переулок
        bool hasStreet = Regex.IsMatch(text, @"(\bул\.\s*|\bулиц[а-я]\s*|\bпер\.\s*|\bпр-т\s*|\bпр\.\s*|\bпроспект\s*|\bшоссе\s*|\bтракт\s*|\bбульвар\s*)", RegexOptions.IgnoreCase);
        
        // Признак 3: Торговая точка / магазин
        bool hasShop = Regex.IsMatch(text, @"(магазин\s*№|тц\s+|трц\s+)", RegexOptions.IgnoreCase);

        // Признак 4: Номер дома
        bool hasHouse = Regex.IsMatch(text, @"(\bд\.\s*\d+|\bдом\s*\d+|,\s*\d+[А-Яа-яA-Za-z]?)", RegexOptions.IgnoreCase);

        int score = 0;
        if (hasCity) score++;
        if (hasStreet) score++;
        if (hasShop) score++;
        if (hasHouse) score++;

        // Если есть минимум 2 признака (город+улица, магазин+город, улица+дом и т.д.)
        if (score >= 2 || (hasStreet && hasHouse) || (hasCity && hasStreet) || (hasShop && hasCity))
        {
            return text.Trim();
        }

        return null;
    }

    /// <summary>
    /// Извлечение названия изделия/мебели из спецификации или счёта
    /// (например: "Спецификация 414 (JETOUR, вешалка)" -> "JETOUR, вешалка")
    /// </summary>
    private static string? ExtractProductName(string? contract, string? comment)
    {
        if (!string.IsNullOrWhiteSpace(contract))
        {
            // 1. Поиск названия мебели в скобках: Спецификация 414 (JETOUR, вешалка)...
            var match = Regex.Match(contract, @"\(([^)]+)\)");
            if (match.Success)
            {
                string val = match.Groups[1].Value.Trim();
                if (val.Length > 2 && !val.All(char.IsDigit))
                {
                    return val;
                }
            }

            // 2. Если счет-фактура: Счет-фактура №47-781 ...
            var sfMatch = Regex.Match(contract, @"Счет-фактура\s*(№?\s*[\w\-\/]+)", RegexOptions.IgnoreCase);
            if (sfMatch.Success)
            {
                return $"Мебель по счёту {sfMatch.Groups[1].Value.Trim()}";
            }

            // 3. Если спецификация с номером
            var specMatch = Regex.Match(contract, @"Спецификация\s*(№?\s*[\w\-\/]+)", RegexOptions.IgnoreCase);
            if (specMatch.Success)
            {
                return $"Изделия по спец. №{specMatch.Groups[1].Value.Trim()}";
            }
        }

        if (!string.IsNullOrWhiteSpace(comment))
        {
            var match = Regex.Match(comment, @"\(([^)]+)\)");
            if (match.Success)
            {
                string val = match.Groups[1].Value.Trim();
                if (val.Length > 2 && !val.All(char.IsDigit))
                {
                    return val;
                }
            }
        }

        return null;
    }
}
