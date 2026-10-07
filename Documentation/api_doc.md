# API Documentation

## Overview
This document outlines the REST API endpoints provided by the ASP.NET Core backend. The API is divided into two main controllers: `StrategiesController` for managing strategy state and history, and `BacktestController` for executing and monitoring LEAN backtests. All responses are formatted in JSON.

## 1. Strategies Controller
**Base Route:** `/api/strategies`  
Manages CRUD operations for user strategies and stores historical backtest records.

### `GET` `/api/strategies`
- **Description:** Retrieves a list of all saved strategies.
- **Payload/Query:** None

### `GET` `/api/strategies/{id}`
- **Description:** Retrieves a single strategy profile by its unique ID.
- **Payload/Query:** URL Parameter: `id` (string)

### `POST` `/api/strategies`
- **Description:** Creates a new blank strategy in the database.
- **Payload/Query:** JSON body (StrategyProfile)

### `PUT` `/api/strategies/{id}`
- **Description:** Updates and saves an existing strategy (e.g., modified code or parameters).
- **Payload/Query:** URL Parameter: `id`, JSON body (StrategyProfile)

### `DELETE` `/api/strategies/{id}`
- **Description:** Deletes a strategy from the database.
- **Payload/Query:** URL Parameter: `id` (string)

---

### Backtest History

### `GET` `/api/strategies/history`
- **Description:** Retrieves all historical backtest records across all strategies.
- **Payload/Query:** None

### `GET` `/api/strategies/{id}/history`
- **Description:** Retrieves the historical backtest variations run for a specific strategy.
- **Payload/Query:** URL Parameter: `id` (string)

### `POST` `/api/strategies/{id}/history`
- **Description:** Records the performance metrics and parameters of a newly completed backtest run.
- **Payload/Query:** URL Parameter: `id`, JSON body (BacktestRecord)

---

## 2. Backtest Controller
**Base Route:** `/api/backtest`  
Handles the orchestration of the Dockerized LEAN execution engine and external asset fetching.

### `POST` `/api/backtest`
- **Description:** Submits a strategy configuration and Python code to run in the LEAN engine. Spawns an asynchronous job.
- **Payload/Query:** JSON body (BacktestRequest)

### `GET` `/api/backtest/{id}/status`
- **Description:** Polls the status of a running backtest job. Returns progress percentages and final results when complete.
- **Payload/Query:** URL Parameter: `id` (string)

### `GET` `/api/backtest/status`
- **Description:** System health check. Returns Docker availability and LEAN image status.
- **Payload/Query:** None

### `GET` `/api/backtest/assets`
- **Description:** Retrieves a list of statically supported fallback assets for the frontend.
- **Payload/Query:** None

### `GET` `/api/backtest/assets/search`
- **Description:** Proxy endpoint that queries the Yahoo Finance API to provide universal ticker autocomplete suggestions.
- **Payload/Query:** Query Parameter: `q` (string)
