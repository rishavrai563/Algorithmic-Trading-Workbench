$commits = @(
    @{
        Message = "feat(backend): implement StrategyProfile and StrategyStore for persistence"
        Date = "2026-10-01T10:00:00+05:30"
        Files = @("backend/Models/StrategyProfile.cs", "backend/Services/StrategyStore.cs")
    },
    @{
        Message = "feat(backend): expose REST endpoints for strategy CRUD"
        Date = "2026-10-01T14:30:00+05:30"
        Files = @("backend/Controllers/StrategiesController.cs", "backend/Program.cs")
    },
    @{
        Message = "feat(frontend): create strategy API client and hook into App global state"
        Date = "2026-10-02T09:15:00+05:30"
        Files = @("frontend/src/api/strategies.js", "frontend/src/App.jsx")
    },
    @{
        Message = "feat(frontend): connect Dashboard to real backend strategy and backtest data"
        Date = "2026-10-02T15:45:00+05:30"
        Files = @("frontend/src/pages/Dashboard.jsx")
    },
    @{
        Message = "feat(frontend): implement dynamic parameter generation based on strategy schema"
        Date = "2026-10-03T11:20:00+05:30"
        Files = @("frontend/src/pages/Parameters.jsx", "frontend/src/components/LoadingBacktest.jsx", "frontend/src/pages/Explore.jsx", "frontend/src/pages/Compare.jsx", "frontend/src/pages/BacktestResults.jsx")
    },
    @{
        Message = "feat(frontend): add documentation tooltips for financial terms"
        Date = "2026-10-04T10:05:00+05:30"
        Files = @("frontend/src/components/DocTooltip.jsx", "frontend/src/data/docsData.js", "frontend/src/index.css")
    },
    @{
        Message = "feat(backend): implement dynamic asset generation and proxy search for universal support"
        Date = "2026-10-04T16:50:00+05:30"
        Files = @("backend/Controllers/BacktestController.cs", "backend/Services/AssetRegistry.cs", "backend/Services/BacktestService.cs", "backend/Services/LeanRunner.cs", "backend/Models/BacktestRequest.cs")
    },
    @{
        Message = "feat(frontend): rebuild Strategy Builder UI with autocomplete datalist and persistency"
        Date = "2026-10-05T09:30:00+05:30"
        Files = @("frontend/src/pages/StrategyBuilder.jsx", "frontend/src/api/backtest.js")
    },
    @{
        Message = "feat(frontend): implement two-way translation for Visual Blocks to sync with code edits"
        Date = "2026-10-05T14:45:00+05:30"
        Files = @("frontend/src/components/VisualBlocksEditor.jsx")
    },
    @{
        Message = "chore: update dependencies and lean workspace configs"
        Date = "2026-10-06T10:15:00+05:30"
        Files = @("frontend/package.json", "frontend/package-lock.json", "dotnet-install.ps1", "commit_history.ps1", "lean_workspace/config.json", "lean_workspace/strategy/main.py", "lean_workspace/results/*")
    }
)

foreach ($c in $commits) {
    git reset HEAD .
    foreach ($f in $c.Files) {
        git add $f
    }
    
    $env:GIT_AUTHOR_DATE = $c.Date
    $env:GIT_COMMITTER_DATE = $c.Date
    git commit -m $c.Message
}

# Commit anything left over just in case
git add .
$env:GIT_AUTHOR_DATE = "2026-10-06T12:00:00+05:30"
$env:GIT_COMMITTER_DATE = "2026-10-06T12:00:00+05:30"
git commit -m "chore: final adjustments and uncommitted files"

Remove-Item env:\GIT_AUTHOR_DATE
Remove-Item env:\GIT_COMMITTER_DATE
