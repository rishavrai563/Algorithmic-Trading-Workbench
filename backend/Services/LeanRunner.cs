using System.Diagnostics;
using System.Text;
using System.Text.Json;

namespace AlgoTrading.Services;

/// <summary>
/// Manages LEAN Engine execution via Docker.
/// 
/// Responsibilities:
/// - Writes user strategy code to disk
/// - Writes LEAN config.json with backtest parameters (including dynamic asset info)
/// - Launches the Docker container
/// - Monitors stdout for the completion signal
/// - Returns raw output and the path to results
/// </summary>
public class LeanRunner
{
    private readonly string _workspaceDir;
    private readonly string _resultsDir;
    private readonly string _configPath;
    private readonly string _algorithmDir;
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
        _algorithmDir = Path.Combine(_workspaceDir, "strategy");
        _dataDir = Path.Combine(_workspaceDir, "data");

        Directory.CreateDirectory(_algorithmDir);

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
    /// Now accepts the asset symbol, data file path, and resolution for dynamic configuration.
    /// </summary>
    public async Task<LeanExecutionResult> RunBacktestAsync(
        string strategyCode,
        string startDate,
        string endDate,
        int startingCash,
        string assetSymbol,
        string dataFileName,
        string resolution)
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

            // Step 2: Inject data file and asset symbol into strategy code
            // The frontend template uses __DATA_FILE__ and __ASSET_SYMBOL__ placeholders
            // which the PythonData subclass reads as module-level constants.
            var injectedCode = strategyCode
                .Replace("__DATA_FILE__", dataFileName)
                .Replace("__ASSET_SYMBOL__", assetSymbol);

            var algorithmPath = Path.Combine(_algorithmDir, "main.py");
            await File.WriteAllTextAsync(algorithmPath, injectedCode);
            _logger.LogInformation("Strategy code written to {Path} (placeholders injected: {DataFile}, {Symbol})",
                algorithmPath, dataFileName, assetSymbol);

            // Step 3: Write LEAN config with parameters including asset info
            WriteConfig(startDate, endDate, assetSymbol, dataFileName, resolution);

            // Step 4: Clean previous results
            CleanResults();

            // Step 5: Build and run Docker command
            var dockerCmd = BuildDockerCommand(algorithmPath);
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
    /// Now includes asset-specific parameters for the generalized strategy.
    /// </summary>
    private void WriteConfig(string startDate, string endDate,
        string assetSymbol, string dataFileName, string resolution)
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
                // Replace parameters with user-supplied values + asset info
                config["parameters"] = new Dictionary<string, string>
                {
                    ["start-date"] = startDate,
                    ["end-date"] = endDate,
                    ["asset-symbol"] = assetSymbol,
                    ["data-file"] = dataFileName,
                    ["resolution"] = resolution
                };
            }
            else if (prop.Name == "algorithm-location")
            {
                // Point to the new strategy directory
                config["algorithm-location"] = "/Lean/Algorithm.Python/main.py";
            }
            else
            {
                config[prop.Name] = prop.Value.Clone();
            }
        }

        // Ensure parameters exists
        if (!config.ContainsKey("parameters"))
        {
            config["parameters"] = new Dictionary<string, string>
            {
                ["start-date"] = startDate,
                ["end-date"] = endDate,
                ["asset-symbol"] = assetSymbol,
                ["data-file"] = dataFileName,
                ["resolution"] = resolution
            };
        }

        var json = JsonSerializer.Serialize(config, new JsonSerializerOptions
        {
            WriteIndented = true
        });
        File.WriteAllText(_configPath, json);
        _logger.LogInformation("Config written: {Symbol} {Start} to {End}", assetSymbol, startDate, endDate);
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
    /// Mounts the strategy directory and the full custom data directory.
    /// </summary>
    private string[] BuildDockerCommand(string algorithmPath)
    {
        var configDocker = _configPath.Replace("\\", "/");
        var algorithmDocker = algorithmPath.Replace("\\", "/");
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
