using System.Globalization;
using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// Orchestrates historical data acquisition with intelligent caching.
/// 
/// Flow:
/// 1. Resolve asset → check AssetRegistry
/// 2. Check local cache for existing data
/// 3. Determine if cache covers the requested range
/// 4. Fetch only missing data from the provider
/// 5. Validate and normalize all data
/// 6. Merge with cache and persist
/// 7. Return the path to the LEAN-compatible CSV
/// 
/// Cache structure:
///   lean_workspace/data/custom/{SYMBOL}_{resolution}.csv
///   Example: lean_workspace/data/custom/NIFTY50_day.csv
/// 
/// Thread safety:
///   Uses a per-asset lock to prevent concurrent downloads
///   from corrupting the same cache file.
/// </summary>
public class HistoricalDataService
{
    private readonly AssetRegistry _assetRegistry;
    private readonly IHistoricalDataProvider _provider;
    private readonly DataValidator _validator;
    private readonly ILogger<HistoricalDataService> _logger;
    private readonly string _cacheDir;

    // Per-asset lock to prevent concurrent cache corruption
    private static readonly Dictionary<string, SemaphoreSlim> _locks = new();
    private static readonly object _lockMapLock = new();

    public HistoricalDataService(
        AssetRegistry assetRegistry,
        IHistoricalDataProvider provider,
        DataValidator validator,
        ILogger<HistoricalDataService> logger)
    {
        _assetRegistry = assetRegistry;
        _provider = provider;
        _validator = validator;
        _logger = logger;

        // Navigate from backend/ up to repo root, then into lean_workspace/data/custom/
        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        _cacheDir = Path.Combine(repoRoot, "lean_workspace", "data", "custom");
        Directory.CreateDirectory(_cacheDir);

        _logger.LogInformation("HistoricalDataService cache dir: {Dir}", _cacheDir);
    }

    /// <summary>
    /// Get historical data for the given asset and date range.
    /// Uses cache when possible, fetches from Upstox when needed.
    /// </summary>
    public async Task<HistoricalDataResult> GetDataAsync(
        string assetDisplayName, DateTime startDate, DateTime endDate, string resolution)
    {
        var result = new HistoricalDataResult();

        // Step 1: Resolve asset
        var asset = _assetRegistry.GetByDisplayName(assetDisplayName);
        if (asset == null)
        {
            result.ErrorMessage = $"Unsupported asset: '{assetDisplayName}'. " +
                $"Supported assets: {string.Join(", ", _assetRegistry.GetSupportedAssets())}";
            return result;
        }

        var upstoxResolution = AssetRegistry.MapResolution(resolution);
        var cacheKey = GetCacheKey(asset.Symbol, upstoxResolution);
        var cachePath = Path.Combine(_cacheDir, cacheKey);

        // Acquire per-asset lock
        var assetLock = GetAssetLock(cacheKey);
        await assetLock.WaitAsync();

        try
        {
            // Step 2: Check existing cache
            var cachedCandles = ReadCache(cachePath);
            var (cacheStart, cacheEnd) = GetCacheCoverage(cachedCandles);

            _logger.LogInformation(
                "Cache for {Symbol}/{Res}: {Count} candles, coverage {Start} to {End}",
                asset.Symbol, upstoxResolution, cachedCandles.Count,
                cacheStart?.ToString("yyyy-MM-dd") ?? "none",
                cacheEnd?.ToString("yyyy-MM-dd") ?? "none");

            // Step 3: Determine what needs fetching
            var fetchRanges = DetermineMissingRanges(
                startDate, endDate, cacheStart, cacheEnd);

            if (fetchRanges.Count == 0)
            {
                // Cache fully covers the requested range
                _logger.LogInformation("Full cache hit for {Symbol}", asset.Symbol);
                var filtered = FilterToRange(cachedCandles, startDate, endDate);
                result.Success = true;
                result.Candles = filtered;
                result.CsvFilePath = cachePath;
                result.FromCache = true;
                return result;
            }

            // Step 4: Fetch missing data from provider
            var fetchedCandles = new List<HistoricalCandle>();
            foreach (var (rangeStart, rangeEnd) in fetchRanges)
            {
                _logger.LogInformation(
                    "Fetching {Symbol} from provider: {Start} to {End}",
                    asset.Symbol, rangeStart.ToString("yyyy-MM-dd"),
                    rangeEnd.ToString("yyyy-MM-dd"));

                try
                {
                    var chunk = await _provider.FetchCandlesAsync(
                        asset, rangeStart, rangeEnd, upstoxResolution);
                    fetchedCandles.AddRange(chunk);
                }
                catch (Exception ex)
                {
                    _logger.LogError(ex, "Provider fetch failed for {Symbol}", asset.Symbol);
                    result.ErrorMessage = $"Historical data could not be retrieved for {asset.DisplayName}: {ex.Message}";
                    return result;
                }
            }

            // Step 5: Validate fetched data
            var validatedFetch = _validator.ValidateAndNormalize(fetchedCandles, asset.Symbol);

            // Step 6: Merge with cache
            var merged = MergeCandles(cachedCandles, validatedFetch);

            if (merged.Count == 0)
            {
                result.ErrorMessage = $"No valid historical data available for {asset.DisplayName} " +
                    $"in the range {startDate:yyyy-MM-dd} to {endDate:yyyy-MM-dd}. " +
                    "The instrument may not have trading data for this period.";
                return result;
            }

            // Step 7: Persist merged data to cache
            WriteCache(cachePath, merged);

            // Return only the requested range
            var rangeFiltered = FilterToRange(merged, startDate, endDate);

            result.Success = true;
            result.Candles = rangeFiltered;
            result.CsvFilePath = cachePath;
            result.FromCache = false;
            return result;
        }
        finally
        {
            assetLock.Release();
        }
    }

    /// <summary>
    /// Get the list of supported assets.
    /// </summary>
    public List<string> GetSupportedAssets() => _assetRegistry.GetSupportedAssets();

    // ─── Cache I/O ──────────────────────────────────────

    /// <summary>
    /// Read cached candles from a CSV file.
    /// Format: Date,Open,High,Low,Close,Volume
    /// </summary>
    private List<HistoricalCandle> ReadCache(string path)
    {
        var candles = new List<HistoricalCandle>();
        if (!File.Exists(path)) return candles;

        try
        {
            var lines = File.ReadAllLines(path);
            foreach (var line in lines.Skip(1)) // Skip header
            {
                if (string.IsNullOrWhiteSpace(line)) continue;
                var parts = line.Split(',');
                if (parts.Length < 6) continue;

                if (DateTime.TryParseExact(parts[0].Trim(), "yyyy-MM-dd",
                    CultureInfo.InvariantCulture, DateTimeStyles.None, out var ts))
                {
                    candles.Add(new HistoricalCandle
                    {
                        Timestamp = ts,
                        Open = double.Parse(parts[1].Trim(), CultureInfo.InvariantCulture),
                        High = double.Parse(parts[2].Trim(), CultureInfo.InvariantCulture),
                        Low = double.Parse(parts[3].Trim(), CultureInfo.InvariantCulture),
                        Close = double.Parse(parts[4].Trim(), CultureInfo.InvariantCulture),
                        Volume = double.Parse(parts[5].Trim(), CultureInfo.InvariantCulture)
                    });
                }
            }
        }
        catch (Exception ex)
        {
            _logger.LogWarning(ex, "Failed to read cache file {Path}", path);
        }

        return candles;
    }

    /// <summary>
    /// Write candles to CSV for both caching and LEAN consumption.
    /// Uses the same format as the existing nifty50.csv.
    /// </summary>
    private void WriteCache(string path, List<HistoricalCandle> candles)
    {
        var lines = new List<string> { "Date,Open,High,Low,Close,Volume" };
        foreach (var c in candles.OrderBy(c => c.Timestamp))
        {
            lines.Add(string.Format(CultureInfo.InvariantCulture,
                "{0:yyyy-MM-dd},{1},{2},{3},{4},{5}",
                c.Timestamp, c.Open, c.High, c.Low, c.Close, c.Volume));
        }
        File.WriteAllLines(path, lines);
        _logger.LogInformation("Cache written: {Path} ({Count} candles)", path, candles.Count);
    }

    // ─── Cache Logic ────────────────────────────────────

    private static string GetCacheKey(string symbol, string resolution)
    {
        return $"{symbol.ToLower()}_{resolution}.csv";
    }

    private static (DateTime? Start, DateTime? End) GetCacheCoverage(List<HistoricalCandle> candles)
    {
        if (candles.Count == 0) return (null, null);
        var ordered = candles.OrderBy(c => c.Timestamp).ToList();
        return (ordered.First().Timestamp, ordered.Last().Timestamp);
    }

    /// <summary>
    /// Determine which date ranges are missing from the cache.
    /// Returns 0 ranges if cache fully covers the request.
    /// Returns 1-2 ranges for partial or no coverage.
    /// </summary>
    private static List<(DateTime Start, DateTime End)> DetermineMissingRanges(
        DateTime requestStart, DateTime requestEnd,
        DateTime? cacheStart, DateTime? cacheEnd)
    {
        var ranges = new List<(DateTime, DateTime)>();

        // No cache at all — fetch everything
        if (cacheStart == null || cacheEnd == null)
        {
            ranges.Add((requestStart, requestEnd));
            return ranges;
        }

        // Need data before cache starts
        if (requestStart < cacheStart.Value.AddDays(-1))
        {
            ranges.Add((requestStart, cacheStart.Value.AddDays(-1)));
        }

        // Need data after cache ends
        if (requestEnd > cacheEnd.Value.AddDays(1))
        {
            ranges.Add((cacheEnd.Value.AddDays(1), requestEnd));
        }

        return ranges;
    }

    /// <summary>
    /// Merge two lists of candles, deduplicating by timestamp.
    /// </summary>
    private static List<HistoricalCandle> MergeCandles(
        List<HistoricalCandle> existing, List<HistoricalCandle> incoming)
    {
        var all = new List<HistoricalCandle>(existing);
        all.AddRange(incoming);
        return all
            .GroupBy(c => c.Timestamp)
            .Select(g => g.Last()) // Prefer newer data
            .OrderBy(c => c.Timestamp)
            .ToList();
    }

    /// <summary>
    /// Filter candles to the requested date range.
    /// </summary>
    private static List<HistoricalCandle> FilterToRange(
        List<HistoricalCandle> candles, DateTime start, DateTime end)
    {
        return candles
            .Where(c => c.Timestamp >= start && c.Timestamp <= end)
            .OrderBy(c => c.Timestamp)
            .ToList();
    }

    /// <summary>
    /// Get a per-asset semaphore to prevent concurrent cache writes.
    /// </summary>
    private static SemaphoreSlim GetAssetLock(string cacheKey)
    {
        lock (_lockMapLock)
        {
            if (!_locks.TryGetValue(cacheKey, out var sem))
            {
                sem = new SemaphoreSlim(1, 1);
                _locks[cacheKey] = sem;
            }
            return sem;
        }
    }
}
