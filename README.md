# Algorithmic Trading Visualization Workbench

A human-centered web application for building, testing, exploring, and comparing algorithmic trading strategies through a visual interface.



## What this project does

The workbench helps a user move through one connected workflow:

**Create Strategy → Configure Parameters → Run Backtest → View Results → Explore Variations → Compare Strategies**

The main idea is simple: users should be able to understand what they are doing and what happened after a backtest without depending on many separate screens or remembering previous configurations.

## Problem statement

Algorithmic trading interfaces can be difficult to use because users have to work with strategy rules, parameters, backtests, charts, and performance information at the same time.

This project focuses on making that process easier to understand by providing a visual workbench for strategy construction, backtesting, parameter exploration, comparison, and result interpretation.

## Objectives

- Make strategy creation easier through a visual interface.
- Make backtesting simple to configure and run.
- Show backtest progress and results clearly.
- Help users explore how parameter changes affect results.
- Help users compare different strategy runs with enough context.
- Reduce avoidable user errors and confusion.
- Improve accessibility and overall usability based on user testing.

## Main features

### 1. Dashboard
Provides the main entry point to the workbench and the project workflow.

### 2. Strategy Builder
Allows users to build a strategy using available indicators and rule controls instead of starting from raw code.


### 3. Parameters
Allows the user to configure strategy values and the historical period used for the backtest.

### 4. Backtesting
Runs the selected strategy on historical data and shows the system state while the backtest is running.

### 5. Backtest Results
Shows performance information, trade information, and visual results so that users can understand what happened.

### 6. Parameter Exploration
Lets users change parameters, run variations, and inspect how results change.

### 7. Strategy Comparison
Lets users compare multiple runs and understand the differences between them.


## Tech stack

### Frontend

- **React** – main UI framework.
- **JavaScript / JSX** – application logic and UI components.
- **Vite** – frontend development and build tool.
- **React Router** – page navigation.
- **CSS** – layout, styling, and visual design.


### Backend and backtesting

- **C#** – backend layer used to connect the interface with the backtesting workflow.
- **LEAN** – backtesting engine used by the project workflow.
- **Historical market data** – used as the input for backtests.

### Development and version control

- **Git** – version control.
- **GitHub** – remote repository and collaboration.
- **VS Code / similar IDE** – development environment.

## High-level architecture

```text
Historical Market Data
        ↓
Visual Strategy Builder
        ↓
Parameter Configuration
        ↓
Backtesting Backend
        ↓
LEAN Backtesting Engine
        ↓
Performance & Trade Results
        ↓
Interactive Visualization
        ↓
Parameter Exploration
        ↓
Strategy Comparison
        ↓
User
```

The architecture is intended to keep the user workflow connected from strategy creation to final comparison.

## User flow

```text
Dashboard
   ↓
Strategy Builder
   ↓
Parameters
   ↓
Run Backtest
   ↓
Backtest Results
   ↓
Explore Parameters
   ↓
Compare Strategies
```


## Getting started

### Prerequisites

Install the following before running the project:

- Node.js and npm
- Git
- The required C#/.NET development environment for the backend
- LEAN and the project backtesting workspace configured as required by the repository

### Clone the repository

```bash
git clone https://github.com/rishavrai563/Algorithmic-Trading-Workbench.git
cd Algorithmic-Trading-Workbench
```

### Run the frontend

```bash
cd frontend
npm install
npm run dev
```

Vite will print the local development address in the terminal.



### Backend


Download the LEAN image once before the first backtest:

```bash
docker pull quantconnect/lean:latest
```

## Run Locally

Start the backend in one terminal:

```bash
cd backend
dotnet restore
dotnet run --urls http://localhost:5000
```

Start the frontend in another terminal:

```bash
cd frontend
npm install
npm run dev
```


## Build

Build the frontend:

```bash
cd frontend
npm run build
```

Build the backend:

```bash
cd backend
dotnet build
```





##  Team Members
| Name | Entry No. | GitHub |
|------|-----------|--------|
| **Ravikant Sharma** | 2024AIB1013 | https://github.com/thyravikant |
| **Rishav Kumar** | 2024AIB1014 | https://github.com/rishavrai563 |

Course: **AI511 – HCI & Visualization**  
Institute: **Indian Institute of Technology Ropar**

## Disclaimer

This project is developed for academic, research, and educational purposes. Backtest results are historical simulations and should not be treated as investment advice or as a guarantee of future performance.
