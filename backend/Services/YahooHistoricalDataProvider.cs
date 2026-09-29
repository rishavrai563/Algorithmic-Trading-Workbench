using System.Globalization;
using System.Text.Json;
using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// Yahoo Finance Historical Data Provider.
/// 
/// Fetches OHLCV candle data for free without requiring API keys.
/// Endpoint: https://query2.finance.yahoo.com/v8/finance/chart/{symbol}?period1={start}&period2={end}&interval={res}
/// </summary>
public class YahooHistoricalDataProvider : IHistoricalDataProvider
{
    private readonly HttpClient _httpClient;
    private readonly ILogger<YahooHistoricalDataProvider> _logger;
    private const string BaseUrl = "https://query2.finance.yahoo.com/v8/finance/chart";

    public YahooHistoricalDataProvider(
        HttpClient httpClient,
        ILogger<YahooHistoricalDataProvider> logger)
    {
        _httpClient = httpClient;
        _logger = logger;
        
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
        _httpClient.DefaultRequestHeaders.Add("User-Agent", "Mozilla/5.0 (Windows NT 10.0; Win64; x64)");
    }

    public async Task<List<HistoricalCandle>> FetchCandlesAsync(
        Asset asset, DateTime startDate, DateTime endDate, string resolution)
    {
        // Convert dates to Unix timestamps
        long period1 = new DateTimeOffset(startDate, TimeSpan.Zero).ToUnixTimeSeconds();
        long period2 = new DateTimeOffset(endDate.AddDays(1).AddSeconds(-1), TimeSpan.Zero).ToUnixTimeSeconds();
        
        string interval = MapResolution(resolution);
        string symbol = Uri.EscapeDataString(asset.ProviderInstrumentKey);
        
        string url = $"{BaseUrl}/{symbol}?period1={period1}&period2={period2}&interval={interval}";
        _logger.LogInformation("Yahoo request: GET {Url}", url);

        try
        {
            var response = await _httpClient.GetAsync(url);
            var body = await response.Content.ReadAsStringAsync();

            if (!response.IsSuccessStatusCode)
            {
                _logger.LogError("Yahoo API error: {Status} - {Body}", (int)response.StatusCode, body);
                throw new InvalidOperationException($"Yahoo Finance API error ({(int)response.StatusCode}). Symbol may be invalid.");
            }

            return ParseYahooResponse(body);
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException($"Network error connecting to Yahoo Finance: {ex.Message}", ex);
        }
    }

    public Task<bool> IsAvailableAsync()
    {
        // Yahoo Finance is public and doesn't require keys, so it is assumed available
        return Task.FromResult(true);
    }

    private List<HistoricalCandle> ParseYahooResponse(string json)
    {
        var candles = new List<HistoricalCandle>();
        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        if (!root.TryGetProperty("chart", out var chart)) return candles;
        if (!chart.TryGetProperty("result", out var result) || result.ValueKind != JsonValueKind.Array || result.GetArrayLength() == 0) return candles;
        
        var resultObj = result[0];
        if (!resultObj.TryGetProperty("timestamp", out var timestampArray) || timestampArray.ValueKind != JsonValueKind.Array) return candles;
        if (!resultObj.TryGetProperty("indicators", out var indicators)) return candles;
        if (!indicators.TryGetProperty("quote", out var quoteArray) || quoteArray.ValueKind != JsonValueKind.Array || quoteArray.GetArrayLength() == 0) return candles;
        
        var quote = quoteArray[0];
        if (!quote.TryGetProperty("open", out var opens) || opens.ValueKind != JsonValueKind.Array) return candles;
        if (!quote.TryGetProperty("high", out var highs) || highs.ValueKind != JsonValueKind.Array) return candles;
        if (!quote.TryGetProperty("low", out var lows) || lows.ValueKind != JsonValueKind.Array) return candles;
        if (!quote.TryGetProperty("close", out var closes) || closes.ValueKind != JsonValueKind.Array) return candles;
        if (!quote.TryGetProperty("volume", out var volumes) || volumes.ValueKind != JsonValueKind.Array) return candles;

        int count = timestampArray.GetArrayLength();
        for (int i = 0; i < count; i++)
        {
            try
            {
                if (opens[i].ValueKind == JsonValueKind.Null || closes[i].ValueKind == JsonValueKind.Null)
                    continue;

                long ts = timestampArray[i].GetInt64();
                candles.Add(new HistoricalCandle
                {
                    Timestamp = DateTimeOffset.FromUnixTimeSeconds(ts).UtcDateTime,
                    Open = opens[i].GetDouble(),
                    High = highs[i].GetDouble(),
                    Low = lows[i].GetDouble(),
                    Close = closes[i].GetDouble(),
                    Volume = volumes[i].ValueKind == JsonValueKind.Null ? 0 : volumes[i].GetDouble()
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse candle entry at index {Index}, skipping", i);
            }
        }

        return candles;
    }

    private static string MapResolution(string resolution)
    {
        return resolution.ToLower() switch
        {
            "day" => "1d",
            "week" => "1wk",
            "month" => "1mo",
            "1minute" => "1m",
            "30minute" => "30m",
            _ => "1d"
        };
    }
}
