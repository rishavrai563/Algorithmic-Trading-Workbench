namespace AlgoTrading.Models;

/// <summary>
/// Represents a tradeable asset with its display name, internal symbol,
/// exchange, and the provider-specific instrument identifier.
/// </summary>
public class Asset
{
    /// <summary>Human-readable name shown in the frontend dropdown.</summary>
    public string DisplayName { get; set; } = "";

    /// <summary>Internal symbol used for cache file naming and LEAN configuration.</summary>
    public string Symbol { get; set; } = "";

    /// <summary>Exchange the asset is listed on (e.g., NSE, BSE).</summary>
    public string Exchange { get; set; } = "";

    /// <summary>
    /// The exact instrument key required by the data provider (Upstox).
    /// Example: "NSE_INDEX|Nifty 50", "NSE_EQ|INE002A01018"
    /// This is never exposed to the frontend.
    /// </summary>
    public string ProviderInstrumentKey { get; set; } = "";
}
