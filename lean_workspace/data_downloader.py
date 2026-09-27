"""
Data Downloader
Downloads NIFTY 50 historical OHLCV data from yfinance and saves it
in LEAN-compatible CSV format for use with the custom data class.
"""

import os
import yfinance as yf
import pandas as pd
from pathlib import Path


# Default paths
DEFAULT_DATA_DIR = Path(__file__).parent / "lean_workspace" / "data" / "custom"
DEFAULT_OUTPUT_FILE = "nifty50.csv"

# yfinance ticker for NIFTY 50
NIFTY_TICKER = "^NSEI"


def download_nifty_data(
    start_date: str = "2018-01-01",
    end_date: str = "2025-12-31",
    output_dir: Path = DEFAULT_DATA_DIR,
    output_file: str = DEFAULT_OUTPUT_FILE,
    force: bool = False,
) -> Path:
    """
    Download NIFTY 50 daily data from yfinance and save as CSV.

    Args:
        start_date: Start date for data download (YYYY-MM-DD).
                    We start from 2018 to have warmup buffer for indicators.
        end_date: End date for data download (YYYY-MM-DD).
        output_dir: Directory to save the CSV file.
        output_file: Name of the output CSV file.
        force: If True, re-download even if file exists.

    Returns:
        Path to the saved CSV file.
    """
    output_path = output_dir / output_file

    # Skip if data already exists and force is not set
    if output_path.exists() and not force:
        print(f"[data_downloader] Data already exists at {output_path}")
        return output_path

    # Ensure output directory exists
    output_dir.mkdir(parents=True, exist_ok=True)

    print(f"[data_downloader] Downloading NIFTY 50 data ({start_date} to {end_date})...")

    # Download from yfinance
    df = yf.download(NIFTY_TICKER, start=start_date, end=end_date, progress=True)

    if df.empty:
        raise RuntimeError("Failed to download NIFTY 50 data from yfinance. Check internet connection.")

    # yfinance returns multi-level columns when downloading single ticker
    # Flatten if needed
    if isinstance(df.columns, pd.MultiIndex):
        df.columns = df.columns.get_level_values(0)

    # Keep only OHLCV columns and ensure correct order
    df = df[["Open", "High", "Low", "Close", "Volume"]].copy()

    # Reset index so Date becomes a column
    df.index.name = "Date"
    df = df.reset_index()

    # Format date as YYYY-MM-DD string
    df["Date"] = pd.to_datetime(df["Date"]).dt.strftime("%Y-%m-%d")

    # Round prices to 2 decimal places
    for col in ["Open", "High", "Low", "Close"]:
        df[col] = df[col].round(2)

    # Convert volume to integer
    df["Volume"] = df["Volume"].fillna(0).astype(int)

    # Drop any rows with NaN prices
    df = df.dropna(subset=["Open", "High", "Low", "Close"])

    # Save to CSV without index
    df.to_csv(output_path, index=False)

    print(f"[data_downloader] Saved {len(df)} rows to {output_path}")
    return output_path


def ensure_data_available(data_dir: Path = DEFAULT_DATA_DIR) -> Path:
    """
    Ensure NIFTY 50 data is available. Download if not present.

    Returns:
        Path to the CSV file.
    """
    csv_path = data_dir / DEFAULT_OUTPUT_FILE
    if not csv_path.exists():
        return download_nifty_data(output_dir=data_dir)
    return csv_path


if __name__ == "__main__":
    path = download_nifty_data(force=True)
    print(f"\nData saved to: {path}")

    # Quick verification
    df = pd.read_csv(path)
    print(f"\nShape: {df.shape}")
    print(f"Date range: {df['Date'].iloc[0]} to {df['Date'].iloc[-1]}")
    print(f"\nFirst 5 rows:")
    print(df.head())
    print(f"\nLast 5 rows:")
    print(df.tail())
