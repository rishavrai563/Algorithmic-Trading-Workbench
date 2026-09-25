using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// Orchestrates the full backtest pipeline:
/// Validate → Prepare → Execute → Parse → Respond
/// 
/// This is the primary service consumed by the BacktestController.
/// It coordinates the LeanRunner and LeanResultParser.
/// </summary>
public class BacktestService
{
    private readonly LeanRunner _runner;
    private readonly LeanResultParser _parser;
    private readonly ILogger<BacktestService> _logger;

    public BacktestService(LeanRunner runner, LeanResultParser parser, ILogger<BacktestService> logger)
    {
        _runner = runner;
        _parser = parser;
        _logger = logger;
    }

    /// <summary>
    /// Run a complete backtest from strategy code to structured results.
    /// </summary>
    public async Task<BacktestResponse> RunBacktestAsync(BacktestRequest request)
    {
        _logger.LogInformation("Backtest requested: {Lang}, {Start} to {End}",
            request.Language, request.Configuration.StartDate, request.Configuration.EndDate);

        // Step 1: Validate request
        var validationError = Validate(request);
        if (validationError != null)
        {
            return new BacktestResponse
            {
                Success = false,
                Status = "Failed",
                ErrorMessage = validationError
            };
        }

        // Step 2: Check Docker health
        var (dockerOk, imageOk) = await _runner.CheckHealthAsync();
        if (!dockerOk)
        {
            return new BacktestResponse
            {
                Success = false,
                Status = "Failed",
                ErrorMessage = "Docker is not running. Please start Docker Desktop and try again."
            };
        }
        if (!imageOk)
        {
            return new BacktestResponse
            {
                Success = false,
                Status = "Failed",
                ErrorMessage = "LEAN Docker image (quantconnect/lean:latest) not found. " +
                               "Run: docker pull quantconnect/lean:latest"
            };
        }

        // Step 3: Execute the backtest via LEAN
        var executionResult = await _runner.RunBacktestAsync(
            request.StrategyCode,
            request.Configuration.StartDate,
            request.Configuration.EndDate,
            request.Configuration.StartingCash
        );

        if (!executionResult.Success || string.IsNullOrEmpty(executionResult.RawResultsJson))
        {
            return new BacktestResponse
            {
                Success = false,
                Status = "Failed",
                ErrorMessage = executionResult.ErrorMessage ?? "LEAN execution failed — no results produced.",
                LeanLogs = executionResult.Stdout
            };
        }

        // Step 4: Parse results
        var response = _parser.Parse(executionResult.RawResultsJson);
        response.LeanLogs = executionResult.Stdout;

        _logger.LogInformation("Backtest completed: success={Success}, trades={Trades}",
            response.Success, response.Trades?.Count ?? 0);

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
}
