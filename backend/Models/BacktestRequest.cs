namespace AlgoTrading.Models;

/// <summary>
/// Incoming backtest request from the frontend.
/// Contains the full Python strategy code and execution configuration.
/// </summary>
public class BacktestRequest
{
    /// <summary>Complete Python QCAlgorithm strategy code.</summary>
    public string StrategyCode { get; set; } = "";

    /// <summary>Strategy language — currently only "python" is supported.</summary>
    public string Language { get; set; } = "python";

    /// <summary>Backtest configuration parameters.</summary>
    public BacktestConfiguration Configuration { get; set; } = new();
}

public class BacktestConfiguration
{
    /// <summary>Display name of the selected asset (e.g., "NIFTY 50", "RELIANCE").</summary>
    public string Asset { get; set; } = "NIFTY 50";

    /// <summary>Candle resolution/timeframe (e.g., "Daily", "1 Hour").</summary>
    public string Resolution { get; set; } = "Daily";

    public string StartDate { get; set; } = "2022-01-01";
    public string EndDate { get; set; } = "2023-01-01";
    public int StartingCash { get; set; } = 100000;
    
    /// <summary>Dynamic strategy parameters to inject into LEAN configuration.</summary>
    public Dictionary<string, string> Parameters { get; set; } = new();
}
