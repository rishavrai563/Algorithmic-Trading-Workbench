"""
Algorithmic Trading Workbench — Streamlit UI
Human-Centered Algorithmic Trading Visualization Workbench

This is the main entry point for the Streamlit application.
It provides:
1. Strategy configuration panel (RSI Mean Reversion)
2. Backtest execution trigger (via LEAN Engine)
3. Results display (metrics, equity curve, trade markers)
"""

import streamlit as st
import plotly.graph_objects as go
# Trigger hot reload
import plotly.express as px
import pandas as pd
from datetime import date, datetime
from pathlib import Path

from prototype.lean_workspace.lean_runner import StrategyConfig, run_backtest, get_docker_status
from prototype.lean_workspace.result_parser import parse_results, load_price_data_from_csv, BacktestResults
from prototype.lean_workspace.data_downloader import ensure_data_available, DEFAULT_DATA_DIR, DEFAULT_OUTPUT_FILE

# ──────────────────────────────────────────────────────────────────────
# Page Configuration
# ──────────────────────────────────────────────────────────────────────
st.set_page_config(
    page_title="AlgoTrading Workbench",
    page_icon="📈",
    layout="wide",
    initial_sidebar_state="expanded",
)

# ──────────────────────────────────────────────────────────────────────
# Custom CSS for clean, functional styling
# ──────────────────────────────────────────────────────────────────────
st.markdown("""
<style>
    /* Main header styling */
    .main-header {
        font-size: 1.8rem;
        font-weight: 700;
        color: #1a1a2e;
        margin-bottom: 0.2rem;
    }
    .sub-header {
        font-size: 0.95rem;
        color: #666;
        margin-bottom: 1.5rem;
    }

    /* Metric cards (Dark Theme) */
    div[data-testid="stMetric"] {
        background: #1e293b;
        border: 1px solid #334155;
        border-radius: 10px;
        padding: 15px;
        box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1);
    }
    div[data-testid="stMetric"] label {
        color: #94a3b8 !important;
    }
    div[data-testid="stMetric"] div[data-testid="stMetricValue"] {
        color: #f8fafc !important;
    }
    
    /* Status badges */
    .status-ready {
        display: inline-block;
        padding: 3px 10px;
        background: #d4edda;
        color: #155724;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 600;
    }
    .status-error {
        display: inline-block;
        padding: 3px 10px;
        background: #f8d7da;
        color: #721c24;
        border-radius: 12px;
        font-size: 0.8rem;
        font-weight: 600;
    }

    /* Sidebar styling */
    section[data-testid="stSidebar"] {
        background: linear-gradient(180deg, #1a1a2e 0%, #16213e 100%);
    }
    section[data-testid="stSidebar"] .stMarkdown {
        color: #e0e0e0;
    }
    section[data-testid="stSidebar"] label {
        color: #b0b0b0 !important;
    }
</style>
""", unsafe_allow_html=True)


# ──────────────────────────────────────────────────────────────────────
# Sidebar — Strategy Configuration
# ──────────────────────────────────────────────────────────────────────
with st.sidebar:
    st.markdown("## ⚙️ Strategy Configuration")
    st.markdown("---")

    # Strategy selector (only RSI for now)
    strategy = st.selectbox(
        "Strategy",
        ["RSI Mean Reversion"],
        index=0,
        help="Select the trading strategy to backtest.",
    )

    # Asset selector
    asset = st.selectbox(
        "Asset",
        ["NIFTY 50"],
        index=0,
        help="Select the asset to trade.",
    )

    # Timeframe
    timeframe = st.selectbox(
        "Timeframe",
        ["Daily"],
        index=0,
        help="Data resolution for the backtest.",
    )

    st.markdown("---")
    st.markdown("### 📅 Historical Period")

    col1, col2 = st.columns(2)
    with col1:
        start_date = st.date_input(
            "Start Date",
            value=date(2020, 1, 1),
            min_value=date(2018, 1, 1),
            max_value=date(2025, 12, 31),
        )
    with col2:
        end_date = st.date_input(
            "End Date",
            value=date(2025, 1, 1),
            min_value=date(2018, 1, 1),
            max_value=date(2025, 12, 31),
        )

    st.markdown("---")
    st.markdown("### 📊 RSI Parameters")

    rsi_period = st.slider(
        "RSI Period",
        min_value=2,
        max_value=50,
        value=14,
        step=1,
        help="Number of periods for RSI calculation.",
    )

    oversold = st.slider(
        "Oversold Threshold",
        min_value=10,
        max_value=50,
        value=30,
        step=1,
        help="RSI below this → BUY signal.",
    )

    overbought = st.slider(
        "Overbought Threshold",
        min_value=50,
        max_value=90,
        value=70,
        step=1,
        help="RSI above this → SELL signal.",
    )

    st.markdown("---")

    # Run backtest button
    run_clicked = st.button(
        "🚀 Run Backtest",
        use_container_width=True,
        type="primary",
    )


# ──────────────────────────────────────────────────────────────────────
# Main Content Area — Header
# ──────────────────────────────────────────────────────────────────────
st.markdown('<div class="main-header">📈 Algorithmic Trading Workbench</div>', unsafe_allow_html=True)
st.markdown(
    '<div class="sub-header">Human-Centered Algorithmic Trading Visualization — '
    'Build, Configure, Test, Explore</div>',
    unsafe_allow_html=True,
)

# ──────────────────────────────────────────────────────────────────────
# Configuration Summary
# ──────────────────────────────────────────────────────────────────────
with st.expander("📋 Current Configuration", expanded=False):
    config_cols = st.columns(3)
    with config_cols[0]:
        st.markdown(f"**Strategy:** {strategy}")
        st.markdown(f"**Asset:** {asset}")
        st.markdown(f"**Timeframe:** {timeframe}")
    with config_cols[1]:
        st.markdown(f"**Start Date:** {start_date}")
        st.markdown(f"**End Date:** {end_date}")
    with config_cols[2]:
        st.markdown(f"**RSI Period:** {rsi_period}")
        st.markdown(f"**Oversold:** {oversold}")
        st.markdown(f"**Overbought:** {overbought}")


# ──────────────────────────────────────────────────────────────────────
# Backtest Execution
# ──────────────────────────────────────────────────────────────────────
if run_clicked:
    # Validate inputs
    if start_date >= end_date:
        st.error("❌ Start date must be before end date.")
        st.stop()

    # Build strategy config
    strategy_config = StrategyConfig(
        strategy_name=strategy,
        asset=asset,
        timeframe=timeframe,
        start_date=start_date.strftime("%Y-%m-%d"),
        end_date=end_date.strftime("%Y-%m-%d"),
        rsi_period=rsi_period,
        oversold=oversold,
        overbought=overbought,
    )

    # Check Docker
    with st.spinner("🔍 Checking system prerequisites..."):
        docker_status = get_docker_status()

    if not docker_status["docker_available"]:
        st.error("❌ Docker is not running. Please start Docker Desktop and try again.")
        st.stop()

    # Ensure data is available
    with st.spinner("📦 Ensuring NIFTY 50 data is available..."):
        try:
            ensure_data_available()
        except Exception as e:
            st.error(f"❌ Data error: {e}")
            st.stop()

    # Show progress
    progress_container = st.empty()
    with progress_container.container():
        st.info("⏳ **Running LEAN Backtest...**\n\n"
                "The LEAN engine is executing your RSI Mean Reversion strategy.\n"
                "The engine is actively monitored and will return instantly when analysis is complete.")

        with st.spinner("Running backtest via LEAN Engine..."):
            backtest_result = run_backtest(strategy_config)

    # Clear progress
    progress_container.empty()

    if not backtest_result["success"]:
        st.error("❌ **Backtest Failed**")
        with st.expander("🔍 Error Details", expanded=True):
            if backtest_result["stderr"]:
                st.code(backtest_result["stderr"][-2000:], language="text")
            if backtest_result["stdout"]:
                st.code(backtest_result["stdout"][-2000:], language="text")
        st.stop()

    # ──────────────────────────────────────────────────────────────
    # Parse Results
    # ──────────────────────────────────────────────────────────────
    results = parse_results(backtest_result["results_data"])

    if not results.success:
        st.warning(f"⚠️ Results parsing issue: {results.error_message}")

    # Store results in session state for persistence across reruns
    st.session_state["backtest_results"] = results
    st.session_state["backtest_config"] = strategy_config
    st.session_state["raw_result"] = backtest_result


# ──────────────────────────────────────────────────────────────────────
# Results Display (from session state)
# ──────────────────────────────────────────────────────────────────────
if "backtest_results" in st.session_state:
    results: BacktestResults = st.session_state["backtest_results"]
    config_used: StrategyConfig = st.session_state["backtest_config"]

    st.markdown("---")
    st.markdown("## 📊 Backtest Results")
    st.markdown(
        f"Strategy: **{config_used.strategy_name}** | "
        f"Asset: **{config_used.asset}** | "
        f"Period: **{config_used.start_date}** to **{config_used.end_date}**"
    )

    # ──────────────────────────────────────────────────────────────
    # P5: Metrics Display
    # ──────────────────────────────────────────────────────────────
    st.markdown("### Key Metrics")

    m1, m2, m3, m4 = st.columns(4)

    with m1:
        return_val = results.metrics.total_return
        st.metric(
            "Total Return",
            f"{return_val:+.2f}%",
            delta=f"{'Profit' if return_val > 0 else 'Loss'}",
            delta_color="normal" if return_val > 0 else "inverse",
        )

    with m2:
        dd_val = results.metrics.max_drawdown
        st.metric(
            "Max Drawdown",
            f"{dd_val:.2f}%",
            delta="Risk",
            delta_color="inverse",
        )

    with m3:
        st.metric(
            "Total Trades",
            f"{results.metrics.total_trades}",
        )

    with m4:
        st.metric(
            "Sharpe Ratio",
            f"{results.metrics.sharpe_ratio:.3f}",
        )

    # ──────────────────────────────────────────────────────────────
    # P6: Equity Curve
    # ──────────────────────────────────────────────────────────────
    if results.equity_curve is not None and len(results.equity_curve) > 0:
        st.markdown("### 📈 Equity Curve")

        fig_equity = go.Figure()
        fig_equity.add_trace(go.Scatter(
            x=results.equity_curve["time"],
            y=results.equity_curve["equity"],
            mode="lines",
            name="Portfolio Equity",
            line=dict(color="#2962FF", width=2),
            fill="tozeroy",
            fillcolor="rgba(41, 98, 255, 0.1)",
        ))

        fig_equity.update_layout(
            height=400,
            margin=dict(l=50, r=30, t=30, b=50),
            xaxis_title="Date",
            yaxis_title="Portfolio Value (₹)",
            template="plotly_white",
            hovermode="x unified",
            xaxis=dict(
                rangeslider=dict(visible=False),
                type="date",
            ),
        )

        st.plotly_chart(fig_equity, use_container_width=True)

    # ──────────────────────────────────────────────────────────────
    # P6: Price Chart with Trade Markers
    # ──────────────────────────────────────────────────────────────
    # Try to get price data from results or fall back to CSV
    price_df = results.price_data
    if price_df is None or len(price_df) == 0:
        csv_path = DEFAULT_DATA_DIR / DEFAULT_OUTPUT_FILE
        if csv_path.exists():
            price_df = load_price_data_from_csv(
                str(csv_path),
                config_used.start_date,
                config_used.end_date,
            )

    if price_df is not None and len(price_df) > 0 and len(results.trades) > 0:
        st.markdown("### 📉 Price Chart with Trade Signals")

        fig_price = go.Figure()

        # Price line
        fig_price.add_trace(go.Scatter(
            x=price_df["time"],
            y=price_df["price"],
            mode="lines",
            name="NIFTY 50 Price",
            line=dict(color="#495057", width=1.5),
        ))

        # Trade markers
        buy_trades = [t for t in results.trades if t.direction == "Buy"]
        sell_trades = [t for t in results.trades if t.direction == "Sell"]

        if buy_trades:
            buy_times = [pd.Timestamp(t.time) for t in buy_trades]
            buy_prices = [t.price for t in buy_trades]

            fig_price.add_trace(go.Scatter(
                x=buy_times,
                y=buy_prices,
                mode="markers",
                name="BUY",
                marker=dict(
                    symbol="triangle-up",
                    size=12,
                    color="#00C853",
                    line=dict(width=1, color="#1B5E20"),
                ),
            ))

        if sell_trades:
            sell_times = [pd.Timestamp(t.time) for t in sell_trades]
            sell_prices = [t.price for t in sell_trades]

            fig_price.add_trace(go.Scatter(
                x=sell_times,
                y=sell_prices,
                mode="markers",
                name="SELL",
                marker=dict(
                    symbol="triangle-down",
                    size=12,
                    color="#FF1744",
                    line=dict(width=1, color="#B71C1C"),
                ),
            ))

        fig_price.update_layout(
            height=450,
            margin=dict(l=50, r=30, t=30, b=50),
            xaxis_title="Date",
            yaxis_title="Price (₹)",
            template="plotly_white",
            hovermode="x unified",
            legend=dict(
                orientation="h",
                yanchor="bottom",
                y=1.02,
                xanchor="right",
                x=1,
            ),
        )

        st.plotly_chart(fig_price, use_container_width=True)

    elif price_df is not None and len(price_df) > 0:
        st.markdown("### 📉 Price Chart")

        fig_price = go.Figure()
        fig_price.add_trace(go.Scatter(
            x=price_df["time"],
            y=price_df["price"],
            mode="lines",
            name="NIFTY 50 Price",
            line=dict(color="#495057", width=1.5),
        ))
        fig_price.update_layout(
            height=400,
            margin=dict(l=50, r=30, t=30, b=50),
            xaxis_title="Date",
            yaxis_title="Price (₹)",
            template="plotly_white",
        )
        st.plotly_chart(fig_price, use_container_width=True)

    # ──────────────────────────────────────────────────────────────
    # Trade Log Table
    # ──────────────────────────────────────────────────────────────
    if results.trades:
        st.markdown("### 📋 Trade Log")

        trade_data = []
        for t in results.trades:
            trade_data.append({
                "Time": t.time,
                "Direction": t.direction,
                "Price": f"₹{t.price:,.2f}",
                "Quantity": t.quantity,
            })

        trade_df = pd.DataFrame(trade_data)
        st.dataframe(trade_df, use_container_width=True, hide_index=True)

    # ──────────────────────────────────────────────────────────────
    # Raw Statistics (collapsible)
    # ──────────────────────────────────────────────────────────────
    if results.raw_statistics:
        with st.expander("📊 All Statistics", expanded=False):
            stats_df = pd.DataFrame(
                [(k, v) for k, v in results.raw_statistics.items()],
                columns=["Metric", "Value"],
            )
            st.dataframe(stats_df, use_container_width=True, hide_index=True)

    # Debug info
    if "raw_result" in st.session_state:
        with st.expander("🔧 Debug Output", expanded=False):
            raw = st.session_state["raw_result"]
            if raw.get("stdout"):
                st.text("STDOUT (last 2000 chars):")
                st.code(raw["stdout"][-2000:], language="text")
            if raw.get("stderr"):
                st.text("STDERR (last 2000 chars):")
                st.code(raw["stderr"][-2000:], language="text")

else:
    # ──────────────────────────────────────────────────────────────
    # Welcome state (no results yet)
    # ──────────────────────────────────────────────────────────────
    st.markdown("---")

    col_welcome_1, col_welcome_2 = st.columns([2, 1])

    with col_welcome_1:
        st.markdown("""
        ### 🎯 Getting Started

        1. **Configure** your strategy parameters in the sidebar
        2. **Set** the historical period and RSI thresholds
        3. **Click** "🚀 Run Backtest" to execute

        The workbench will send your configuration to the **LEAN Engine**,
        run the backtest against historical NIFTY 50 data, and display
        real performance metrics and visualizations.
        """)

    with col_welcome_2:
        st.markdown("#### System Status")
        docker_status = get_docker_status()

        if docker_status["docker_available"]:
            st.markdown('<span class="status-ready">✅ Docker Running</span>', unsafe_allow_html=True)
        else:
            st.markdown('<span class="status-error">❌ Docker Not Running</span>', unsafe_allow_html=True)

        if docker_status["lean_image_exists"]:
            st.markdown('<span class="status-ready">✅ LEAN Image Ready</span>', unsafe_allow_html=True)
        else:
            st.markdown('<span class="status-error">⏳ LEAN Image (will download on first run, ~3GB)</span>',
                        unsafe_allow_html=True)

        # Check data
        csv_path = DEFAULT_DATA_DIR / DEFAULT_OUTPUT_FILE
        if csv_path.exists():
            st.markdown('<span class="status-ready">✅ NIFTY 50 Data Ready</span>', unsafe_allow_html=True)
        else:
            st.markdown('<span class="status-error">⏳ NIFTY Data (will download on first run)</span>',
                        unsafe_allow_html=True)

    # Show workflow diagram
    st.markdown("---")
    st.markdown("### 🔄 Workflow")
    st.markdown("""
    ```
    ┌──────────┐    ┌──────────────┐    ┌─────────────┐    ┌──────────────┐
    │ Configure │ →  │ Run Backtest │ →  │ LEAN Engine │ →  │ View Results │
    │ Strategy  │    │   (Docker)   │    │  Executes   │    │  & Charts    │
    └──────────┘    └──────────────┘    └─────────────┘    └──────────────┘
    ```
    """)
