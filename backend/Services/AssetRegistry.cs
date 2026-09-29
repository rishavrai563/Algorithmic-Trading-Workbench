using AlgoTrading.Models;

namespace AlgoTrading.Services;

/// <summary>
/// Centralized registry of supported assets and their provider-specific instrument mappings.
/// 
/// This is the single source of truth for:
/// - Which assets the application supports
/// - How frontend display names map to Upstox instrument keys
/// - Exchange information
/// 
/// Adding a new asset requires only adding an entry here.
/// </summary>
public class AssetRegistry
{
    private readonly Dictionary<string, Asset> _assets;

    public AssetRegistry()
    {
        _assets = new Dictionary<string, Asset>(StringComparer.OrdinalIgnoreCase)
        {
            ["NIFTY 50"] = new Asset
            {
                DisplayName = "NIFTY 50",
                Symbol = "NIFTY50",
                Exchange = "NSE_INDEX",
                ProviderInstrumentKey = "^NSEI"
            },
            ["RELIANCE"] = new Asset
            {
                DisplayName = "RELIANCE",
                Symbol = "RELIANCE",
                Exchange = "NSE_EQ",
                ProviderInstrumentKey = "RELIANCE.NS"
            },
            ["TCS"] = new Asset
            {
                DisplayName = "TCS",
                Symbol = "TCS",
                Exchange = "NSE_EQ",
                ProviderInstrumentKey = "TCS.NS"
            },
            ["INFY"] = new Asset
            {
                DisplayName = "INFY",
                Symbol = "INFY",
                Exchange = "NSE_EQ",
                ProviderInstrumentKey = "INFY.NS"
            },
            ["HDFC BANK"] = new Asset
            {
                DisplayName = "HDFC BANK",
                Symbol = "HDFCBANK",
                Exchange = "NSE_EQ",
                ProviderInstrumentKey = "HDFCBANK.NS"
            },
            ["SBIN"] = new Asset
            {
                DisplayName = "SBIN",
                Symbol = "SBIN",
                Exchange = "NSE_EQ",
                ProviderInstrumentKey = "SBIN.NS"
            },
            ["ICICI BANK"] = new Asset
            {
                DisplayName = "ICICI BANK",
                Symbol = "ICICIBANK",
                Exchange = "NSE_EQ",
                ProviderInstrumentKey = "ICICIBANK.NS"
            },
            ["WIPRO"] = new Asset
            {
                DisplayName = "WIPRO",
                Symbol = "WIPRO",
                Exchange = "NSE_EQ",
                ProviderInstrumentKey = "WIPRO.NS"
            }
        };
    }

    /// <summary>
    /// Look up an asset by its display name (case-insensitive).
    /// Returns null if not found.
    /// </summary>
    public Asset? GetByDisplayName(string displayName)
    {
        _assets.TryGetValue(displayName, out var asset);
        return asset;
    }

    /// <summary>
    /// Look up an asset by its internal symbol.
    /// </summary>
    public Asset? GetBySymbol(string symbol)
    {
        return _assets.Values.FirstOrDefault(a =>
            a.Symbol.Equals(symbol, StringComparison.OrdinalIgnoreCase));
    }

    /// <summary>
    /// Get all supported assets (for the frontend dropdown).
    /// Returns only display names — never exposes provider keys.
    /// </summary>
    public List<string> GetSupportedAssets()
    {
        return _assets.Values
            .Select(a => a.DisplayName)
            .OrderBy(n => n)
            .ToList();
    }

    /// <summary>
    /// Map a frontend resolution label to the Upstox interval string.
    /// </summary>
    public static string MapResolution(string frontendResolution)
    {
        return frontendResolution?.ToLower() switch
        {
            "daily" or "day" or "1d" => "day",
            "1 hour" or "1hour" or "60minute" => "30minute", // Upstox doesn't have 1h; use 30min
            "15 min" or "15min" or "15minute" => "1minute",  // Closest available
            "30 min" or "30min" or "30minute" => "30minute",
            "weekly" or "week" or "1w" => "week",
            "monthly" or "month" or "1m" => "month",
            "1minute" or "1min" => "1minute",
            _ => "day"
        };
    }
}
