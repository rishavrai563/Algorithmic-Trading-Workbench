# AlgoTrade Workbench Frontend 

This is the React/Vite frontend for the Algorithmic Trading Visualization Workbench.
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

Open the localhost URL printed by Vite.

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



## 7. Next development step

Connect these frontend actions to the real backend:

1. Strategy Builder → POST strategy configuration
2. Run Backtest → POST backtest request
3. Results → GET backtest result
4. Explore → send changed parameters to backend
5. Compare → request multiple configurations
