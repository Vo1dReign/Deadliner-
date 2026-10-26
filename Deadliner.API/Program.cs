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

builder.Services.AddDbContext<DeadlinerContext>(options=>options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")) );

System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

builder.Services.AddScoped<DeadlineCalculatorService>();
builder.Services.AddScoped<Excel1CImportService>();

builder.Services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

var app = builder.Build();

app.MapControllers();

app.UseStaticFiles();
app.Run();
