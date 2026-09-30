using Microsoft.EntityFrameworkCore;
using Deadliner.API.Data;
using Deadliner.API.Services;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<DeadlinerContext>(options=>options.UseSqlServer(builder.Configuration.GetConnectionString("DefaultConnection")) );

builder.Services.AddScoped<DeadlineCalculatorService>();

builder.Services.AddControllers().AddJsonOptions(options => options.JsonSerializerOptions.ReferenceHandler = System.Text.Json.Serialization.ReferenceHandler.IgnoreCycles);

var app = builder.Build();

app.UseHttpsRedirection();
app.MapControllers();

app.UseStaticFiles();
app.Run();