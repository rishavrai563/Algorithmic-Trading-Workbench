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
    private readonly JobManager _jobManager;
    private readonly ILogger<BacktestController> _logger;

    public BacktestController(BacktestService service, JobManager jobManager, ILogger<BacktestController> logger)
    {
        _service = service;
        _jobManager = jobManager;
        _logger = logger;
    }

    [HttpPost]
    public ActionResult RunBacktest([FromBody] BacktestRequest request)
    {
        _logger.LogInformation("POST /api/backtest received — asset: {Asset}, code length: {Len}",
            request.Configuration.Asset, request.StrategyCode?.Length ?? 0);

        var job = _jobManager.CreateJob();
        
        _ = Task.Run(async () => {
            try {
                var result = await _service.RunBacktestAsync(request, job.Id, _jobManager);
                _jobManager.CompleteJob(job.Id, result);
            } catch (Exception ex) {
                _logger.LogError(ex, "Unhandled error in backtest endpoint");
                _jobManager.CompleteJob(job.Id, new BacktestResponse {
                    Success = false, Status = "Failed", ErrorMessage = $"Internal server error: {ex.Message}"
                });
            }
        });

        return Ok(new { jobId = job.Id });
    }

    [HttpGet("{id}/status")]
    public ActionResult GetJobStatus(string id)
    {
        var job = _jobManager.GetJob(id);
        if (job == null) return NotFound();
        if (job.IsComplete) return Ok(new { isComplete = true, result = job.Result });
        return Ok(new { isComplete = false, progress = job.Progress, status = job.Status });
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
