# AlgoTrade Workbench Frontend — Start Here

This is the React/Vite frontend starter for the Algorithmic Trading Visualization Workbench.
It implements the Lab 5 workflow as a frontend demo using sample data:

Dashboard → Strategy Builder → Parameters → Running Backtest → Results → Explore → Compare

## 1. Install prerequisites

Install Node.js 20.19+ or 22.12+ for the current Vite major.

Check:

```bash
node -v
npm -v
```

## 2. Open this folder in VS Code

Open the `algotrading-frontend` folder.

## 3. Install packages

```bash
npm install
```

## 4. Start the development server

```bash
npm run dev
```

Open the localhost URL printed by Vite (normally `http://localhost:5173`).

## 5. What each folder means

```text
src/
  components/      Reusable UI pieces
  pages/           Full application screens
  data/            Sample strategy/trade data and demo calculations
  App.jsx          Routes + shared application state
  main.jsx         React entry point
  index.css        All styling
```

## 6. What is functional

- Sidebar navigation works.
- New strategy opens the Strategy Builder.
- Strategy parameters can be edited.
- Parameter sliders update the visual demo metrics.
- Run Backtest opens a loading/progress screen and then results.
- Results show sample equity/trade data.
- Explore Parameters changes sample output based on the selected values.
- Compare shows two sample configurations side-by-side.

## 7. Important limitation for Lab 6

This frontend currently uses SAMPLE DATA. It does not yet connect to a real backend or perform a real financial backtest.

That is intentional for the frontend-first stage. The next stage can replace the functions in `src/data/sampleData.js` with API calls to your backend/backtesting engine.

## 8. Lab 6 explanation

Implementation:

> “I built the frontend in React using reusable components and route-based pages. The current implementation supports the main user workflow from creating a strategy to exploring and comparing results.”

Organization:

> “I separated reusable UI components, pages, shared state, and sample data instead of putting everything in one file.”

Debugging:

> “I used the browser and React development workflow to trace state changes and navigation. When a control changes, the application updates the shared strategy state and the result view recalculates the demo metrics.”

## 9. Next development step

Connect these frontend actions to the real backend:

1. Strategy Builder → POST strategy configuration
2. Run Backtest → POST backtest request
3. Results → GET backtest result
4. Explore → send changed parameters to backend
5. Compare → request multiple configurations
