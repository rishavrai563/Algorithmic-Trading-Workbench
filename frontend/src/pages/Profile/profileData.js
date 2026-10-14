
export const profile = {
  name: "Rishav Kumar",
  email: "rishav@email.com",
  clientId: "ATW-2024-1014",
  memberSince: "Aug 2024",
  cash: 42380.5,
};

// prevClose is yesterday's close; it drives the "1D returns" numbers.
export const holdings = [
  { symbol: "RELIANCE", name: "Reliance Industries", qty: 25, avg: 2410.0, ltp: 2894.35, prevClose: 2871.2 },
  { symbol: "TCS", name: "Tata Consultancy", qty: 12, avg: 3620.5, ltp: 4012.8, prevClose: 3995.0 },
  { symbol: "INFY", name: "Infosys", qty: 30, avg: 1580.0, ltp: 1492.6, prevClose: 1504.1 },
  { symbol: "HDFCBANK", name: "HDFC Bank", qty: 40, avg: 1520.25, ltp: 1688.9, prevClose: 1679.4 },
  { symbol: "ITC", name: "ITC", qty: 150, avg: 402.1, ltp: 468.55, prevClose: 466.0 },
  { symbol: "TATAMOTORS", name: "Tata Motors", qty: 60, avg: 935.4, ltp: 861.25, prevClose: 872.9 },
  { symbol: "SBIN", name: "State Bank of India", qty: 80, avg: 612.0, ltp: 804.7, prevClose: 798.3 },
  { symbol: "ZOMATO", name: "Zomato", qty: 200, avg: 184.5, ltp: 241.15, prevClose: 238.4 },
];

const hoursAgo = (h) => new Date(Date.now() - h * 3600 * 1000).toISOString();

export const orders = [
  { id: "ORD-10492", symbol: "SBIN", side: "BUY", qty: 20, price: 804.5, type: "Market", status: "Executed", time: hoursAgo(2), strategy: "RSI Mean Reversion" },
  { id: "ORD-10491", symbol: "INFY", side: "SELL", qty: 10, price: 1495.0, type: "Limit", status: "Pending", time: hoursAgo(5), strategy: "SMA Crossover 20/50" },
  { id: "ORD-10488", symbol: "ZOMATO", side: "BUY", qty: 50, price: 238.9, type: "Market", status: "Executed", time: hoursAgo(26), strategy: "Momentum Breakout" },
  { id: "ORD-10485", symbol: "TATAMOTORS", side: "SELL", qty: 15, price: 880.0, type: "Limit", status: "Cancelled", time: hoursAgo(30), strategy: "SMA Crossover 20/50" },
  { id: "ORD-10479", symbol: "ITC", side: "BUY", qty: 100, price: 455.2, type: "Market", status: "Executed", time: hoursAgo(52), strategy: "Manual" },
  { id: "ORD-10474", symbol: "HDFCBANK", side: "BUY", qty: 10, price: 1662.0, type: "Limit", status: "Executed", time: hoursAgo(76), strategy: "RSI Mean Reversion" },
  { id: "ORD-10470", symbol: "RELIANCE", side: "BUY", qty: 5, price: 2850.4, type: "Market", status: "Rejected", time: hoursAgo(98), strategy: "Momentum Breakout" },
  { id: "ORD-10466", symbol: "TCS", side: "BUY", qty: 4, price: 3980.0, type: "Limit", status: "Executed", time: hoursAgo(120), strategy: "Manual" },
];

function rng(seed) {
  let s = seed;
  return () => (s = (s * 1664525 + 1013904223) % 4294967296) / 4294967296;
}

function walk(seed, n, drift, vol) {
  const r = rng(seed);
  const out = [100];
  for (let i = 1; i < n; i++) out.push(out[i - 1] * (1 + (r() - 0.5 + drift) * vol));
  return out;
}

// One year of daily portfolio value, scaled so the last point matches today's holdings value.
const holdingsValue = holdings.reduce((s, h) => s + h.qty * h.ltp, 0);
const series = walk(7, 365, 0.04, 0.03);
const scale = holdingsValue / series[series.length - 1];
export const portfolioHistory = series.map((v, i) => ({
  d: new Date(Date.now() - (series.length - 1 - i) * 86400000).toISOString(),
  v: v * scale,
}));

export const strategies = [
  {
    id: "rsi-mr", name: "RSI Mean Reversion", status: "Completed", lastRun: hoursAgo(3),
    period: "Jan 2022 – Dec 2024", universe: "NIFTY 50",
    returnPct: 18.4, sharpe: 1.32, maxDrawdown: -9.7, winRate: 58, trades: 142,
    curve: walk(11, 28, 0.12, 0.05),
  },
  {
    id: "sma-20-50", name: "SMA Crossover 20/50", status: "Completed", lastRun: hoursAgo(29),
    period: "Jan 2021 – Dec 2024", universe: "RELIANCE, TCS, INFY",
    returnPct: 11.2, sharpe: 0.94, maxDrawdown: -14.3, winRate: 46, trades: 67,
    curve: walk(23, 28, 0.06, 0.05),
  },
  {
    id: "mom-break", name: "Momentum Breakout", status: "Running", lastRun: hoursAgo(0.5),
    period: "Jan 2023 – Dec 2024", universe: "NIFTY Next 50",
    returnPct: -3.6, sharpe: -0.21, maxDrawdown: -17.8, winRate: 41, trades: 89,
    curve: walk(31, 28, -0.02, 0.05),
  },
];
