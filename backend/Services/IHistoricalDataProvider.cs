using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// Abstraction for historical market data providers.
/// Implementations must convert provider-specific responses into
/// the application's internal HistoricalCandle representation.
/// </summary>
public interface IHistoricalDataProvider
{
    /// <summary>
    /// Fetch historical OHLCV candles for the given asset and date range.
    /// </summary>
    /// <param name="asset">The asset to fetch data for (contains provider instrument key).</param>
    /// <param name="startDate">Start of the range (inclusive).</param>
    /// <param name="endDate">End of the range (inclusive).</param>
    /// <param name="resolution">Candle interval: "day", "1minute", "30minute", "week", "month".</param>
    /// <returns>List of normalized OHLCV candles, ordered by timestamp ascending.</returns>
    Task<List<HistoricalCandle>> FetchCandlesAsync(
        Asset asset,
        DateTime startDate,
        DateTime endDate,
        string resolution);

    /// <summary>
    /// Check if the provider is configured and can authenticate.
    /// </summary>
    Task<bool> IsAvailableAsync();
}
