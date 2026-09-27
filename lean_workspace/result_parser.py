"""
LEAN Result Parser
Parses the JSON output from a LEAN backtest into structured data
ready for Streamlit display.
"""

import json
import pandas as pd
from dataclasses import dataclass, field
from typing import List, Optional, Dict, Any
from pathlib import Path


@dataclass
class TradeEvent:
    """Represents a single BUY or SELL trade."""
    time: str
    direction: str  # "Buy" or "Sell"
    price: float
    quantity: float
    order_id: int


@dataclass
class BacktestMetrics:
    """Key performance metrics from the backtest."""
    total_return: float = 0.0       # percentage
    max_drawdown: float = 0.0       # percentage (negative)
    total_trades: int = 0
    sharpe_ratio: float = 0.0
    win_rate: float = 0.0
    net_profit: float = 0.0


@dataclass
class BacktestResults:
    """Complete parsed backtest results."""
    success: bool = False
    metrics: BacktestMetrics = field(default_factory=BacktestMetrics)
    equity_curve: Optional[pd.DataFrame] = None  # columns: [time, equity]
    trades: List[TradeEvent] = field(default_factory=list)
    price_data: Optional[pd.DataFrame] = None  # columns: [time, price]
    raw_statistics: Dict[str, str] = field(default_factory=dict)
    error_message: str = ""


def parse_results(results_data: dict) -> BacktestResults:
    """
    Parse LEAN JSON results into a BacktestResults object.

    Args:
        results_data: The raw JSON dictionary from LEAN results file.

    Returns:
        BacktestResults with metrics, equity curve, and trade events.
    """
    result = BacktestResults()

    if not results_data:
        result.error_message = "No results data provided."
        return result

    try:
        # Parse statistics (LEAN sometimes uses 'statistics' and sometimes 'Statistics')
        result.raw_statistics = results_data.get("statistics", results_data.get("Statistics", {}))
        result.metrics = _parse_metrics(result.raw_statistics, results_data)

        # Parse equity curve from Charts
        result.equity_curve = _parse_equity_curve(results_data)

        # Parse orders/trades
        result.trades = _parse_orders(results_data)

        # Parse price data from charts (if available via benchmark)
        result.price_data = _parse_price_data(results_data)

        result.success = True

    except Exception as e:
        result.error_message = f"Error parsing results: {str(e)}"

    return result


def _parse_metrics(statistics: dict, full_data: dict) -> BacktestMetrics:
    """Extract key metrics from the Statistics section."""
    metrics = BacktestMetrics()

    # Total Return (e.g., "12.34%")
    total_return_str = statistics.get("Net Profit", statistics.get("Total Net Profit", "0%"))
    metrics.total_return = _parse_percentage(total_return_str)

    # Max Drawdown (e.g., "-5.67%")
    max_dd_str = statistics.get("Drawdown", "0%")
    metrics.max_drawdown = _parse_percentage(max_dd_str)

    # Total Trades
    total_trades_str = statistics.get("Total Orders", "0")
    metrics.total_trades = int(total_trades_str) if total_trades_str else 0

    # Sharpe Ratio
    sharpe_str = statistics.get("Sharpe Ratio", "0")
    try:
        metrics.sharpe_ratio = float(sharpe_str)
    except (ValueError, TypeError):
        metrics.sharpe_ratio = 0.0

    # Win Rate
    win_rate_str = statistics.get("Win Rate", "0%")
    metrics.win_rate = _parse_percentage(win_rate_str)

    # Net Profit
    net_profit_str = statistics.get("Net Profit", "$0")
    metrics.net_profit = _parse_currency(net_profit_str)

    return metrics


def _parse_percentage(value: str) -> float:
    """Parse a percentage string like '12.34%' to float 12.34."""
    if not value:
        return 0.0
    try:
        return float(value.replace("%", "").replace(",", "").strip())
    except (ValueError, TypeError):
        return 0.0


def _parse_currency(value: str) -> float:
    """Parse a currency string like '$1,234.56' or '₹1,234.56' to float."""
    if not value:
        return 0.0
    try:
        # Remove currency symbols and commas
        cleaned = value.replace("$", "").replace("₹", "").replace(",", "").replace("€", "").strip()
        return float(cleaned)
    except (ValueError, TypeError):
        return 0.0


def _parse_equity_curve(results_data: dict) -> Optional[pd.DataFrame]:
    """
    Extract equity curve from Charts > Strategy Equity > Series > Equity > Values.
    Each value is typically: {"x": unix_timestamp, "y": equity_value}
    """
    try:
        charts = results_data.get("charts", results_data.get("Charts", {}))
        strategy_equity = charts.get("Strategy Equity", {})
        series = strategy_equity.get("series", strategy_equity.get("Series", {}))
        equity_series = series.get("Equity", {})
        values = equity_series.get("values", equity_series.get("Values", []))

        if not values:
            return None

        times = []
        equities = []

        for point in values:
            if isinstance(point, dict):
                timestamp = point.get("x", 0)
                equity = point.get("y", 0)
            elif isinstance(point, (list, tuple)) and len(point) >= 2:
                timestamp = point[0]
                equity = point[1]
            else:
                continue

            # Convert Unix timestamp (seconds) to datetime
            times.append(pd.Timestamp(timestamp, unit="s"))
            equities.append(float(equity))

        if not times:
            return None

        df = pd.DataFrame({"time": times, "equity": equities})
        df = df.sort_values("time").reset_index(drop=True)
        return df

    except Exception:
        return None


def _parse_price_data(results_data: dict) -> Optional[pd.DataFrame]:
    """
    Extract price data from Charts > Benchmark or custom chart.
    Falls back to None if not available (price data will come from CSV).
    """
    try:
        charts = results_data.get("charts", results_data.get("Charts", {}))

        # Try Benchmark chart first
        for chart_name in ["Benchmark", "NIFTY50"]:
            chart = charts.get(chart_name, {})
            series = chart.get("Series", {})

            for series_name, series_data in series.items():
                values = series_data.get("Values", [])
                if not values:
                    continue

                times = []
                prices = []

                for point in values:
                    if isinstance(point, dict):
                        timestamp = point.get("x", 0)
                        price = point.get("y", 0)
                    elif isinstance(point, (list, tuple)):
                        timestamp = point[0]
                        price = point[1]
                    else:
                        continue

                    times.append(pd.Timestamp(timestamp, unit="s"))
                    prices.append(float(price))

                if times:
                    df = pd.DataFrame({"time": times, "price": prices})
                    df = df.sort_values("time").reset_index(drop=True)
                    return df

        return None

    except Exception:
        return None


def _parse_orders(results_data: dict) -> List[TradeEvent]:
    """Extract trade events from the Orders section."""
    trades = []

    try:
        orders = results_data.get("orders", results_data.get("Orders", {}))

        for order_id, order in orders.items():
            if isinstance(order, dict):
                # Get order details (LEAN uses both 'direction' and 'Direction')
                direction_val = order.get("direction", order.get("Direction", 0))
                if direction_val == 0:
                    direction = "Buy"
                elif direction_val == 1:
                    direction = "Sell"
                else:
                    direction = "Buy" if str(direction_val).lower() == "buy" else "Sell"

                # Try to get fill price and time
                price = order.get("price", order.get("Price", 0))
                quantity = abs(order.get("quantity", order.get("Quantity", 0)))
                time_str = order.get("time", order.get("Time", ""))

                # Check order events for actual fill data
                order_events = order.get("orderEvents", order.get("OrderEvents", []))
                if order_events:
                    last_event = order_events[-1]
                    fill_price = last_event.get("fillPrice", last_event.get("FillPrice", 0))
                    if fill_price > 0:
                        price = fill_price
                    fill_qty = last_event.get("fillQuantity", last_event.get("FillQuantity", 0))
                    if fill_qty != 0:
                        quantity = abs(fill_qty)

                trade = TradeEvent(
                    time=time_str,
                    direction=direction,
                    price=float(price),
                    quantity=float(quantity),
                    order_id=int(order_id),
                )
                trades.append(trade)

    except Exception:
        pass

    return trades


def load_price_data_from_csv(csv_path: str, start_date: str, end_date: str) -> Optional[pd.DataFrame]:
    """
    Load NIFTY 50 price data from the local CSV file.
    Used as a fallback when LEAN doesn't include price data in results.
    """
    try:
        df = pd.read_csv(csv_path)
        df["time"] = pd.to_datetime(df["Date"])
        df["price"] = df["Close"]

        # Filter by date range
        start = pd.Timestamp(start_date)
        end = pd.Timestamp(end_date)
        df = df[(df["time"] >= start) & (df["time"] <= end)]

        return df[["time", "price"]].reset_index(drop=True)

    except Exception:
        return None


if __name__ == "__main__":
    # Test with a sample results file
    import sys

    if len(sys.argv) > 1:
        with open(sys.argv[1], "r") as f:
            data = json.load(f)

        results = parse_results(data)
        print(f"Success: {results.success}")
        print(f"Total Return: {results.metrics.total_return}%")
        print(f"Max Drawdown: {results.metrics.max_drawdown}%")
        print(f"Total Trades: {results.metrics.total_trades}")
        print(f"Equity curve points: {len(results.equity_curve) if results.equity_curve is not None else 0}")
        print(f"Trade events: {len(results.trades)}")
    else:
        print("Usage: python result_parser.py <results.json>")
