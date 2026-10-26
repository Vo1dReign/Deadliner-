namespace Deadliner.API.Models;

/// <summary>
/// Универсальная модель для возврата пагинированных данных API
/// </summary>
/// <typeparam name="T">Тип сущности или DTO</typeparam>
public class PagedResult<T>
{
    /// <summary>
    /// Общее количество записей, удовлетворяющих фильтру
    /// </summary>
    public int TotalCount { get; set; }

    /// <summary>
    /// Номер текущей страницы (1-based)
    /// </summary>
    public int Page { get; set; }

    /// <summary>
    /// Размер страницы (количество элементов)
    /// </summary>
    public int PageSize { get; set; }

    /// <summary>
    /// Общее количество страниц
    /// </summary>
    public int TotalPages { get; set; }

    /// <summary>
    /// Есть ли предыдущая страница
    /// </summary>
    public bool HasPreviousPage => Page > 1;

    /// <summary>
    /// Есть ли следующая страница
    /// </summary>
    public bool HasNextPage => Page < TotalPages;

    /// <summary>
    /// Список элементов текущей страницы
    /// </summary>
    public IEnumerable<T> Items { get; set; } = [];
}
