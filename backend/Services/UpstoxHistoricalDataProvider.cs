using System.Globalization;
using System.Text.Json;
using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// Upstox Historical Data Provider.
/// 
/// Fetches OHLCV candle data from the Upstox v2 Historical Candle API.
/// 
/// Endpoint: GET https://api.upstox.com/v2/historical-candle/{instrument_key}/{interval}/{to_date}/{from_date}
/// 
/// Response format:
/// {
///   "status": "success",
///   "data": {
///     "candles": [
///       ["2023-10-01T00:00:00+05:30", 53.1, 53.95, 51.6, 52.05, 235519861, 0],
///       ...
///     ]
///   }
/// }
/// 
/// Each candle array: [Timestamp, Open, High, Low, Close, Volume, OpenInterest]
/// 
/// Data limits per interval:
/// - 1minute: last 1 month from to_date
/// - 30minute: last 1 year from to_date
/// - day: last 1 year from to_date
/// - week/month: last 10 years from to_date
/// </summary>
public class UpstoxHistoricalDataProvider : IHistoricalDataProvider
{
    private readonly HttpClient _httpClient;
    private readonly IConfiguration _configuration;
    private readonly ILogger<UpstoxHistoricalDataProvider> _logger;
    private const string BaseUrl = "https://api.upstox.com/v2/historical-candle";

    public UpstoxHistoricalDataProvider(
        HttpClient httpClient,
        IConfiguration configuration,
        ILogger<UpstoxHistoricalDataProvider> logger)
    {
        _httpClient = httpClient;
        _configuration = configuration;
        _logger = logger;

        // Set timeout
        _httpClient.Timeout = TimeSpan.FromSeconds(30);
    }

    /// <inheritdoc />
    public async Task<List<HistoricalCandle>> FetchCandlesAsync(
        Asset asset,
        DateTime startDate,
        DateTime endDate,
        string resolution)
    {
        var allCandles = new List<HistoricalCandle>();

        // Upstox has per-interval date range limits.
        // For ranges exceeding the limit, we chunk the requests.
        var chunks = GetDateChunks(startDate, endDate, resolution);

        foreach (var (chunkStart, chunkEnd) in chunks)
        {
            var candles = await FetchChunkAsync(asset, chunkStart, chunkEnd, resolution);
            allCandles.AddRange(candles);
        }

        // Deduplicate by timestamp and sort ascending
        allCandles = allCandles
            .GroupBy(c => c.Timestamp)
            .Select(g => g.First())
            .OrderBy(c => c.Timestamp)
            .ToList();

        _logger.LogInformation(
            "Fetched {Count} candles for {Symbol} ({Start} to {End}, {Resolution})",
            allCandles.Count, asset.Symbol, startDate.ToString("yyyy-MM-dd"),
            endDate.ToString("yyyy-MM-dd"), resolution);

        return allCandles;
    }

    /// <inheritdoc />
    public async Task<bool> IsAvailableAsync()
    {
        var token = GetAccessToken();
        if (string.IsNullOrWhiteSpace(token))
        {
            _logger.LogWarning("Upstox access token not configured");
            return false;
        }

        // Quick health check: fetch 1 day of NIFTY 50 data
        try
        {
            var url = $"{BaseUrl}/NSE_INDEX%7CNifty%2050/day/" +
                      $"{DateTime.Today:yyyy-MM-dd}/{DateTime.Today.AddDays(-1):yyyy-MM-dd}";
            var request = new HttpRequestMessage(HttpMethod.Get, url);
            request.Headers.Add("Accept", "application/json");
            request.Headers.Add("Authorization", $"Bearer {token}");

            var response = await _httpClient.SendAsync(request);
            return response.IsSuccessStatusCode;
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Upstox availability check failed");
            return false;
        }
    }

    /// <summary>
    /// Fetch a single chunk of candle data from Upstox.
    /// </summary>
    private async Task<List<HistoricalCandle>> FetchChunkAsync(
        Asset asset, DateTime startDate, DateTime endDate, string resolution)
    {
        var token = GetAccessToken();
        if (string.IsNullOrWhiteSpace(token))
        {
            throw new InvalidOperationException(
                "Upstox access token is not configured. " +
                "Set the UPSTOX_ACCESS_TOKEN environment variable or add it to appsettings.json.");
        }

        // URL-encode the instrument key (pipe | becomes %7C, spaces become %20)
        var encodedKey = Uri.EscapeDataString(asset.ProviderInstrumentKey);
        var toDate = endDate.ToString("yyyy-MM-dd");
        var fromDate = startDate.ToString("yyyy-MM-dd");

        var url = $"{BaseUrl}/{encodedKey}/{resolution}/{toDate}/{fromDate}";
        _logger.LogInformation("Upstox request: GET {Url}", url);

        var request = new HttpRequestMessage(HttpMethod.Get, url);
        request.Headers.Add("Accept", "application/json");
        request.Headers.Add("Authorization", $"Bearer {token}");

        HttpResponseMessage response;
        try
        {
            response = await _httpClient.SendAsync(request);
        }
        catch (TaskCanceledException)
        {
            throw new TimeoutException(
                $"Upstox API request timed out after {_httpClient.Timeout.TotalSeconds}s. " +
                "The server may be experiencing high load. Try again later.");
        }
        catch (HttpRequestException ex)
        {
            throw new InvalidOperationException(
                $"Network error connecting to Upstox: {ex.Message}. " +
                "Check your internet connection.", ex);
        }

        var body = await response.Content.ReadAsStringAsync();

        if (!response.IsSuccessStatusCode)
        {
            // Rate limiting
            if ((int)response.StatusCode == 429)
            {
                throw new InvalidOperationException(
                    "Upstox API rate limit exceeded. Please wait a moment and try again.");
            }

            // Authentication failure
            if (response.StatusCode == System.Net.HttpStatusCode.Unauthorized ||
                response.StatusCode == System.Net.HttpStatusCode.Forbidden)
            {
                throw new InvalidOperationException(
                    "Upstox authentication failed. The access token may be expired or invalid. " +
                    "Please refresh your Upstox access token.");
            }

            _logger.LogError("Upstox API error: {Status} - {Body}",
                (int)response.StatusCode, body.Length > 500 ? body[..500] : body);

            throw new InvalidOperationException(
                $"Upstox API returned error ({(int)response.StatusCode}). " +
                "Check the selected instrument or date range.");
        }

        return ParseUpstoxResponse(body);
    }

    /// <summary>
    /// Parse the Upstox JSON response into normalized HistoricalCandle objects.
    /// 
    /// Response format: { "status": "success", "data": { "candles": [[ts, O, H, L, C, Vol, OI], ...] } }
    /// </summary>
    private List<HistoricalCandle> ParseUpstoxResponse(string json)
    {
        var candles = new List<HistoricalCandle>();

        using var doc = JsonDocument.Parse(json);
        var root = doc.RootElement;

        // Check status
        if (root.TryGetProperty("status", out var status) &&
            status.GetString() != "success")
        {
            _logger.LogWarning("Upstox response status: {Status}", status.GetString());
            return candles;
        }

        // Navigate to data.candles
        if (!root.TryGetProperty("data", out var data)) return candles;
        if (!data.TryGetProperty("candles", out var candlesArray)) return candles;
        if (candlesArray.ValueKind != JsonValueKind.Array) return candles;

        foreach (var candleArr in candlesArray.EnumerateArray())
        {
            if (candleArr.ValueKind != JsonValueKind.Array || candleArr.GetArrayLength() < 6)
                continue;

            try
            {
                var timestampStr = candleArr[0].GetString();
                if (string.IsNullOrEmpty(timestampStr)) continue;

                // Parse ISO 8601 timestamp (e.g., "2023-10-01T00:00:00+05:30")
                if (!DateTimeOffset.TryParse(timestampStr, CultureInfo.InvariantCulture,
                    DateTimeStyles.None, out var dto))
                    continue;

                candles.Add(new HistoricalCandle
                {
                    Timestamp = dto.DateTime,
                    Open = candleArr[1].GetDouble(),
                    High = candleArr[2].GetDouble(),
                    Low = candleArr[3].GetDouble(),
                    Close = candleArr[4].GetDouble(),
                    Volume = candleArr[5].GetDouble()
                });
            }
            catch (Exception ex)
            {
                _logger.LogWarning(ex, "Failed to parse candle entry, skipping");
            }
        }

        return candles;
    }

    /// <summary>
    /// Break a large date range into chunks that fit within Upstox's per-interval limits.
    /// </summary>
    private static List<(DateTime Start, DateTime End)> GetDateChunks(
        DateTime startDate, DateTime endDate, string resolution)
    {
        var chunks = new List<(DateTime, DateTime)>();

        // Max range per request based on Upstox documentation
        int maxDays = resolution switch
        {
            "1minute" => 28,     // ~1 month
            "30minute" => 360,   // ~1 year
            "day" => 360,        // ~1 year
            "week" => 3600,      // ~10 years
            "month" => 3600,     // ~10 years
            _ => 360
        };

        var current = startDate;
        while (current < endDate)
        {
            var chunkEnd = current.AddDays(maxDays);
            if (chunkEnd > endDate) chunkEnd = endDate;

            chunks.Add((current, chunkEnd));
            current = chunkEnd.AddDays(1);
        }

        return chunks;
    }

    /// <summary>
    /// Get the Upstox access token from configuration.
    /// Priority: Environment variable > appsettings.json
    /// </summary>
    private string? GetAccessToken()
    {
        // Prefer environment variable
        var token = Environment.GetEnvironmentVariable("UPSTOX_ACCESS_TOKEN");
        if (!string.IsNullOrWhiteSpace(token)) return token;

        // Fall back to configuration
        return _configuration["Upstox:AccessToken"];
    }
}
