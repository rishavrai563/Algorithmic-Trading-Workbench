using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace AlgoTrading.Services;

/// <summary>
/// Manages LEAN Engine execution via Docker.
/// 
/// Responsibilities:
/// - Writes user strategy code to disk
/// - Writes LEAN config.json with backtest parameters
/// - Launches the Docker container
/// - Monitors stdout for the completion signal
/// - Returns raw output and the path to results
/// </summary>
public class LeanRunner
{
    private readonly string _workspaceDir;
    private readonly string _resultsDir;
    private readonly string _configPath;
    private readonly string _algorithmPath;
    private readonly string _dataDir;
    private const string DockerImage = "quantconnect/lean:latest";
    private const int TimeoutSeconds = 300; // 5 minute safety cap

    private readonly ILogger<LeanRunner> _logger;

    public LeanRunner(ILogger<LeanRunner> logger)
    {
        _logger = logger;
        // Navigate from backend/ up to the repo root, then into lean_workspace/
        var repoRoot = Path.GetFullPath(Path.Combine(AppContext.BaseDirectory, "..", "..", "..", ".."));
        _workspaceDir = Path.Combine(repoRoot, "lean_workspace");
        _resultsDir = Path.Combine(_workspaceDir, "results");
        _configPath = Path.Combine(_workspaceDir, "config.json");
        _algorithmPath = Path.Combine(_workspaceDir, "RSIStrategy", "main.py");
        _dataDir = Path.Combine(_workspaceDir, "data");

        _logger.LogInformation("LeanRunner workspace: {Workspace}", _workspaceDir);
    }

    /// <summary>
    /// Represents the raw output from a LEAN Docker execution.
    /// </summary>
    public class LeanExecutionResult
    {
        public bool Success { get; set; }
        public string Stdout { get; set; } = "";
        public string? ErrorMessage { get; set; }
        public string? ResultsFilePath { get; set; }
        public string? RawResultsJson { get; set; }
    }

    /// <summary>
    /// Prepare the strategy file and config, then run LEAN via Docker.
    /// </summary>
    public async Task<LeanExecutionResult> RunBacktestAsync(
        string strategyCode,
        string startDate,
        string endDate,
        int startingCash)
    {
        var result = new LeanExecutionResult();

        try
        {
            // Step 1: Validate inputs
            if (string.IsNullOrWhiteSpace(strategyCode))
            {
                result.ErrorMessage = "Strategy code cannot be empty.";
                return result;
            }

            // Step 2: Write strategy code to the algorithm file
            Directory.CreateDirectory(Path.GetDirectoryName(_algorithmPath)!);
            await File.WriteAllTextAsync(_algorithmPath, strategyCode);
            _logger.LogInformation("Strategy code written to {Path}", _algorithmPath);

            // Step 3: Write LEAN config with date parameters
            WriteConfig(startDate, endDate);

            // Step 4: Clean previous results
            CleanResults();

            // Step 5: Build and run Docker command
            var dockerCmd = BuildDockerCommand();
            _logger.LogInformation("Docker command: {Cmd}", string.Join(" ", dockerCmd));

            result = await ExecuteDockerAsync(dockerCmd);
        }
        catch (Exception ex)
        {
            result.ErrorMessage = $"Backtest execution error: {ex.Message}";
            _logger.LogError(ex, "Backtest execution failed");
        }

        return result;
    }

    /// <summary>
    /// Write the LEAN config.json file with the user's backtest parameters.
    /// Preserves all LEAN engine configuration, only updates the parameters section
    /// and the algorithm class name extracted from the strategy code.
    /// </summary>
    private void WriteConfig(string startDate, string endDate)
    {
        var configText = File.ReadAllText(_configPath);
        using var doc = JsonDocument.Parse(configText);
        var root = doc.RootElement;

        // Build a new config preserving all existing keys
        var config = new Dictionary<string, object>();
        foreach (var prop in root.EnumerateObject())
        {
            if (prop.Name == "parameters")
            {
                // Replace parameters with user-supplied dates
                config["parameters"] = new Dictionary<string, string>
                {
                    ["start-date"] = startDate,
                    ["end-date"] = endDate
                };
            }
            else
            {
                config[prop.Name] = prop.Value.Clone();
            }
        }

        // Ensure parameters exists even if missing from original
        if (!config.ContainsKey("parameters"))
        {
            config["parameters"] = new Dictionary<string, string>
            {
                ["start-date"] = startDate,
                ["end-date"] = endDate
            };
        }

        var json = JsonSerializer.Serialize(config, new JsonSerializerOptions
        {
            WriteIndented = true
        });
        File.WriteAllText(_configPath, json);
        _logger.LogInformation("Config written: {Start} to {End}", startDate, endDate);
    }

    /// <summary>
    /// Remove all files from the results directory to ensure clean output.
    /// </summary>
    private void CleanResults()
    {
        Directory.CreateDirectory(_resultsDir);
        foreach (var file in Directory.GetFiles(_resultsDir))
        {
            File.Delete(file);
        }
        _logger.LogInformation("Results directory cleaned");
    }

    /// <summary>
    /// Build the Docker command line arguments for running LEAN.
    /// </summary>
    private string[] BuildDockerCommand()
    {
        var configDocker = _configPath.Replace("\\", "/");
        var algorithmDocker = _algorithmPath.Replace("\\", "/");
        var dataDocker = _dataDir.Replace("\\", "/");
        var resultsDocker = _resultsDir.Replace("\\", "/");

        return new[]
        {
            "docker", "run", "--rm",
            "-v", $"{configDocker}:/Lean/Launcher/bin/Debug/config.json",
            "-v", $"{algorithmDocker}:/Lean/Algorithm.Python/main.py",
            "-v", $"{dataDocker}/custom:/Lean/Data/custom",
            "-v", $"{resultsDocker}:/Results",
            DockerImage
        };
    }

    /// <summary>
    /// Execute the Docker process and monitor stdout for the LEAN completion signal.
    /// Uses the same "smart polling" approach as the original Python prototype:
    /// LEAN hangs after completion, so we detect the "Results Posted" log line
    /// and immediately kill the container.
    /// </summary>
    private async Task<LeanExecutionResult> ExecuteDockerAsync(string[] args)
    {
        var result = new LeanExecutionResult();
        var output = new StringBuilder();

        var psi = new ProcessStartInfo
        {
            FileName = args[0],
            RedirectStandardOutput = true,
            RedirectStandardError = true,
            UseShellExecute = false,
            CreateNoWindow = true
        };
        for (int i = 1; i < args.Length; i++)
            psi.ArgumentList.Add(args[i]);

        using var process = new Process { StartInfo = psi };
        var startTime = DateTime.UtcNow;

        try
        {
            process.Start();
            _logger.LogInformation("Docker process started (PID {Pid})", process.Id);

            // Read stdout line by line, watching for the completion signal
            while (!process.StandardOutput.EndOfStream)
            {
                var line = await process.StandardOutput.ReadLineAsync();
                if (line == null) break;

                output.AppendLine(line);

                // LEAN prints this exact string when results are finalized
                if (line.Contains("Analysis Completed and Results Posted"))
                {
                    _logger.LogInformation("LEAN completion signal detected — killing container");
                    await Task.Delay(500); // Let file handles close
                    try { process.Kill(entireProcessTree: true); } catch { }
                    break;
                }

                // Safety timeout
                if ((DateTime.UtcNow - startTime).TotalSeconds > TimeoutSeconds)
                {
                    _logger.LogWarning("Backtest timed out after {Seconds}s", TimeoutSeconds);
                    output.AppendLine($"\nWarning: Backtest timed out after {TimeoutSeconds} seconds.");
                    try { process.Kill(entireProcessTree: true); } catch { }
                    break;
                }
            }

            // Also capture any stderr
            var stderr = await process.StandardError.ReadToEndAsync();
            if (!string.IsNullOrEmpty(stderr))
                output.AppendLine(stderr);
        }
        catch (Exception ex)
        {
            result.ErrorMessage = $"Docker execution error: {ex.Message}";
            _logger.LogError(ex, "Docker process failed");
            return result;
        }

        result.Stdout = output.ToString();

        // Step 6: Find and read the results file
        if (Directory.Exists(_resultsDir))
        {
            var jsonFiles = Directory.GetFiles(_resultsDir, "*.json");
            if (jsonFiles.Length > 0)
            {
                // Pick the largest JSON file (the full results, not the summary)
                var resultsFile = jsonFiles.OrderByDescending(f => new FileInfo(f).Length).First();
                result.ResultsFilePath = resultsFile;
                result.RawResultsJson = await File.ReadAllTextAsync(resultsFile);
                result.Success = true;
                _logger.LogInformation("Results found: {Path} ({Size} bytes)",
                    resultsFile, new FileInfo(resultsFile).Length);
            }
            else
            {
                result.ErrorMessage = "LEAN completed but no results JSON file was generated. " +
                                      "Check the strategy code for errors.";
            }
        }
        else
        {
            result.ErrorMessage = "Results directory not found after LEAN execution.";
        }

        // Check for LEAN errors in stdout
        if (result.Stdout.Contains("Runtime Error") || result.Stdout.Contains("Error Initializing"))
        {
            result.Success = false;
            result.ErrorMessage = ExtractLeanError(result.Stdout);
        }

        return result;
    }

    /// <summary>
    /// Extract a human-readable error message from LEAN's verbose output.
    /// </summary>
    private static string ExtractLeanError(string stdout)
    {
        var lines = stdout.Split('\n');
        var errorLines = lines
            .Where(l => l.Contains("ERROR") || l.Contains("Runtime Error") || l.Contains("Error Initializing"))
            .Take(10)
            .ToList();

        if (errorLines.Count > 0)
            return string.Join("\n", errorLines);

        return "LEAN reported errors during execution. Check the logs for details.";
    }

    /// <summary>
    /// Quick health check — verifies Docker is running and the LEAN image exists.
    /// </summary>
    public async Task<(bool DockerAvailable, bool LeanImageExists)> CheckHealthAsync()
    {
        bool dockerOk = false, imageOk = false;

        try
        {
            var psi = new ProcessStartInfo("docker", "info")
            {
                RedirectStandardOutput = true,
                RedirectStandardError = true,
                UseShellExecute = false,
                CreateNoWindow = true
            };
            using var proc = Process.Start(psi)!;
            await proc.WaitForExitAsync();
            dockerOk = proc.ExitCode == 0;
        }
        catch { }

        if (dockerOk)
        {
            try
            {
                var psi = new ProcessStartInfo("docker", $"images -q {DockerImage}")
                {
                    RedirectStandardOutput = true,
                    UseShellExecute = false,
                    CreateNoWindow = true
                };
                using var proc = Process.Start(psi)!;
                var output = await proc.StandardOutput.ReadToEndAsync();
                await proc.WaitForExitAsync();
                imageOk = !string.IsNullOrWhiteSpace(output);
            }
            catch { }
        }

        return (dockerOk, imageOk);
    }
}
