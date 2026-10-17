import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { profile, holdings, orders, strategies, portfolioHistory } from "./profileData";
import "./Profile.css";

/* ------------------------------------------------------------------ *
 * Connecting real data
 * Replace the imports above with fetches to your C# backend, e.g.
 *   const [data, setData] = useState(null);
 *   useEffect(() => {
 *     fetch("http://localhost:5000/api/profile").then(r => r.json()).then(setData);
 *   }, []);
 * Keep the same shapes as profileData.js and the rest of this file works as-is.
 * ------------------------------------------------------------------ */

// Adjust these to match the routes in your App.jsx
const ROUTES = {
  results: (id) => `/results`,
  builder: "/strategy",
};

const TABS = [
  ["portfolio", "Portfolio"],
  ["orders", "Orders"],
  ["winners", "Winners"],
  ["strategies", "Recent strategies"],
];
const RANGES = [["1W", 7], ["1M", 30], ["3M", 90], ["1Y", 365]];
const ORDER_FILTERS = ["All", "Executed", "Pending", "Cancelled", "Rejected"];

/* ---------- formatters ---------- */
const inr = (n) => n.toLocaleString("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 });
const signedInr = (n) => `${n >= 0 ? "+" : "−"}${inr(Math.abs(n))}`;
const pct = (n) => `${n >= 0 ? "+" : "−"}${Math.abs(n).toFixed(2)}%`;
const tone = (n) => (n >= 0 ? "gain" : "loss");
const when = (iso) =>
  new Date(iso).toLocaleString("en-IN", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
const day = (iso) => new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
const initials = (name) => name.split(" ").map((w) => w[0]).join("").slice(0, 2);

function timeAgo(iso) {
  const mins = Math.round((Date.now() - new Date(iso)) / 60000);
  if (mins < 60) return `${Math.max(mins, 1)} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 24) return `${hrs} hr ago`;
  return `${Math.round(hrs / 24)} d ago`;
}

/* ---------- charts ---------- */
function LineChart({ points }) {
  const [hover, setHover] = useState(null);
  const W = 640, H = 220, P = 8;
  const vals = points.map((p) => p.v);
  const min = Math.min(...vals), max = Math.max(...vals);
  const x = (i) => P + (i / (points.length - 1)) * (W - 2 * P);
  const y = (v) => H - P - ((v - min) / (max - min || 1)) * (H - 2 * P);
  const line = points.map((p, i) => `${i ? "L" : "M"}${x(i).toFixed(1)},${y(p.v).toFixed(1)}`).join("");
  const area = `${line}L${x(points.length - 1)},${H}L${x(0)},${H}Z`;
  const up = points[points.length - 1].v >= points[0].v;

  const onMove = (e) => {
    const r = e.currentTarget.getBoundingClientRect();
    const t = (e.clientX - r.left) / r.width;
    setHover(Math.min(points.length - 1, Math.max(0, Math.round(t * (points.length - 1)))));
  };
  const hp = hover !== null ? points[hover] : null;

  return (
    <div
      className={`chart ${up ? "up" : "down"}`}
      onPointerMove={onMove}
      onPointerLeave={() => setHover(null)}
    >
      <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label="Portfolio value over time">
        <path d={area} className="chart-area" />
        <path d={line} className="chart-line" vectorEffect="non-scaling-stroke" />
      </svg>
      {hp && (
        <>
          <span className="chart-cursor" style={{ left: `${(x(hover) / W) * 100}%` }} />
          <span className="chart-dot" style={{ left: `${(x(hover) / W) * 100}%`, top: `${(y(hp.v) / H) * 100}%` }} />
          <div
            className="chart-tip"
            style={{ left: `${Math.min(Math.max((x(hover) / W) * 100, 14), 86)}%` }}
          >
            <strong>{inr(hp.v)}</strong>
            <span>{day(hp.d)}</span>
          </div>
        </>
      )}
    </div>
  );
}

function Sparkline({ values, positive }) {
  const W = 120, H = 36;
  const min = Math.min(...values), max = Math.max(...values);
  const d = values
    .map((v, i) => `${i ? "L" : "M"}${((i / (values.length - 1)) * W).toFixed(1)},${(H - 3 - ((v - min) / (max - min || 1)) * (H - 6)).toFixed(1)}`)
    .join("");
  return (
    <svg className={`spark ${positive ? "up" : "down"}`} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
      <path d={d} />
    </svg>
  );
}

/* ---------- main page ---------- */
export default function Profile() {
  const [tab, setTab] = useState("portfolio");
  const [range, setRange] = useState(90);
  const [sort, setSort] = useState({ key: "value", dir: "desc" });
  const [orderFilter, setOrderFilter] = useState("All");

  // Derived numbers per holding
  const rows = useMemo(
    () =>
      holdings.map((h) => {
        const invested = h.qty * h.avg;
        const value = h.qty * h.ltp;
        const pnl = value - invested;
        return {
          ...h,
          invested,
          value,
          pnl,
          pnlPct: (pnl / invested) * 100,
          dayPnl: h.qty * (h.ltp - h.prevClose),
          dayPct: ((h.ltp - h.prevClose) / h.prevClose) * 100,
        };
      }),
    []
  );

  const totals = useMemo(() => {
    const invested = rows.reduce((s, r) => s + r.invested, 0);
    const value = rows.reduce((s, r) => s + r.value, 0);
    const dayPnl = rows.reduce((s, r) => s + r.dayPnl, 0);
    return {
      invested,
      value,
      pnl: value - invested,
      pnlPct: ((value - invested) / invested) * 100,
      dayPnl,
      dayPct: (dayPnl / (value - dayPnl)) * 100,
    };
  }, [rows]);

  const sorted = useMemo(() => {
    const f = sort.dir === "asc" ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      return typeof av === "string" ? av.localeCompare(bv) * f : (av - bv) * f;
    });
  }, [rows, sort]);

  const chartPoints = portfolioHistory.slice(-range);
  const rangeChange = chartPoints[chartPoints.length - 1].v - chartPoints[0].v;
  const rangeChangePct = (rangeChange / chartPoints[0].v) * 100;

  const filteredOrders = orders.filter((o) => orderFilter === "All" || o.status === orderFilter);

  const ranked = [...rows].sort((a, b) => b.pnlPct - a.pnlPct);
  const winners = ranked.filter((r) => r.pnl > 0);
  const losers = ranked.filter((r) => r.pnl < 0).reverse();
  const largest = [...rows].sort((a, b) => b.value - a.value)[0];
  const maxAbs = Math.max(...rows.map((r) => Math.abs(r.pnlPct)));
  const bestStrategy = [...strategies].sort((a, b) => b.returnPct - a.returnPct)[0];

  const setSortKey = (key) =>
    setSort((s) => (s.key === key ? { key, dir: s.dir === "asc" ? "desc" : "asc" } : { key, dir: "desc" }));

  const Th = ({ k, children, align }) => (
    <th aria-sort={sort.key === k ? (sort.dir === "asc" ? "ascending" : "descending") : "none"} className={align}>
      <button type="button" onClick={() => setSortKey(k)}>
        {children}
        <span aria-hidden="true">{sort.key === k ? (sort.dir === "asc" ? " ▲" : " ▼") : ""}</span>
      </button>
    </th>
  );

  return (
    <main className="profile">
      {/* Identity */}
      <header className="pf-head">
        <div className="pf-avatar" aria-hidden="true">{initials(profile.name)}</div>
        <div className="pf-id">
          <h1>{profile.name}</h1>
          <p>{profile.email} · Client ID {profile.clientId} · Member since {profile.memberSince}</p>
        </div>
        <Link className="btn" to={ROUTES.builder}>New strategy</Link>
      </header>

      {/* Value + chart */}
      <section className="pf-hero" aria-label="Portfolio summary">
        <div className="pf-value">
          <span className="muted">Current value</span>
          <p className="pf-big">{inr(totals.value)}</p>
          <p className={`pf-delta ${tone(rangeChange)}`}>
            {signedInr(rangeChange)} ({pct(rangeChangePct)})
            <span className="muted"> past {RANGES.find((r) => r[1] === range)[0]}</span>
          </p>
        </div>

        <LineChart points={chartPoints} />

        <div className="pf-ranges" role="group" aria-label="Chart range">
          {RANGES.map(([label, n]) => (
            <button
              key={label}
              type="button"
              className={range === n ? "chip on" : "chip"}
              aria-pressed={range === n}
              onClick={() => setRange(n)}
            >
              {label}
            </button>
          ))}
        </div>

        <dl className="pf-stats">
          <div><dt>Invested</dt><dd>{inr(totals.invested)}</dd></div>
          <div><dt>Total returns</dt><dd className={tone(totals.pnl)}>{signedInr(totals.pnl)} <small>{pct(totals.pnlPct)}</small></dd></div>
          <div><dt>1D returns</dt><dd className={tone(totals.dayPnl)}>{signedInr(totals.dayPnl)} <small>{pct(totals.dayPct)}</small></dd></div>
          <div><dt>Available cash</dt><dd>{inr(profile.cash)}</dd></div>
        </dl>
      </section>

      {/* Tabs */}
      <div className="pf-tabs" role="tablist" aria-label="Profile sections">
        {TABS.map(([id, label]) => (
          <button
            key={id}
            role="tab"
            id={`tab-${id}`}
            aria-selected={tab === id}
            aria-controls={`panel-${id}`}
            className={tab === id ? "tab on" : "tab"}
            onClick={() => setTab(id)}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Portfolio */}
      {tab === "portfolio" && (
        <section role="tabpanel" id="panel-portfolio" aria-labelledby="tab-portfolio" className="pf-panel">
          <div className="alloc" aria-label="Allocation by holding">
            {[...rows].sort((a, b) => b.value - a.value).map((r, i) => (
              <span
                key={r.symbol}
                title={`${r.symbol} ${((r.value / totals.value) * 100).toFixed(1)}%`}
                style={{ width: `${(r.value / totals.value) * 100}%`, opacity: 1 - i * 0.09 }}
              />
            ))}
          </div>
          <p className="muted alloc-note">
            Largest position: {largest.symbol} at {((largest.value / totals.value) * 100).toFixed(1)}% of holdings
          </p>

          <div className="table-wrap">
            <table>
              <caption className="sr">Holdings</caption>
              <thead>
                <tr>
                  <Th k="symbol">Company</Th>
                  <Th k="qty" align="r">Qty</Th>
                  <Th k="avg" align="r">Avg. cost</Th>
                  <Th k="ltp" align="r">Price</Th>
                  <Th k="value" align="r">Value</Th>
                  <Th k="pnlPct" align="r">Returns</Th>
                  <Th k="dayPct" align="r">1D</Th>
                </tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.symbol}>
                    <td><strong>{r.symbol}</strong><div className="muted sm">{r.name}</div></td>
                    <td className="r">{r.qty}</td>
                    <td className="r">{inr(r.avg)}</td>
                    <td className="r">{inr(r.ltp)}</td>
                    <td className="r">{inr(r.value)}</td>
                    <td className={`r ${tone(r.pnl)}`}>{signedInr(r.pnl)}<div className="sm">{pct(r.pnlPct)}</div></td>
                    <td className={`r ${tone(r.dayPct)}`}>{pct(r.dayPct)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* Orders */}
      {tab === "orders" && (
        <section role="tabpanel" id="panel-orders" aria-labelledby="tab-orders" className="pf-panel">
          <div className="filters" role="group" aria-label="Filter orders by status">
            {ORDER_FILTERS.map((f) => (
              <button
                key={f}
                type="button"
                className={orderFilter === f ? "chip on" : "chip"}
                aria-pressed={orderFilter === f}
                onClick={() => setOrderFilter(f)}
              >
                {f}
              </button>
            ))}
          </div>

          {filteredOrders.length === 0 ? (
            <p className="empty">No {orderFilter.toLowerCase()} orders yet.</p>
          ) : (
            <ul className="orders">
              {filteredOrders.map((o) => (
                <li key={o.id}>
                  <span className={`side ${o.side === "BUY" ? "buy" : "sell"}`}>{o.side === "BUY" ? "Buy" : "Sell"}</span>
                  <div className="o-main">
                    <strong>{o.symbol}</strong>
                    <span className="muted sm">{o.qty} shares · {o.type} · {o.strategy}</span>
                  </div>
                  <div className="o-price">
                    <strong>{inr(o.price)}</strong>
                    <span className="muted sm">{when(o.time)}</span>
                  </div>
                  <span className={`status ${o.status.toLowerCase()}`}>{o.status}</span>
                </li>
              ))}
            </ul>
          )}
        </section>
      )}

      {/* Winners */}
      {tab === "winners" && (
        <section role="tabpanel" id="panel-winners" aria-labelledby="tab-winners" className="pf-panel">
          <div className="win-grid">
            <RankList title="Top winners" items={winners} maxAbs={maxAbs} />
            <RankList title="Lagging behind" items={losers} maxAbs={maxAbs} />
          </div>
          <p className="best-strat">
            Best strategy so far: <strong>{bestStrategy.name}</strong>{" "}
            <span className={tone(bestStrategy.returnPct)}>{pct(bestStrategy.returnPct)}</span> in backtest.
          </p>
        </section>
      )}

      {/* Strategies */}
      {tab === "strategies" && (
        <section role="tabpanel" id="panel-strategies" aria-labelledby="tab-strategies" className="pf-panel">
          <div className="strat-grid">
            {strategies.map((s) => (
              <article key={s.id} className="strat">
                <div className="strat-top">
                  <div>
                    <h3>{s.name}</h3>
                    <p className="muted sm">{s.universe} · {s.period}</p>
                  </div>
                  <span className={`status ${s.status.toLowerCase()}`}>{s.status}</span>
                </div>
                <div className="strat-mid">
                  <p className={`strat-ret ${tone(s.returnPct)}`}>{pct(s.returnPct)}</p>
                  <Sparkline values={s.curve} positive={s.returnPct >= 0} />
                </div>
                <dl className="mini">
                  <div><dt>Sharpe</dt><dd>{s.sharpe.toFixed(2)}</dd></div>
                  <div><dt>Max drawdown</dt><dd className="loss">{s.maxDrawdown.toFixed(1)}%</dd></div>
                  <div><dt>Win rate</dt><dd>{s.winRate}%</dd></div>
                  <div><dt>Trades</dt><dd>{s.trades}</dd></div>
                </dl>
                <div className="strat-foot">
                  <span className="muted sm">Last run {timeAgo(s.lastRun)}</span>
                  <Link to={ROUTES.results(s.id)}>View results</Link>
                </div>
              </article>
            ))}
          </div>
        </section>
      )}
    </main>
  );
}

function RankList({ title, items, maxAbs }) {
  return (
    <div className="rank">
      <h3>{title}</h3>
      {items.length === 0 ? (
        <p className="empty">Nothing here right now.</p>
      ) : (
        <ol>
          {items.map((r) => (
            <li key={r.symbol}>
              <div className="rank-row">
                <strong>{r.symbol}</strong>
                <span className={tone(r.pnl)}>{pct(r.pnlPct)} · {signedInr(r.pnl)}</span>
              </div>
              <div className="bar"><span className={tone(r.pnl)} style={{ width: `${(Math.abs(r.pnlPct) / maxAbs) * 100}%` }} /></div>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}