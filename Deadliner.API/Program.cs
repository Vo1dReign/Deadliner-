using System.Reflection;
using System.Runtime.Loader;
using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Services;

// Автоматическое разрешение зависимостей от netstandard для SqlClient / EF Core
AssemblyLoadContext.Default.Resolving += (context, assemblyName) =>
{
    if (assemblyName.Name == "netstandard")
    {
        try
        {
            return Assembly.Load("netstandard");
        }
        catch
        {
            return typeof(object).Assembly;
        }
    }
    return null;
};

var builder = WebApplication.CreateBuilder(args);

// База данных
builder.Services.AddDbContext<DeadlinerContext>(options =>
    options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")));

System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

// Кэш памяти для одноразовых проверочных SMS/OTP кодов
builder.Services.AddMemoryCache();

// Сервисы бизнес-логики и безопасности
builder.Services.AddScoped<DeadlineCalculatorService>();
builder.Services.AddScoped<Excel1CImportService>();
builder.Services.AddScoped<PasswordHasherService>();
builder.Services.AddScoped<PhoneVerificationService>();

builder.Services.AddControllers().AddJsonOptions(options =>
    options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

var app = builder.Build();

// Промежуточный слой безопасности: Заголовки HTTP Security
app.Use(async (context, next) =>
{
    context.Response.Headers.Append("X-Content-Type-Options", "nosniff");
    context.Response.Headers.Append("X-Frame-Options", "SAMEORIGIN");
    context.Response.Headers.Append("X-XSS-Protection", "1; mode=block");
    context.Response.Headers.Append("Referrer-Policy", "strict-origin-when-cross-origin");
    
    // Если запрос по HTTPS, добавляем строгий HSTS
    if (context.Request.IsHttps)
    {
        context.Response.Headers.Append("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
    }

    await next();
});

// Автоматическое перенаправление HTTP -> HTTPS (если порт настроен)
if (!app.Environment.IsDevelopment())
{
    app.UseHttpsRedirection();
}

app.MapControllers();
app.UseStaticFiles();
app.Run();
