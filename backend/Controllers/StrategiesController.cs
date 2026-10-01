using Microsoft.AspNetCore.Mvc;
using AlgoTrading.Models;
using AlgoTrading.Services;

namespace AlgoTrading.Controllers;

/// <summary>
/// CRUD controller for strategy profiles and backtest history.
///
/// Endpoints:
///   GET    /api/strategies              — List all strategies
///   GET    /api/strategies/{id}         — Get single strategy
///   POST   /api/strategies              — Create new blank strategy
///   PUT    /api/strategies/{id}         — Save/update a strategy
///   DELETE /api/strategies/{id}         — Delete a strategy
///   GET    /api/strategies/history      — All backtest records
///   GET    /api/strategies/{id}/history — Backtest records for one strategy
///   POST   /api/strategies/{id}/history — Record a completed backtest
/// </summary>
[ApiController]
[Route("api/[controller]")]
public class StrategiesController : ControllerBase
{
    private readonly StrategyStore _store;
    private readonly ILogger<StrategiesController> _logger;

    public StrategiesController(StrategyStore store, ILogger<StrategiesController> logger)
    {
        _store = store;
        _logger = logger;
    }

    [HttpGet]
    public ActionResult GetAll()
    {
        var strategies = _store.GetAllStrategies();
        return Ok(strategies);
    }

    [HttpGet("{id}")]
    public ActionResult GetOne(string id)
    {
        var s = _store.GetStrategy(id);
        if (s == null) return NotFound();
        return Ok(s);
    }

    [HttpPost]
    public ActionResult Create([FromBody] StrategyProfile profile)
    {
        var created = _store.CreateStrategy(profile);
        _logger.LogInformation("Created strategy: {Name} ({Id})", created.Name, created.Id);
        return Ok(created);
    }

    [HttpPut("{id}")]
    public ActionResult Update(string id, [FromBody] StrategyProfile profile)
    {
        var updated = _store.UpdateStrategy(id, profile);
        if (updated == null) return NotFound();
        _logger.LogInformation("Updated strategy: {Name} ({Id})", updated.Name, updated.Id);
        return Ok(updated);
    }

    [HttpDelete("{id}")]
    public ActionResult Delete(string id)
    {
        if (!_store.DeleteStrategy(id)) return NotFound();
        _logger.LogInformation("Deleted strategy: {Id}", id);
        return Ok(new { deleted = true });
    }

    // ── Backtest History ───────────────────────────────────

    [HttpGet("history")]
    public ActionResult GetAllHistory()
    {
        return Ok(_store.GetBacktestHistory());
    }

    [HttpGet("{id}/history")]
    public ActionResult GetStrategyHistory(string id)
    {
        return Ok(_store.GetHistoryForStrategy(id));
    }

    [HttpPost("{id}/history")]
    public ActionResult RecordBacktest(string id, [FromBody] BacktestRecord record)
    {
        record.StrategyId = id;
        var saved = _store.AddBacktestRecord(record);
        _logger.LogInformation("Recorded backtest for strategy {Id}: {Return}%", id, saved.TotalReturn);
        return Ok(saved);
    }
}
