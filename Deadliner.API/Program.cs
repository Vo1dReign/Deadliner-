using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<DeadlinerContext>(options=>options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")) );

System.Text.Encoding.RegisterProvider(System.Text.CodePagesEncodingProvider.Instance);

builder.Services.AddScoped<DeadlineCalculatorService>();
builder.Services.AddScoped<Excel1CImportService>();

builder.Services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

var app = builder.Build();

app.UseHttpsRedirection();
app.MapControllers();

app.UseStaticFiles();
app.Run();