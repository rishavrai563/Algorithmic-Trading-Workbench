using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// Orchestrates the full backtest pipeline:
/// Validate → Resolve Asset → Fetch Data → Prepare LEAN → Execute → Parse → Respond
/// 
/// This is the primary service consumed by the BacktestController.
/// It coordinates HistoricalDataService, LeanRunner, and LeanResultParser.
/// </summary>
public class BacktestService
{
    private readonly HistoricalDataService _dataService;
    private readonly LeanRunner _runner;
    private readonly LeanResultParser _parser;
    private readonly ILogger<BacktestService> _logger;

    public BacktestService(
        HistoricalDataService dataService,
        LeanRunner runner,
        LeanResultParser parser,
        ILogger<BacktestService> logger)
    {
        _dataService = dataService;
        _runner = runner;
        _parser = parser;
        _logger = logger;
    }

    /// <summary>
    /// Run a complete backtest from strategy code to structured results.
    /// </summary>
    public async Task<BacktestResponse> RunBacktestAsync(BacktestRequest request, string jobId = null, JobManager jobManager = null)
    {
        void UpdateProgress(int p, string s) { if (jobId != null && jobManager != null) jobManager.UpdateJob(jobId, p, s); }
        
        var config = request.Configuration;
        _logger.LogInformation("Backtest requested: {Asset}, {Start} to {End}, {Resolution}",
            config.Asset, config.StartDate, config.EndDate, config.Resolution);

        UpdateProgress(5, "Validating request...");
        var validationError = Validate(request);
        if (validationError != null)
        {
            return new BacktestResponse { Success = false, Status = "Failed", ErrorMessage = validationError };
        }

        UpdateProgress(10, "Checking Docker & LEAN Engine...");
        var (dockerOk, imageOk) = await _runner.CheckHealthAsync();
        if (!dockerOk) return new BacktestResponse { Success = false, Status = "Failed", ErrorMessage = "Docker is not running." };
        if (!imageOk) return new BacktestResponse { Success = false, Status = "Failed", ErrorMessage = "LEAN Docker image not found." };

        UpdateProgress(20, $"Fetching historical data for {config.Asset}...");
        var startDate = DateTime.Parse(config.StartDate);
        var endDate = DateTime.Parse(config.EndDate);
        var resolution = AssetRegistry.MapResolution(config.Resolution);

        var dataResult = await _dataService.GetDataAsync(config.Asset, startDate, endDate, resolution);
        if (!dataResult.Success || dataResult.Candles.Count == 0)
        {
            return new BacktestResponse { Success = false, Status = "Failed", ErrorMessage = dataResult.ErrorMessage ?? "Could not obtain historical data." };
        }

        var dataFileName = Path.GetFileName(dataResult.CsvFilePath!);

        UpdateProgress(50, "Executing strategy in LEAN Engine...");
        var executionResult = await _runner.RunBacktestAsync(
            request.StrategyCode, config.StartDate, config.EndDate, config.StartingCash,
            config.Asset.Replace(" ", "").ToUpper(), dataFileName, resolution, config.Parameters
        );

        if (!executionResult.Success || string.IsNullOrEmpty(executionResult.RawResultsJson))
        {
            return new BacktestResponse { Success = false, Status = "Failed", ErrorMessage = executionResult.ErrorMessage ?? "LEAN execution failed.", LeanLogs = executionResult.Stdout };
        }

        UpdateProgress(85, "Parsing backtest results...");
        var response = _parser.Parse(executionResult.RawResultsJson);
        response.LeanLogs = executionResult.Stdout;

        UpdateProgress(95, "Generating OHLC charts...");
        response.OhlcData = dataResult.Candles
            .Select(c => new OhlcCandle { Time = new DateTimeOffset(c.Timestamp).ToUnixTimeSeconds(), Open = c.Open, High = c.High, Low = c.Low, Close = c.Close })
            .ToList();

        UpdateProgress(100, "Complete!");
        return response;
    }

    /// <summary>
    /// Validate the incoming backtest request.
    /// Returns null if valid, or an error message string.
    /// </summary>
    private static string? Validate(BacktestRequest request)
    {
        if (string.IsNullOrWhiteSpace(request.StrategyCode))
            return "Strategy code cannot be empty.";

        if (request.Language?.ToLower() != "python")
            return "Only Python strategies are currently supported.";

        if (string.IsNullOrWhiteSpace(request.Configuration.Asset))
            return "Asset selection is required.";

        if (string.IsNullOrWhiteSpace(request.Configuration.StartDate))
            return "Start date is required.";

        if (string.IsNullOrWhiteSpace(request.Configuration.EndDate))
            return "End date is required.";

        if (!DateTime.TryParse(request.Configuration.StartDate, out var start))
            return $"Invalid start date format: {request.Configuration.StartDate}";

        if (!DateTime.TryParse(request.Configuration.EndDate, out var end))
            return $"Invalid end date format: {request.Configuration.EndDate}";

        if (start >= end)
            return "Start date must be before end date.";

        return null;
    }

    /// <summary>
    /// Quick health check for the frontend to show Docker status.
    /// </summary>
    public async Task<object> GetStatusAsync()
    {
        var (dockerOk, imageOk) = await _runner.CheckHealthAsync();
        return new { dockerAvailable = dockerOk, leanImageExists = imageOk };
    }

    /// <summary>
    /// Get the list of supported assets for the frontend.
    /// </summary>
    public List<string> GetSupportedAssets() => _dataService.GetSupportedAssets();
}
