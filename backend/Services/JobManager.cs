using System.Collections.Concurrent;
using AlgoTrading.Models;

namespace AlgoTrading.Services;

public class JobManager
{
    private readonly ConcurrentDictionary<string, BacktestJob> _jobs = new();

    public BacktestJob CreateJob() {
        var job = new BacktestJob();
        _jobs[job.Id] = job;
        return job;
    }

    public void UpdateJob(string id, int progress, string status) {
        if (_jobs.TryGetValue(id, out var job)) {
            job.Progress = progress;
            job.Status = status;
        }
    }

    public void CompleteJob(string id, BacktestResponse result) {
        if (_jobs.TryGetValue(id, out var job)) {
            job.Result = result;
            job.Progress = 100;
            job.Status = "Complete";
            job.IsComplete = true;
        }
    }

    public BacktestJob? GetJob(string id) => _jobs.TryGetValue(id, out var job) ? job : null;
}
