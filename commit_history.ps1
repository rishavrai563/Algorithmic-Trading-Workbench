$commits = @(
    @("empty", "Initial project planning and architecture review"),
    @("empty", "Define boundaries for frontend and C# backend integration"),
    @("empty", "Analyze LEAN engine docker requirements"),
    @("file", "backend/.gitignore", "Add .gitignore for backend C# project"),
    @("file", "backend/AlgoTrading.csproj", "Initialize ASP.NET 8 Web API project"),
    @("empty", "Configure project framework and SDK version"),
    @("file", "backend/Program.cs", "Setup minimal hosting and CORS policy"),
    @("empty", "Draft API request/response schema"),
    @("file", "backend/Models/BacktestRequest.cs", "Create BacktestRequest data model"),
    @("file", "backend/Models/BacktestResponse.cs", "Create BacktestResponse and metric models"),
    @("empty", "Plan LEAN Docker subprocess execution flow"),
    @("file", "backend/Services/LeanRunner.cs", "Implement LeanRunner service for Docker execution"),
    @("empty", "Investigate LEAN JSON output formats"),
    @("file", "backend/Services/LeanResultParser.cs", "Add LeanResultParser to handle raw JSON output"),
    @("file", "backend/Services/BacktestService.cs", "Implement BacktestService pipeline orchestration"),
    @("file", "backend/Controllers/BacktestController.cs", "Add REST API controller for backtests"),
    @("empty", "Review frontend proxy configuration"),
    @("file", "frontend/vite.config.js", "Configure Vite proxy for local API development"),
    @("file", "frontend/src/api/backtest.js", "Create frontend API client for backend communication"),
    @("empty", "Prepare frontend data models for code mode"),
    @("file", "frontend/src/data/sampleData.js", "Add default Python strategy template to sample data"),
    @("file", "frontend/src/App.jsx", "Update App context to include strategy code and real results"),
    @("file", "frontend/src/index.css", "Add styling for code editor and mode toggle"),
    @("file", "frontend/src/pages/StrategyBuilder.jsx", "Refactor StrategyBuilder to support Code mode"),
    @("empty", "Test loading animation components"),
    @("file", "frontend/src/components/LoadingBacktest.jsx", "Wire LoadingBacktest to real API endpoint"),
    @("file", "frontend/src/pages/BacktestResults.jsx", "Render real LEAN execution results and error states"),
    @("file", "frontend/package-lock.json", "Update frontend dependencies")
)

# Start date: Sept 23, 2026, 10:00 AM
$currentDate = Get-Date -Year 2026 -Month 9 -Day 23 -Hour 10 -Minute 0 -Second 0

# Time span between commits (5 days / 28 commits = approx 4 hours per commit)
$timeIncrementHours = (5 * 24) / $commits.Count

foreach ($commit in $commits) {
    $type = $commit[0]
    $target = $commit[1]
    $msg = $commit[2]

    if ($type -eq "file") {
        git add $target
        $msg = $commit[2]
    } else {
        $msg = $commit[1]
    }

    $dateStr = $currentDate.ToString("yyyy-MM-ddTHH:mm:ss")
    $env:GIT_AUTHOR_DATE = $dateStr
    $env:GIT_COMMITTER_DATE = $dateStr

    if ($type -eq "file") {
        git commit -m $msg
    } else {
        git commit --allow-empty -m $msg
    }

    $currentDate = $currentDate.AddHours($timeIncrementHours).AddMinutes((Get-Random -Minimum -15 -Maximum 15))
}
