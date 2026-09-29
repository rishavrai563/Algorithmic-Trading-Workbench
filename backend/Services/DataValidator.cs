using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// Validates and normalizes OHLCV candle data before it reaches LEAN.
/// 
/// Validation rules:
/// - Timestamp is valid and non-default
/// - Timestamps are in ascending order
/// - Duplicate timestamps are removed (keeps first occurrence)
/// - OHLC values are positive and numerically valid
/// - High >= max(Open, Close)
/// - Low  <= min(Open, Close)
/// - Volume is non-negative
/// - No NaN or Infinity values
/// 
/// Invalid candles are removed rather than causing a corrupted backtest.
/// Warnings are logged for each rejected record.
/// </summary>
public class DataValidator
{
    private readonly ILogger<DataValidator> _logger;

    public DataValidator(ILogger<DataValidator> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Validate and normalize a list of candles.
    /// Returns only the valid candles, ordered by timestamp.
    /// </summary>
    public List<HistoricalCandle> ValidateAndNormalize(List<HistoricalCandle> candles, string symbol)
    {
        if (candles.Count == 0)
        {
            _logger.LogWarning("No candles provided for validation ({Symbol})", symbol);
            return candles;
        }

        var valid = new List<HistoricalCandle>();
        int rejected = 0;

        foreach (var candle in candles)
        {
            var errors = ValidateCandle(candle);
            if (errors.Count > 0)
            {
                rejected++;
                if (rejected <= 5) // Log first 5 rejections in detail
                {
                    _logger.LogWarning("Rejected candle for {Symbol} at {Time}: {Errors}",
                        symbol, candle.Timestamp, string.Join("; ", errors));
                }
                continue;
            }

            // Normalize: fix minor OHLC inconsistencies
            NormalizeCandle(candle);
            valid.Add(candle);
        }

        // Remove duplicates by timestamp (keep first)
        var deduped = valid
            .GroupBy(c => c.Timestamp)
            .Select(g => g.First())
            .OrderBy(c => c.Timestamp)
            .ToList();

        int dupes = valid.Count - deduped.Count;

        _logger.LogInformation(
            "Validation for {Symbol}: {Input} input, {Valid} valid, {Rejected} rejected, {Dupes} duplicates removed",
            symbol, candles.Count, deduped.Count, rejected, dupes);

        return deduped;
    }

    /// <summary>
    /// Validate a single candle. Returns a list of error descriptions (empty = valid).
    /// </summary>
    private static List<string> ValidateCandle(HistoricalCandle candle)
    {
        var errors = new List<string>();

        // Timestamp checks
        if (candle.Timestamp == default)
            errors.Add("Timestamp is missing or default");
        if (candle.Timestamp > DateTime.Now.AddDays(1))
            errors.Add($"Timestamp is in the future: {candle.Timestamp}");

        // Numeric validity
        if (double.IsNaN(candle.Open) || double.IsInfinity(candle.Open))
            errors.Add("Open is NaN/Infinity");
        if (double.IsNaN(candle.High) || double.IsInfinity(candle.High))
            errors.Add("High is NaN/Infinity");
        if (double.IsNaN(candle.Low) || double.IsInfinity(candle.Low))
            errors.Add("Low is NaN/Infinity");
        if (double.IsNaN(candle.Close) || double.IsInfinity(candle.Close))
            errors.Add("Close is NaN/Infinity");
        if (double.IsNaN(candle.Volume) || double.IsInfinity(candle.Volume))
            errors.Add("Volume is NaN/Infinity");

        // Positive price check
        if (candle.Open <= 0) errors.Add($"Open is non-positive: {candle.Open}");
        if (candle.High <= 0) errors.Add($"High is non-positive: {candle.High}");
        if (candle.Low <= 0) errors.Add($"Low is non-positive: {candle.Low}");
        if (candle.Close <= 0) errors.Add($"Close is non-positive: {candle.Close}");

        // Non-negative volume
        if (candle.Volume < 0) errors.Add($"Volume is negative: {candle.Volume}");

        // OHLC consistency (only check if all values are positive)
        if (errors.Count == 0)
        {
            if (candle.High < Math.Max(candle.Open, candle.Close))
                errors.Add($"High ({candle.High}) < max(Open, Close) ({Math.Max(candle.Open, candle.Close)})");
            if (candle.Low > Math.Min(candle.Open, candle.Close))
                errors.Add($"Low ({candle.Low}) > min(Open, Close) ({Math.Min(candle.Open, candle.Close)})");
        }

        return errors;
    }

    /// <summary>
    /// Fix minor OHLC inconsistencies without rejecting the candle.
    /// For example, if High is slightly below Close due to rounding,
    /// adjust High to be the max of all prices.
    /// </summary>
    private static void NormalizeCandle(HistoricalCandle candle)
    {
        // Ensure High is actually the highest
        candle.High = Math.Max(candle.High, Math.Max(candle.Open, candle.Close));

        // Ensure Low is actually the lowest
        candle.Low = Math.Min(candle.Low, Math.Min(candle.Open, candle.Close));

        // Ensure volume is at least 0
        if (candle.Volume < 0) candle.Volume = 0;
    }
}
