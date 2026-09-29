namespace AlgoTrading.Models;

public class BacktestJob
{
    public string Id { get; set; } = System.Guid.NewGuid().ToString();
    public int Progress { get; set; } = 0;
    public string Status { get; set; } = "Queued";
    public bool IsComplete { get; set; } = false;
    public BacktestResponse? Result { get; set; }
}
