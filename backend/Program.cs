using AlgoTrading.Services;

var builder = WebApplication.CreateBuilder(args);

// Register services
builder.Services.AddControllers();
builder.Services.AddSingleton<AssetRegistry>();
builder.Services.AddSingleton<LeanRunner>();
builder.Services.AddSingleton<LeanResultParser>();
builder.Services.AddSingleton<DataValidator>();
builder.Services.AddSingleton<JobManager>();
builder.Services.AddHttpClient<YahooHistoricalDataProvider>();
builder.Services.AddSingleton<IHistoricalDataProvider, YahooHistoricalDataProvider>();
builder.Services.AddSingleton<HistoricalDataService>();
builder.Services.AddScoped<BacktestService>();

// CORS — allow the Vite dev server
builder.Services.AddCors(options =>
{
    options.AddDefaultPolicy(policy =>
    {
        policy.WithOrigins("http://localhost:5173", "http://127.0.0.1:5173")
              .AllowAnyHeader()
              .AllowAnyMethod();
    });
});

var app = builder.Build();

app.UseCors();
app.MapControllers();

app.Run();
