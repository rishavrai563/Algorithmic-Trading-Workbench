using Microsoft.AspNetCore.Mvc;
using AlgoTrading.Models;
using AlgoTrading.Services;

namespace AlgoTrading.Controllers;

/// <summary>
/// API controller for backtest operations.
/// 
/// Endpoints:
///   POST /api/backtest        — Submit and run a backtest
///   GET  /api/backtest/status  — Check Docker/LEAN health
///   GET  /api/backtest/assets  — Get supported assets list
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class BacktestController : ControllerBase
{
    private readonly BacktestService _service;
    private readonly ILogger<BacktestController> _logger;

    public BacktestController(BacktestService service, ILogger<BacktestController> logger)
    {
        _service = service;
        _logger = logger;
    }

    /// <summary>
    /// Submit a backtest request.
    /// The request body must contain the complete Python strategy code
    /// and backtest configuration (asset, dates, resolution, starting cash).
    /// </summary>
    [HttpPost]
    public async Task<ActionResult<BacktestResponse>> RunBacktest([FromBody] BacktestRequest request)
    {
        _logger.LogInformation("POST /api/backtest received — asset: {Asset}, code length: {Len}",
            request.Configuration.Asset, request.StrategyCode?.Length ?? 0);

        try
        {
            var result = await _service.RunBacktestAsync(request);
            return Ok(result);
        }
        catch (Exception ex)
        {
            _logger.LogError(ex, "Unhandled error in backtest endpoint");
            return StatusCode(500, new BacktestResponse
            {
                Success = false,
                Status = "Failed",
                ErrorMessage = $"Internal server error: {ex.Message}"
            });
        }
    }

    /// <summary>
    /// Health check endpoint.
    /// Returns Docker availability and whether the LEAN image is present.
    /// </summary>
    [HttpGet("status")]
    public async Task<ActionResult> GetStatus()
    {
        var status = await _service.GetStatusAsync();
        return Ok(status);
    }

    /// <summary>
    /// Get the list of supported assets for the frontend dropdown.
    /// Never exposes provider-specific instrument keys.
    /// </summary>
    [HttpGet("assets")]
    public ActionResult GetAssets()
    {
        var assets = _service.GetSupportedAssets();
        return Ok(new { assets });
    }
}
