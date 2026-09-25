using System.Text.Json;
using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// Parses LEAN Engine's JSON output into structured frontend-friendly models.
/// 
/// LEAN outputs results in two formats with inconsistent casing:
/// - Main results file uses lowercase keys (statistics, charts, orders)
/// - Summary file may use PascalCase (Statistics, Charts, Orders)
/// This parser handles both gracefully using case-insensitive lookup.
/// </summary>
public class LeanResultParser
{
    private readonly ILogger<LeanResultParser> _logger;

    public LeanResultParser(ILogger<LeanResultParser> logger)
    {
        _logger = logger;
    }

    /// <summary>
    /// Parse raw LEAN JSON output into a structured BacktestResponse.
    /// </summary>
    public BacktestResponse Parse(string rawJson)
    {
        var response = new BacktestResponse();

        try
        {
            using var doc = JsonDocument.Parse(rawJson);
            var root = doc.RootElement;

            // Parse metrics from statistics
            response.Metrics = ParseMetrics(root);

            // Parse equity curve from charts
            response.EquityCurve = ParseEquityCurve(root);

            // Parse trade events from orders
            response.Trades = ParseOrders(root);

            // Parse raw statistics for the "All Statistics" panel
            response.RawStatistics = ParseRawStatistics(root);

            response.Success = true;
            response.Status = "Completed";

            _logger.LogInformation("Parsed results: {Trades} trades, {Points} equity points",
                response.Trades?.Count ?? 0, response.EquityCurve?.Count ?? 0);
        }
        catch (Exception ex)
        {
            response.Success = false;
            response.Status = "Failed";
            response.ErrorMessage = $"Error parsing LEAN results: {ex.Message}";
            _logger.LogError(ex, "Failed to parse LEAN results");
        }

        return response;
    }

    /// <summary>
    /// Extract key performance metrics from the statistics section.
    /// Handles both lowercase and PascalCase keys from different LEAN output formats.
    /// </summary>
    private BacktestMetrics ParseMetrics(JsonElement root)
    {
        var stats = GetProperty(root, "statistics", "Statistics");
        var metrics = new BacktestMetrics();

        if (stats == null) return metrics;

        metrics.TotalReturn = ParsePercentage(GetStatValue(stats.Value, "Net Profit", "Total Net Profit"));
        metrics.MaxDrawdown = ParsePercentage(GetStatValue(stats.Value, "Drawdown"));
        metrics.TotalTrades = ParseInt(GetStatValue(stats.Value, "Total Orders"));
        metrics.WinRate = ParsePercentage(GetStatValue(stats.Value, "Win Rate"));
        metrics.SharpeRatio = ParseDouble(GetStatValue(stats.Value, "Sharpe Ratio"));
        metrics.StartEquity = ParseDouble(GetStatValue(stats.Value, "Start Equity"));
        metrics.EndEquity = ParseDouble(GetStatValue(stats.Value, "End Equity"));

        return metrics;
    }

    /// <summary>
    /// Extract the equity curve time series from the Charts section.
    /// Each equity point has a Unix timestamp and portfolio value.
    /// </summary>
    private List<EquityPoint> ParseEquityCurve(JsonElement root)
    {
        var points = new List<EquityPoint>();

        var charts = GetProperty(root, "charts", "Charts");
        if (charts == null) return points;

        if (!charts.Value.TryGetProperty("Strategy Equity", out var strategyEquity))
            return points;

        var series = GetProperty(strategyEquity, "series", "Series");
        if (series == null) return points;

        if (!series.Value.TryGetProperty("Equity", out var equity))
            return points;

        var values = GetProperty(equity, "values", "Values");
        if (values == null) return points;

        foreach (var item in values.Value.EnumerateArray())
        {
            if (item.ValueKind == JsonValueKind.Array && item.GetArrayLength() >= 2)
            {
                // Array format: [timestamp, open, high, low, close] or [timestamp, value]
                points.Add(new EquityPoint
                {
                    Timestamp = item[0].GetInt64(),
                    Equity = item.GetArrayLength() >= 5
                        ? item[4].GetDouble()   // Close value from OHLC
                        : item[1].GetDouble()   // Simple value
                });
            }
            else if (item.ValueKind == JsonValueKind.Object)
            {
                // Object format: {x: timestamp, y: value}
                var ts = GetProperty(item, "x");
                var val = GetProperty(item, "y");
                if (ts != null && val != null)
                {
                    points.Add(new EquityPoint
                    {
                        Timestamp = ts.Value.GetInt64(),
                        Equity = val.Value.GetDouble()
                    });
                }
            }
        }

        return points;
    }

    /// <summary>
    /// Extract trade/order events from the Orders section.
    /// Maps LEAN's direction codes (0=Buy, 1=Sell) to readable strings.
    /// </summary>
    private List<TradeEvent> ParseOrders(JsonElement root)
    {
        var trades = new List<TradeEvent>();

        var orders = GetProperty(root, "orders", "Orders");
        if (orders == null) return trades;

        foreach (var orderProp in orders.Value.EnumerateObject())
        {
            var order = orderProp.Value;
            if (order.ValueKind != JsonValueKind.Object) continue;

            // Direction: 0 = Buy, 1 = Sell
            var dirVal = GetPropertyValue<int>(order, "direction", "Direction");
            var direction = dirVal == 1 ? "Sell" : "Buy";

            var price = GetPropertyValue<double>(order, "price", "Price");
            var quantity = Math.Abs(GetPropertyValue<double>(order, "quantity", "Quantity"));
            var time = GetPropertyValue<string>(order, "time", "Time") ?? "";
            var orderId = GetPropertyValue<int>(order, "id", "Id");

            // Check order events for actual fill data (more accurate)
            var events = GetProperty(order, "orderEvents", "OrderEvents");
            if (events != null && events.Value.ValueKind == JsonValueKind.Array)
            {
                var eventsArray = events.Value.EnumerateArray().ToList();
                if (eventsArray.Count > 0)
                {
                    var lastEvent = eventsArray[^1];
                    var fillPrice = GetPropertyValue<double>(lastEvent, "fillPrice", "FillPrice");
                    if (fillPrice > 0) price = fillPrice;

                    var fillQty = GetPropertyValue<double>(lastEvent, "fillQuantity", "FillQuantity");
                    if (fillQty != 0) quantity = Math.Abs(fillQty);
                }
            }

            trades.Add(new TradeEvent
            {
                Time = time,
                Direction = direction,
                Price = price,
                Quantity = quantity,
                OrderId = orderId
            });
        }

        return trades.OrderBy(t => t.Time).ToList();
    }

    /// <summary>
    /// Extract all raw statistics as key-value pairs for the UI's expandable "All Statistics" section.
    /// </summary>
    private Dictionary<string, string> ParseRawStatistics(JsonElement root)
    {
        var result = new Dictionary<string, string>();

        var stats = GetProperty(root, "statistics", "Statistics");
        if (stats == null) return result;

        foreach (var prop in stats.Value.EnumerateObject())
        {
            result[prop.Name] = prop.Value.GetString() ?? prop.Value.ToString();
        }

        return result;
    }

    // ─── Helper methods for case-insensitive JSON property access ────

    private static JsonElement? GetProperty(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (element.TryGetProperty(name, out var value))
                return value;
        }
        return null;
    }

    private static T GetPropertyValue<T>(JsonElement element, params string[] names)
    {
        foreach (var name in names)
        {
            if (element.TryGetProperty(name, out var value))
            {
                try
                {
                    if (typeof(T) == typeof(int))
                        return (T)(object)value.GetInt32();
                    if (typeof(T) == typeof(double))
                        return (T)(object)value.GetDouble();
                    if (typeof(T) == typeof(string))
                        return (T)(object)(value.GetString() ?? "");
                }
                catch
                {
                    // Try parsing from string representation
                    try
                    {
                        var str = value.ToString();
                        if (typeof(T) == typeof(int) && int.TryParse(str, out var intVal))
                            return (T)(object)intVal;
                        if (typeof(T) == typeof(double) && double.TryParse(str, out var dblVal))
                            return (T)(object)dblVal;
                    }
                    catch { }
                }
            }
        }
        return default!;
    }

    private static string? GetStatValue(JsonElement stats, params string[] names)
    {
        foreach (var name in names)
        {
            if (stats.TryGetProperty(name, out var value))
                return value.GetString();
        }
        return null;
    }

    private static double ParsePercentage(string? value)
    {
        if (string.IsNullOrEmpty(value)) return 0;
        value = value.Replace("%", "").Replace(",", "").Trim();
        return double.TryParse(value, out var result) ? result : 0;
    }

    private static double ParseDouble(string? value)
    {
        if (string.IsNullOrEmpty(value)) return 0;
        value = value.Replace("$", "").Replace("₹", "").Replace("€", "").Replace(",", "").Trim();
        return double.TryParse(value, out var result) ? result : 0;
    }

    private static int ParseInt(string? value)
    {
        if (string.IsNullOrEmpty(value)) return 0;
        return int.TryParse(value.Trim(), out var result) ? result : 0;
    }
}
