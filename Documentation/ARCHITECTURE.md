# System Architecture

## High-level flow

```text
Historical Market Data
        ↓
Strategy Builder
        ↓
Parameter Configuration
        ↓
Backend
        ↓
LEAN Backtesting Engine
        ↓
Results and Trade Data
        ↓
Visualization Layer
        ↓
Parameter Exploration
        ↓
Strategy Comparison
```

## Frontend

The frontend is a React application built with Vite. It is responsible for:

- page navigation,
- strategy configuration UI,
- backtest controls,
- loading/status states,
- result visualization,
- parameter exploration,
- strategy comparison.

## Backend

The backend is implemented in C#. It acts as the application layer between the web interface and the backtesting workflow.

Its responsibilities include handling the backtest request, passing the required configuration to the backtesting system, and returning results that the frontend can display.

## LEAN workspace

LEAN is used as the backtesting engine in the project workflow. Historical data and strategy configuration are used to produce simulated trading results.

## Design principle

The system should keep the configuration visible from the start of the workflow to the final result so that the user can verify what was actually tested.
